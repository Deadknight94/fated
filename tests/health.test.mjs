import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { modifierLabel, localizedHealth } from "../module/presentation/labels.mjs";
await import(pathToFileURL(resolve(process.env.FOUNDRY_APP_PATH ?? resolve(process.env.LOCALAPPDATA ?? ".", "Programs/Foundry Virtual Tabletop/resources/app"), "common/server.mjs")));
const { FatedDataModel } = await import("../module/data-models.mjs");
const { ActionDataModel } = await import("../module/actions/action-model.mjs");
const { deriveHealth, healthTransition, actorStateModifiers, calculateActorAction, updateHealth, healthView } = await import("../module/health.mjs");
const { getDeclarationEvaluation, updateDeclaration } = await import("../module/declaration/service.mjs");

function actor(data = {}) {
  const system = foundry.utils.mergeObject({ attributes: { heart: 2, body: 3, mind: 4 },
    resources: { endurance: { value: 4 }, hope: { value: 0 }, power: 3 }, health: { woundSeverity: 0, stabilized: false, dead: false } }, data, { inplace: false });
  const a = { id: "test", uuid: "Actor.test", type: "fated", isOwner: true, user: { isGM: false }, updates: [], system: new FatedDataModel(system),
    getAvailableActions: () => [action()], async update(changes) {
      await this.system._preUpdate(changes, {}, this.user);
      this.updates.push(structuredClone(changes));
      this.system.updateSource(foundry.utils.expandObject(changes).system);
      this.system.prepareDerivedData();
    } };
  a.system.prepareDerivedData();
  return a;
}
function action() {
  return { ...new ActionDataModel({ id: "strike", classification: "main", rollRequirement: "required",
    successDice: { source: "fixed", base: 4 }, allowedStances: ["neutral"], multiActionEligible: true }).toObject(),
    source: { itemId: "item", itemUuid: "Actor.test.Item.item", itemName: "Test", itemType: "weapon" } };
}
const entry = id => ({ id, kind: "action", itemId: "item", actionId: "strike" });

test("wound severities map 0/1/2/3/4 to canonical states; 4+ normalizes terminal Dead", () => {
  for (const [woundSeverity, label] of ["Healthy", "Light Wound", "Grievous Wound", "Death's Door", "Dead"].entries()) {
    const state = deriveHealth(actor({ health: { woundSeverity } }).system);
    assert.equal(state.woundLabel, label);
    assert.equal(state.deathsDoor, woundSeverity === 3);
    assert.equal(state.incapacitated, woundSeverity === 3);
    assert.equal(state.dead, woundSeverity === 4);
  }
  assert.equal(actor({ health: { woundSeverity: 9 } }).system.health.woundSeverity, 4);
});

test("Light/Grievous Threshold modifiers are +1/+2; no wound modifier is invented for Death's Door", () => {
  for (const severity of [0, 1, 2, 3, 4]) {
    const a = actor({ health: { woundSeverity: severity } });
    const result = calculateActorAction(a, action());
    assert.equal(result.successThreshold.base, 4);
    assert.equal(result.successThreshold.total, 4 + ([1, 2].includes(severity) ? severity : 0));
    assert.equal(result.successThreshold.modifiers.length, [1, 2].includes(severity) ? 1 : 0);
  }
});

test("Overburdened uses strictly Load > current Endurance; Exhausted uses Endurance zero", () => {
  const a = actor({ load: 4 });
  assert.equal(deriveHealth(a.system).overburdened, false);
  a.system.load = 5;
  assert.equal(deriveHealth(a.system).overburdened, true);
  const b = actor({ resources: { endurance: { value: 0 } } });
  assert.equal(deriveHealth(b.system).exhausted, true);
  assert.equal(deriveHealth(b.system).broken, false);
});

test("Inspired/Despondent use exact Hope boundaries and require a positive Hope Limit", () => {
  assert.equal(deriveHealth(actor({ resources: { hope: { value: 6 } } }).system).inspired, true);
  assert.equal(deriveHealth(actor({ resources: { hope: { value: -6 } } }).system).despondent, true);
  assert.equal(deriveHealth(actor({ resources: { hope: { value: 5 } } }).system).inspired, false);
  const a = actor({ attributes: { heart: 0, mind: 0 } });
  const s = deriveHealth(a.system);
  assert.equal(s.inspired, false); assert.equal(s.despondent, false);
  assert.deepEqual(actorStateModifiers(a).successThreshold, []);
  assert.equal(calculateActorAction(actor({ resources: { hope: { value: 6 } } }), action()).successThreshold.total, 2);
  assert.equal(calculateActorAction(actor({ resources: { hope: { value: -6 } } }), action()).successThreshold.total, 5);
});

for (const [hope, total] of [[0, 4], [1, 3], [3, 3], [5, 3], [6, 2], [-1, 4], [-5, 4], [-6, 5]]) {
  test(`Hope ${hope}: base 4 becomes ${total}, with exactly one applicable Hope tier`, () => {
    const a = actor({ resources: { hope: { value: hope } } });
    const before = a.system.toObject();
    const state = deriveHealth(a.system);
    const result = calculateActorAction(a, action());
    assert.equal(result.successThreshold.total, total);
    assert.equal(state.inspired, hope === 6);
    assert.equal(state.despondent, hope === -6);
    assert.deepEqual(result.successThreshold.modifiers.map(m => [m.source.condition, m.value]),
      total === 4 ? [] : [["hope", total - 4]]);
    assert.equal(result.successDice.total, 4);
    assert.deepEqual(a.system.toObject(), before);
    assert.equal(a.updates.length, 0);
  });
}

test("Hope stacks with Light Wounds, other actor states and Multi-Action without duplication", () => {
  for (const [hope, bonus] of [[1, -1], [6, -2]]) {
    const a = actor({ health: { woundSeverity: 1 }, resources: { hope: { value: hope } } });
    assert.equal(calculateActorAction(a, action()).successThreshold.total, 5 + bonus);
    const b = actor({ health: { woundSeverity: 1 }, load: 1,
      resources: { hope: { value: hope }, endurance: { value: 0 } },
      declaration: { stance: "neutral", entries: [entry("a"), entry("b")] } });
    const threshold = getDeclarationEvaluation(b).entries[0].calculation.successThreshold;
    assert.equal(threshold.total, 8 + bonus);
    assert.equal(threshold.modifiers.filter(m => m.source.condition === "hope").length, 1);
  }
});

test("Hope has no floor/ceiling, zero-limit bonus or NPC effect; out-of-range Hope stays clamped", () => {
  for (const [hope, expected] of [[99, -2], [-99, 1]]) {
    const a = actor({ resources: { hope: { value: hope } } });
    assert.equal(deriveHealth(a.system).hopeThresholdModifier, expected);
    for (const value of [-10, 10]) {
      assert.equal(calculateActorAction(a, action(), { successThreshold: [{ value }] }).successThreshold.total, 4 + expected + value);
    }
    a.type = "npc";
    assert.deepEqual(actorStateModifiers(a).successThreshold, []);
  }
  const a = actor({ attributes: { heart: 0, mind: 0 }, resources: { hope: { value: 1 } } });
  assert.equal(deriveHealth(a.system).hopeThresholdModifier, 0);
  assert.equal(calculateActorAction(a, action()).successThreshold.total, 4);
});

test("Hope provenance and localized Action/Turn labels survive locking; conditions show the right tier", async () => {
  const previousGame = globalThis.game;
  try {
    for (const [language, hopeLabel, inspiredLabel] of [["en", "Hope", "Inspired"], ["it", "Speranza", "Ispirato"]]) {
      const strings = JSON.parse(readFileSync(new URL(`../lang/${language}.json`, import.meta.url), "utf8"));
      globalThis.game = { user: { id: "test" }, i18n: { localize: key => key.split(".").reduce((value, part) => value?.[part], strings) ?? key } };
      for (const [hope, bonus] of [[1, -1], [6, -2], [-6, 1]]) {
        const a = actor({ resources: { hope: { value: hope } }, declaration: { stance: "neutral", entries: [entry("a")] } });
        const modifier = calculateActorAction(a, action()).successThreshold.modifiers[0];
        assert.deepEqual(modifier.source, { type: "actor-state", actorId: "test", actorUuid: "Actor.test", condition: "hope" });
        assert.equal(modifierLabel(modifier), hopeLabel);
        assert.equal(modifierLabel({ label: "Custom Hope", source: { type: "item", condition: "hope" } }), "Custom Hope");
        if (hope > 0) assert.ok(localizedHealth(healthView(a)).conditions.includes(`${hope === 6 ? inspiredLabel : hopeLabel} (−${Math.abs(bonus)})`));
        await updateDeclaration(a, 0, { type: "lock" });
        await a.update({ "system.resources.hope.value": 0 });
        const locked = getDeclarationEvaluation(a).entries[0].calculation.successThreshold;
        assert.equal(locked.total, 4 + bonus);
        assert.equal(modifierLabel(locked.modifiers[0]), hopeLabel);
      }
    }
    const mobile = readFileSync(new URL("../module/sheets/mobile-sheet.mjs", import.meta.url), "utf8");
    assert.match(mobile, /label: modifierLabel\(modifier\)/);
    assert.match(mobile, /threshold: breakdownView\(calculation.successThreshold\)/);
    assert.match(mobile, /breakdownView\(entry.calculation.successThreshold\)/);
  } finally { globalThis.game = previousGame; }
});

test("Hope Limit zero with Endurance zero is Exhausted but not Broken", () => {
  const a = actor({ attributes: { heart: 0, mind: 0 }, resources: { endurance: { value: 0 } } });
  const state = deriveHealth(a.system);
  assert.equal(a.system.resources.hope.value, 0);
  assert.equal(state.inspired, false);
  assert.equal(state.despondent, false);
  assert.equal(state.exhausted, true);
  assert.equal(state.broken, false);
  assert.equal(state.incapacitated, false);
  assert.deepEqual(actorStateModifiers(a).successThreshold.map(m => m.label), ["Exhausted"]);
});

test("creation normalizes death/stabilization in pending source without creating a transition history", async () => {
  for (const woundSeverity of [3, 4]) {
    const source = actor({ health: { woundSeverity, stabilized: true }, resources: { endurance: { value: 0 }, hope: { value: -6 } } }).system.toObject();
    const patches = [];
    await FatedDataModel.prototype._preCreate.call({ toObject: () => source, parent: { updateSource: patch => patches.push(patch) } }, {}, {}, {});
    assert.equal(patches[1]["system.health.stabilized"], false);
    assert.equal(patches[1]["system.health.dead"], woundSeverity === 4);
  }
});

test("document lifecycle rejects a direct lock combined with new Incapacitation", async () => {
  globalThis.game ??= { user: { id: "test" } };
  const a = actor({ declaration: { stance: "neutral", entries: [entry("a")] } });
  const { lockDeclaration } = await import("../module/declaration/evaluate.mjs");
  const locked = lockDeclaration(a.system.declaration.toObject(), [action()], a.system.attributes);
  const before = a.system.toObject();
  await assert.rejects(a.update({ "system.declaration": locked, "system.health.woundSeverity": 3 }), /Incapacitated/);
  assert.deepEqual(a.system.toObject(), before);
  assert.equal(a.updates.length, 0);
});

test("Despondent and Exhausted derive Broken; resolving either component ends it without timed resource changes", async () => {
  for (const patch of [{ "system.resources.hope.value": -5 }, { "system.resources.endurance.value": 1 }]) {
    const a = actor({ resources: { hope: { value: -6 }, endurance: { value: 0 } } });
    assert.equal(deriveHealth(a.system).broken, true);
    assert.equal(deriveHealth(a.system).incapacitated, true);
    await a.update(patch);
    assert.equal(deriveHealth(a.system).broken, false);
    assert.equal(a.system.resources.power, 3);
    assert.equal(a.system.health.dead, false);
  }
});

test("Wounds and each condition stack individually with labels and Actor source; Multi-Action stacks on universal 4", () => {
  const a = actor({ health: { woundSeverity: 1 }, load: 1, resources: { endurance: { value: 0 } },
    declaration: { stance: "neutral", entries: [entry("a"), entry("b")] } });
  const r = getDeclarationEvaluation(a);
  assert.equal(r.canLock, true);
  const calculation = r.entries[0].calculation.successThreshold;
  assert.equal(calculation.base, 4); assert.equal(calculation.total, 8);
  assert.deepEqual(calculation.modifiers.map(m => m.label), ["Light Wound", "Overburdened", "Exhausted", "Multi-Action"]);
  for (const m of calculation.modifiers.slice(0, 3)) {
    assert.equal(m.source.type, "actor-state"); assert.equal(m.source.actorUuid, "Actor.test"); assert.ok(m.source.condition);
  }
  assert.equal(calculation.modifiers.at(-1).source.mainCount, 2);
  assert.equal(r.entries[0].calculation.successDice.total, 4);
});

test("entering Death's Door is unstabilized; stabilization persists at 3 and clears on leaving/reentering", async () => {
  const a = actor();
  const resources = a.system.toObject().resources;
  await a.update({ "system.health.woundSeverity": 3, "system.health.stabilized": true });
  assert.equal(a.system.health.stabilized, false);
  await updateHealth(a, { type: "stabilize" });
  assert.equal(a.system.health.woundSeverity, 3);
  assert.equal(deriveHealth(a.system).incapacitated, true);
  const reloaded = new FatedDataModel(JSON.parse(JSON.stringify(a.system.toObject())));
  assert.equal(reloaded.health.stabilized, true);
  await a.update({ "system.resources.power": 4 });
  assert.equal(a.system.health.stabilized, true);
  await updateHealth(a, { type: "wound", delta: -1 });
  assert.equal(a.system.health.stabilized, false);
  await updateHealth(a, { type: "wound", delta: 1 });
  assert.equal(a.system.health.stabilized, false);
  assert.equal(a.system.resources.endurance.value, resources.endurance.value);
  assert.equal(a.system.resources.hope.value, resources.hope.value);
});

test("already Death's Door then Broken records persistent death; changing resources never revives", async () => {
  const a = actor({ health: { woundSeverity: 3 } });
  await a.update({ "system.resources.endurance.value": 0, "system.resources.hope.value": -6 });
  assert.equal(a.system.health.dead, true);
  await a.update({ "system.resources.endurance.value": 4, "system.resources.hope.value": 0, "system.health.woundSeverity": 0 });
  assert.equal(deriveHealth(a.system).dead, true);
  assert.equal(new FatedDataModel(JSON.parse(JSON.stringify(a.system.toObject()))).health.dead, true);
});

test("already Broken then Death's Door records death; remaining Broken is not repeated incapacitation", async () => {
  const a = actor({ resources: { endurance: { value: 0 }, hope: { value: -6 } } });
  await a.update({ "system.resources.power": 2 });
  assert.equal(a.system.health.dead, false);
  await updateHealth(a, { type: "wound", delta: 1 });
  await updateHealth(a, { type: "wound", delta: 1 });
  assert.equal(a.system.health.dead, false);
  await updateHealth(a, { type: "wound", delta: 1 });
  assert.equal(a.system.health.dead, true);
});

test("simultaneous first entry causes Incapacitation from both causes without death", async () => {
  const a = actor();
  await a.update({ system: { health: { woundSeverity: 3 }, resources: { endurance: { value: 0 }, hope: { value: -6 } } } });
  assert.equal(a.system.health.dead, false);
  const state = deriveHealth(a.system);
  assert.equal(state.deathsDoor, true);
  assert.equal(state.broken, true);
  assert.equal(state.incapacitated, true);
  await a.update({ "system.resources.power": 2 });
  assert.equal(a.system.health.dead, false);
  assert.equal(new FatedDataModel(JSON.parse(JSON.stringify(a.system.toObject()))).health.dead, false);
});

test("after simultaneous first entry, either resolved cause returning while the other persists causes death", async () => {
  for (const [resolveCause, returnCause] of [
    [{ "system.health.woundSeverity": 2 }, { "system.health.woundSeverity": 3 }],
    [{ "system.resources.hope.value": -5 }, { "system.resources.hope.value": -6 }]
  ]) {
    const a = actor();
    await a.update({ "system.health.woundSeverity": 3, "system.resources.endurance.value": 0, "system.resources.hope.value": -6 });
    assert.equal(a.system.health.dead, false);
    await a.update(resolveCause);
    assert.equal(deriveHealth(a.system).incapacitated, true);
    assert.equal(a.system.health.dead, false);
    await a.update(returnCause);
    assert.equal(a.system.health.dead, true);
  }
});

test("terminal wound death persists after decreasing severity; GM correction is explicit and cannot override severity 4", async () => {
  const a = actor();
  await a.update({ "system.health.woundSeverity": 4 });
  assert.equal(a.system.health.dead, true);
  await a.update({ "system.health.woundSeverity": 0 });
  assert.equal(a.system.health.dead, true);
  await assert.rejects(a.update({ "system.health.dead": false }), /Only a GM/);
  a.user.isGM = true;
  await updateHealth(a, { type: "correct-death" }, { isGM: true });
  assert.equal(a.system.health.dead, false);
  await a.update({ "system.health.woundSeverity": 4 });
  await a.update({ "system.health.dead": false });
  assert.equal(a.system.health.dead, true);
});

test("Incapacitated and Dead cannot lock; existing editable and locked declarations are preserved", async () => {
  globalThis.game ??= { user: { id: "test" } };
  for (const data of [{ health: { woundSeverity: 3 } }, { resources: { endurance: { value: 0 }, hope: { value: -6 } } }, { health: { dead: true } }]) {
    const a = actor({ ...data, declaration: { stance: "neutral", entries: [entry("a")] } });
    const before = a.system.declaration.toObject();
    assert.equal(getDeclarationEvaluation(a).canLock, false);
    await assert.rejects(updateDeclaration(a, 0, { type: "lock" }), /Incapacitated|Dead/);
    assert.deepEqual(a.system.declaration.toObject(), before);
    assert.equal(a.updates.length, 0);
  }
  const a = actor({ health: { woundSeverity: 1 }, declaration: { stance: "neutral", entries: [entry("a")] } });
  await updateDeclaration(a, 0, { type: "lock" });
  const snapshot = a.system.declaration.snapshot.toObject();
  await a.update({ "system.health.woundSeverity": 3 });
  assert.deepEqual(a.system.declaration.snapshot.toObject(), snapshot);
  assert.equal(getDeclarationEvaluation(a).entries[0].calculation.successThreshold.total, 5);
});

test("read-only and NPC bookkeeping paths cannot mutate health; invalid operations are rejected", async () => {
  const a = actor({ health: { woundSeverity: 3 } });
  const before = a.system.toObject();
  a.isOwner = false;
  for (const operation of [{ type: "wound", delta: -1 }, { type: "stabilize" }, { type: "correct-death" }]) {
    assert.equal(await updateHealth(a, operation, { isGM: true }), false);
  }
  a.isOwner = true;
  assert.equal(await updateHealth(a, { type: "correct-death" }), false);
  assert.equal(await updateHealth(a, { type: "wound", delta: 2 }), false);
  a.type = "npc";
  assert.equal(await updateHealth(a, { type: "wound", delta: 1 }), false);
  assert.deepEqual(a.system.toObject(), before);
  assert.equal(a.updates.length, 0);
});

test("health defaults and preparation do not write or infer death from both active causes", () => {
  const a = actor({ health: { woundSeverity: 3 }, resources: { endurance: { value: 0 }, hope: { value: -6 } } });
  assert.equal(a.updates.length, 0);
  assert.equal(a.system.health.dead, false);
  assert.equal(healthView(a).incapacitated, true);
  assert.equal(healthView(a).dead, false);
  assert.equal(healthTransition(a.system.toObject(), a.system.toObject()).dead, false);
});
