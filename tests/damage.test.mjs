import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
await import(pathToFileURL(resolve(process.env.FOUNDRY_APP_PATH
  ?? resolve(process.env.LOCALAPPDATA ?? ".", "Programs/Foundry Virtual Tabletop/resources/app"), "common/server.mjs")));
const { FatedDataModel, WeaponDataModel } = await import("../module/data-models.mjs");
const { ActionDataModel } = await import("../module/actions/action-model.mjs");
const { calculateDefense, actionDamage } = await import("../module/defense.mjs");
const { previewDamage, applyDamage } = await import("../module/damage.mjs");
const { readActionForm } = await import("../module/sheets/action-form.mjs");

function actor(data = {}) {
  const source = foundry.utils.mergeObject({ attributes: { heart: 2, body: 2, mind: 3 },
    resources: { endurance: { value: 4 }, hope: { value: 0 } } }, data, { inplace: false });
  const a = { type: "fated", uuid: "Actor.damage-test", isOwner: true, updates: [], system: new FatedDataModel(source),
    async update(changes) {
      await this.system._preUpdate(changes, {}, { isGM: true });
      this.updates.push(structuredClone(changes));
      this.system.updateSource(foundry.utils.expandObject(changes).system);
      this.system.prepareDerivedData();
    } };
  a.system.prepareDerivedData();
  return a;
}

test("Defense derives Body + Mind and current stance; derived value is not stored", () => {
  for (const [stance, expected] of [["neutral", 5], ["offensive", 4], ["defensive", 6], ["ranged", 5]]) {
    const a = actor({ currentStance: stance });
    assert.equal(calculateDefense(a).total, expected);
    assert.equal(a.system.defense, expected);
    assert.equal(Object.hasOwn(a.system.toObject(), "defense"), false);
    assert.equal(Object.hasOwn(FatedDataModel.schema.fields, "defense"), false);
  }
});

test("raw zero/negative Defense clamps to 1 and preserves every contribution", () => {
  for (const stance of ["neutral", "offensive"]) {
    const a = actor({ attributes: { body: 0, mind: 0 }, currentStance: stance });
    const d = calculateDefense(a);
    assert.equal(d.body, 0); assert.equal(d.mind, 0); assert.equal(d.base, 0);
    assert.equal(d.raw, stance === "offensive" ? -1 : 0);
    assert.equal(d.total, 1);
    if (stance === "offensive") assert.equal(d.modifiers[0].value, -1);
    assert.equal(previewDamage({ target: a, finalDamage: 3 }).wounds, 3);
  }
});

test("Defense extension accepts traceable modifiers without treating owned armor as worn", () => {
  const a = actor(); a.items = [{ type: "armor", system: { defense: 99 } }];
  assert.equal(calculateDefense(a).total, 5);
  const modifier = { label: "Future explicit contribution", value: 2, source: { itemUuid: "Item.example" } };
  assert.deepEqual(calculateDefense(a, [modifier]).modifiers, [modifier]);
  assert.equal(calculateDefense(a, [modifier]).total, 7);
});

test("optional Action Damage round trips, reuses Weapon Damage and preserves direct-form edits", () => {
  const weapon = { type: "weapon", system: new WeaponDataModel({ damage: 3 }) };
  assert.equal(actionDamage(new ActionDataModel({ attackType: "melee" }), weapon), 3);
  assert.equal(actionDamage(new ActionDataModel({ attackType: "ranged", damage: 0 }), weapon), 0);
  assert.equal(actionDamage(new ActionDataModel({}), weapon), null);
  const action = new ActionDataModel({ damage: 5 }).toObject();
  assert.equal(new ActionDataModel(action).damage, 5);
  assert.equal(readActionForm({ 0: { damage: "2.5" } }, [action])[0].damage, 2.5);
  assert.equal(readActionForm({ 0: { damage: "" } }, [action])[0].damage, null);
  assert.equal(new ActionDataModel({ damage: -1 }).damage, 0);
});

test("physical Successes multiply Damage before individual final modifiers; minimum final Damage 0", () => {
  const target = actor();
  for (const [stance, total] of [["neutral", 6], ["offensive", 7], ["defensive", 5], ["ranged", 6]]) {
    const result = previewDamage({ attacker: actor({ currentStance: stance }), target, successes: 3, damagePerSuccess: 2 });
    assert.equal(result.successes, 3); assert.equal(result.damagePerSuccess, 2);
    assert.equal(result.baseTotalDamage, 6); assert.equal(result.finalDamage, total);
    if (["offensive", "defensive"].includes(stance)) assert.equal(result.finalDamageModifiers[0].source.type, "stance");
  }
  const result = previewDamage({ attacker: actor({ currentStance: "defensive" }), target, successes: 0, damagePerSuccess: 3 });
  assert.equal(result.finalDamage, 0);
  const modifier = { label: "Ad-hoc established adjustment", value: 2, source: { type: "manual" } };
  assert.equal(previewDamage({ target, successes: 2, damagePerSuccess: 3, finalDamageModifiers: [modifier] }).finalDamage, 8);
});

test("Damage/Defense boundaries yield 0/1/2/3 Wounds; manual Damage bypasses attacker stance", () => {
  for (const [damage, wounds] of [[4, 0], [5, 1], [9, 1], [10, 2], [15, 3]]) {
    const result = previewDamage({ attacker: actor({ currentStance: "offensive" }), target: actor(), finalDamage: damage });
    assert.equal(result.wounds, wounds); assert.equal(result.finalDamage, damage);
    assert.deepEqual(result.finalDamageModifiers, []);
  }
});

test("preview never mutates; Healthy + 3 Wounds applies exactly one simultaneous transition to Death's Door", async () => {
  const target = actor(); const before = target.system.toObject();
  const input = { target, successes: 3, damagePerSuccess: 5 };
  assert.equal(previewDamage(input).resultingWoundSeverity, 3);
  assert.deepEqual(target.system.toObject(), before); assert.equal(target.updates.length, 0);
  await applyDamage(input);
  assert.equal(target.updates.length, 1); assert.equal(target.updates[0]["system.health.woundSeverity"], 3);
  assert.equal(target.system.health.dead, false); assert.equal(target.system.health.stabilized, false);
  assert.deepEqual(target.system.toObject().resources, before.resources);
  assert.deepEqual(target.system.toObject().declaration, before.declaration);
  assert.equal(target.system.currentStance, before.currentStance);
  assert.equal(new FatedDataModel(JSON.parse(JSON.stringify(target.system.toObject()))).health.woundSeverity, 3);
});

test("multi-Wound application preserves health death/stabilization/second-incapacitation rules", async () => {
  const dead = actor(); await applyDamage({ target: dead, finalDamage: 25 });
  assert.equal(dead.system.health.woundSeverity, 4); assert.equal(dead.system.health.dead, true);
  assert.equal(dead.updates.length, 1);
  const broken = actor({ resources: { endurance: { value: 0 }, hope: { value: -5 } } });
  await applyDamage({ target: broken, finalDamage: 15 });
  assert.equal(broken.system.health.dead, true); assert.equal(broken.updates.length, 1);
  const stabilized = actor({ health: { woundSeverity: 3, stabilized: true } });
  await applyDamage({ target: stabilized, finalDamage: 5 });
  assert.equal(stabilized.system.health.dead, true); assert.equal(stabilized.system.health.stabilized, false);
});

test("zero-Wound instances and unauthorized application leave the Actor unchanged", async () => {
  const target = actor(); await applyDamage({ target, finalDamage: 4 });
  assert.equal(target.updates.length, 0);
  target.isOwner = false;
  assert.equal(previewDamage({ target, finalDamage: 15 }).wounds, 3);
  await assert.rejects(applyDamage({ target, finalDamage: 15 }), /cannot update/);
  assert.equal(target.updates.length, 0); assert.equal(target.system.health.woundSeverity, 0);
});

test("preview comparison detects newly Broken health even with unchanged Defense and wound projection", async () => {
  const target = actor();
  const input = { target, finalDamage: 15 };
  const before = previewDamage(input);
  await target.update({ "system.resources.endurance.value": 0, "system.resources.hope.value": -5 });
  const after = previewDamage(input);
  assert.equal(before.targetDefense, after.targetDefense);
  assert.equal(before.resultingWoundSeverity, after.resultingWoundSeverity);
  assert.equal(before.targetHealth.incapacitated, false);
  assert.equal(after.targetHealth.broken, true);
  assert.notEqual(JSON.stringify(before), JSON.stringify(after));
  assert.equal(target.system.health.woundSeverity, 0);
  assert.equal(target.system.health.dead, false);
});

test("invalid/incomplete damage inputs fail safely without mutations", () => {
  const target = actor();
  for (const input of [{ successes: -1, damagePerSuccess: 2 }, { successes: 1.5, damagePerSuccess: 2 },
    { successes: 1 }, { finalDamage: NaN }, { finalDamage: -1 },
    { successes: 1, damagePerSuccess: 2, finalDamageModifiers: [{ value: 1 }] }]) {
    assert.throws(() => previewDamage({ target, ...input }));
  }
  assert.throws(() => previewDamage({ target: { type: "npc" }, finalDamage: 1 }));
  assert.equal(target.updates.length, 0);
});

for (const wounds of [0, 1, 2, 3]) {
  test(`Treated Grievous + ${wounds} Wounds previews and applies one coherent transition`, async () => {
    const target = actor({ health: { woundSeverity: 2, woundCare: { care: "treated", daysRemaining: 7 } } });
    const before = target.system.toObject();
    const input = { target, finalDamage: wounds === 0 ? 4 : wounds * 5 };
    const preview = previewDamage(input);
    const expectedSeverity = [2, 2, 3, 4][wounds];
    const expectedCare = wounds === 0 ? { care: "treated", daysRemaining: 7 } : { care: "none", daysRemaining: 0 };
    assert.equal(preview.wounds, wounds);
    assert.equal(preview.treatmentReopened, wounds > 0);
    assert.equal(preview.resultingWoundSeverity, expectedSeverity);
    assert.deepEqual(preview.resultingWoundCare, expectedCare);
    assert.deepEqual(target.system.toObject(), before);
    assert.equal(target.updates.length, 0);
    const result = await applyDamage(input);
    assert.deepEqual(result, preview);
    assert.equal(target.updates.length, wounds > 0 ? 1 : 0);
    assert.equal(target.system.health.woundSeverity, expectedSeverity);
    assert.deepEqual(target.system.toObject().health.woundCare, expectedCare);
    assert.equal(target.system.health.stabilized, false);
    assert.equal(target.system.health.dead, wounds === 3);
    const { getActorHealth, actorStateModifiers } = await import("../module/health.mjs");
    assert.equal(getActorHealth(target).deathsDoor, wounds === 2);
    if (wounds === 1) {
      const mods = actorStateModifiers(target).successThreshold;
      assert.equal(mods.find(m => m.source.condition === "wounds").value, 2);
      assert.equal(mods.some(m => m.source.condition === "treated"), false);
      assert.deepEqual(target.updates[0]["system.health.woundCare"], expectedCare);
    }
    assert.deepEqual(target.system.toObject().resources, before.resources);
    assert.deepEqual(target.system.toObject().declaration, before.declaration);
  });
}

test("Only Treated Grievous consumes the first Wound for reopening", async () => {
  for (const care of ["none", "bandaged", "grievousHealingPending"]) {
    const target = actor({ health: { woundSeverity: 2, woundCare: { care, daysRemaining: 3 } } });
    const input = { target, finalDamage: 5 };
    assert.equal(previewDamage(input).treatmentReopened, false);
    assert.equal(previewDamage(input).resultingWoundSeverity, 3);
    await applyDamage(input);
    assert.equal(target.system.health.woundSeverity, 3);
    assert.equal(target.updates.length, 1);
    assert.deepEqual(target.system.toObject().health.woundCare, { care: "none", daysRemaining: 0 });
  }
});

test("Treatment changes invalidate preview even when severity projection is unchanged", async () => {
  const target = actor({ health: { woundSeverity: 2, woundCare: { care: "treated", daysRemaining: 7 } } });
  const input = { target, finalDamage: 15 };
  const before = previewDamage(input);
  await target.update({ "system.health.woundCare.daysRemaining": 6 });
  const durationChanged = previewDamage(input);
  assert.equal(durationChanged.resultingWoundSeverity, before.resultingWoundSeverity);
  assert.notEqual(JSON.stringify(durationChanged), JSON.stringify(before));
  await target.update({ "system.health.woundCare": { care: "none", daysRemaining: 0 } });
  const careChanged = previewDamage(input);
  assert.equal(careChanged.resultingWoundSeverity, before.resultingWoundSeverity);
  assert.notEqual(JSON.stringify(careChanged), JSON.stringify(before));
  assert.equal(careChanged.treatmentReopened, false);
});

test("Reopening preserves second-incapacitation and persistent death rules", async () => {
  for (const dead of [false, true]) {
    const target = actor({ resources: { endurance: { value: 0 }, hope: { value: -5 } },
      health: { woundSeverity: 2, dead, woundCare: { care: "treated", daysRemaining: 2 } } });
    await applyDamage({ target, finalDamage: 10 });
    assert.equal(target.system.health.woundSeverity, dead ? 4 : 3);
    assert.equal(target.system.health.dead, true);
    assert.equal(target.updates.length, 1);
  }
});

test("Read-only treated Actor cannot reopen treatment through damage application", async () => {
  const target = actor({ health: { woundSeverity: 2, woundCare: { care: "treated", daysRemaining: 7 } } });
  target.isOwner = false;
  const before = target.system.toObject();
  await assert.rejects(applyDamage({ target, finalDamage: 5 }), /cannot update/);
  assert.deepEqual(target.system.toObject(), before);
  assert.equal(target.updates.length, 0);
});

test("Treatment reopening is restricted to severity 2", async () => {
  const { projectWounds } = await import("../module/health.mjs");
  for (const severity of [0, 1, 3, 4]) {
    const p = projectWounds({ woundSeverity: severity, woundCare: { care: "treated", daysRemaining: 7 } }, 1);
    assert.equal(p.treatmentReopened, false);
    assert.equal(p.woundSeverity, Math.min(4, severity + 1));
  }
});
