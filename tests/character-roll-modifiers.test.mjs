import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
await import(pathToFileURL(resolve(process.env.FOUNDRY_APP_PATH ??
  resolve(process.env.LOCALAPPDATA ?? ".", "Programs/Foundry Virtual Tabletop/resources/app"), "common/server.mjs")));
const { FatedDataModel } = await import("../module/data-models.mjs");
const { ActionDataModel } = await import("../module/actions/action-model.mjs");
const { DeclarationDataModel } = await import("../module/declaration/data-model.mjs");
const { freshDeclaration, editDeclaration } = await import("../module/declaration/evaluate.mjs");
const { enduranceSpendOptions } = await import("../module/declaration/endurance-push.mjs");
const { updateDeclaration, getDeclarationEvaluation } = await import("../module/declaration/service.mjs");
const { modifierLabel } = await import("../module/presentation/labels.mjs");
globalThis.game = { user: { id: "test" } };

function actor({ severity = 2, endurance = 5, spend = 0, hope = 0, load = 0, stance = "neutral", count = 1, care = "none" } = {}) {
  const action = { ...new ActionDataModel({ id: "strike", name: "Strike", classification: "main",
    attackType: "melee", rollRequirement: "required", successDice: { source: "fixed", base: 4 },
    allowedStances: ["neutral", "offensive", "defensive"], multiActionEligible: true }).toObject(),
    source: { itemId: "item", itemUuid: "Item.item", itemName: "Sword", itemType: "weapon" } };
  const a = { type: "fated", id: "a", uuid: "Actor.a", isOwner: true, updates: [], actions: [action],
    system: new FatedDataModel({ attributes: { heart: 2, body: 3, mind: 4 }, load,
      resources: { endurance: { value: endurance }, hope: { value: hope }, power: 2 },
      health: { woundSeverity: severity, woundCare: { care, daysRemaining: care === "none" ? 0 : 3 } },
      declaration: { ...freshDeclaration(stance), enduranceSpend: spend,
        entries: Array.from({ length: count }, (_, i) => ({ id: String(i), kind: "action", itemId: "item", actionId: "strike" })) } }),
    getAvailableActions() { return this.actions; },
    async update(changes) {
      await this.system._preUpdate(changes, {}, { isGM: true });
      this.updates.push(structuredClone(changes));
      this.system.updateSource(foundry.utils.expandObject(changes).system);
      this.system.prepareDerivedData();
    } };
  a.system.prepareDerivedData();
  return a;
}
const apply = (a, operation) => updateDeclaration(a, a.system.declaration.revision, operation);
const threshold = a => getDeclarationEvaluation(a).entries[0].calculation.successThreshold;

const { actorRollModifiers, calculateActorAction, updateHealth, healthView } = await import("../module/health.mjs");
const { manualWoundCareChoices, normalizeWoundCare } = await import("../module/wound-care.mjs");
const { changeManualModifier } = await import("../module/sheets/manual-modifier-controls.mjs");
const { healthAction } = await import("../module/sheets/health-controls.mjs");
const { rollSummary } = await import("../module/presentation/roll-summary.mjs");
const { localizedHealth } = await import("../module/presentation/labels.mjs");
const { NpcDataModel } = await import("../module/data-models.mjs");
const manual = (type, value, label = "  Hope <custom>  ", id = `${type}-${value}`) => ({ id, type, value, label });
const setManual = (a, entries) => a.update({ "system.manualRollModifiers": entries });
const catalogs = Object.fromEntries(["en", "it"].map(lang => [lang, JSON.parse(readFileSync(new URL(`../lang/${lang}.json`, import.meta.url), "utf8"))]));
const translator = lang => ({ localize: key => key.split(".").reduce((obj, part) => obj?.[part], catalogs[lang]) });

for (const [severity, choices] of [[0, ["none"]], [1, ["none", "bandaged"]], [2, ["none", "bandaged", "treated"]], [3, ["none"]], [4, ["none"]]]) {
  test(`manual care choices at severity ${severity}`, async () => {
    assert.deepEqual(manualWoundCareChoices(severity), choices);
    const a = actor({ severity });
    for (const care of choices) {
      assert.equal(await updateHealth(a, { type: "care", care }), true);
      assert.equal(a.system.health.woundCare.care, care);
      assert.equal(a.system.health.woundCare.daysRemaining, 0);
    }
    for (const care of ["invalid", "grievousHealingPending", ...["bandaged", "treated"].filter(c => !choices.includes(c))]) {
      const before = a.system.toObject();
      assert.equal(await updateHealth(a, { type: "care", care }), false);
      assert.deepEqual(a.system.toObject(), before);
    }
    if (severity >= 3) assert.deepEqual(normalizeWoundCare(severity, { care: "treated", daysRemaining: 3 }), { care: "none", daysRemaining: 0 });
  });
}
for (const [severity, care, total] of [[1, "bandaged", 4], [2, "bandaged", 5], [2, "treated", 4]]) {
  test(`${severity} ${care} effects, duration preservation and clearing`, async () => {
    const a = actor({ severity, care: "bandaged" });
    await updateHealth(a, { type: "care", care });
    assert.equal(a.system.health.woundCare.daysRemaining, 3);
    assert.equal(calculateActorAction(a, a.actions[0]).successThreshold.total, total);
    const view = localizedHealth(healthView(a), translator("en"));
    assert.equal(view.careLabel, care === "treated" ? "Treated" : "Bandaged");
    assert.equal(view.careChoices.filter(c => c.selected).length, 1);
    await updateHealth(a, { type: "care", care: "none" });
    assert.equal(calculateActorAction(a, a.actions[0]).successThreshold.total, 4 + severity);
    assert.equal(a.system.health.woundCare.daysRemaining, 0);
  });
}
test("manual severity changes and recorded death normalize incompatible care", async () => {
  const a = actor({ care: "treated" });
  await updateHealth(a, { type: "wound", delta: -1 });
  assert.equal(a.system.health.woundCare.care, "none");
  await updateHealth(a, { type: "care", care: "bandaged" });
  await a.update({ "system.health.dead": true });
  assert.equal(a.system.health.woundCare.care, "none");
  assert.deepEqual(manualWoundCareChoices(1, true), ["none"]);
});
test("transition into death clears care in the same update", async () => {
  const a = actor({ severity: 2, care: "treated", endurance: 0, hope: -6 });
  await a.update({ "system.health.woundSeverity": 3 });
  assert.equal(a.system.health.dead, true);
  assert.equal(a.system.health.woundCare.care, "none");
});
test("care and manual controls enforce sheet editability and Actor ownership", async () => {
  for (const [isEditable, isOwner] of [[false, true], [true, false]]) {
    const a = actor(); a.isOwner = isOwner;
    const sheet = { document: a, isEditable };
    await healthAction.call(sheet, {}, { dataset: { healthOperation: "care", care: "bandaged" } });
    for (const type of ["add", "edit", "remove"]) assert.equal(await changeManualModifier(sheet, { type, id: "a", field: "value", value: 1 }), false);
    assert.equal(a.updates.length, 0);
  }
});
test("manual entries default empty; add/edit/remove preserves signed values, labels, ids and siblings", async () => {
  const a = actor(); const sheet = { document: a, isEditable: true };
  assert.deepEqual(a.system.manualRollModifiers, []);
  await changeManualModifier(sheet, { type: "add" });
  await changeManualModifier(sheet, { type: "add" });
  const ids = a.system.manualRollModifiers.map(m => m.id);
  assert.notEqual(ids[0], ids[1]);
  for (const [index, value] of [3, -2].entries()) {
    await changeManualModifier(sheet, { type: "edit", id: ids[index], field: "value", value });
    await changeManualModifier(sheet, { type: "edit", id: ids[index], field: "label", value: "  Hope <custom>  " });
  }
  await changeManualModifier(sheet, { type: "edit", id: ids[1], field: "type", value: "successThreshold" });
  const copy = new FatedDataModel(a.system.toObject());
  assert.deepEqual(copy.manualRollModifiers.map(m => m.id), ids);
  assert.deepEqual(copy.manualRollModifiers.map(m => m.value), [3, -2]);
  assert.equal(copy.manualRollModifiers[0].label, "  Hope <custom>  ");
  const sibling = { ...a.system.manualRollModifiers[1] };
  await changeManualModifier(sheet, { type: "remove", id: ids[0] });
  assert.deepEqual(a.system.manualRollModifiers, [sibling]);
  for (const operation of [{ field: "value", value: 1.5 }, { field: "type", value: "invalid" }, { field: "id", value: "replace" }]) {
    assert.equal(await changeManualModifier(sheet, { type: "edit", id: ids[1], ...operation }), false);
  }
});
test("overlapping manual edits and additions preserve siblings and unrelated Actor state", async () => {
  const a = actor(); const sheet = { document: a, isEditable: true };
  const before = a.system.toObject();
  await Promise.all([changeManualModifier(sheet, { type: "add" }), changeManualModifier(sheet, { type: "add" })]);
  assert.equal(a.system.manualRollModifiers.length, 2);
  const [first, second] = a.system.manualRollModifiers;
  await Promise.all([
    changeManualModifier(sheet, { type: "edit", id: first.id, field: "value", value: -3 }),
    changeManualModifier(sheet, { type: "edit", id: second.id, field: "label", value: "Sibling" })
  ]);
  assert.equal(a.system.manualRollModifiers[0].value, -3);
  assert.equal(a.system.manualRollModifiers[1].label, "Sibling");
  const after = a.system.toObject();
  delete before.manualRollModifiers; delete after.manualRollModifiers;
  assert.deepEqual(after, before);
  assert.deepEqual(actor().system.manualRollModifiers, []);
});
for (const [type, value, total] of [["successDice", 1, 5], ["successDice", -10, 1], ["successThreshold", 1, 5], ["successThreshold", -10, -6]]) {
  test(`${type} ${value} enters Action calculations without aggregate clamping`, async () => {
    const a = actor({ severity: 0 });
    await setManual(a, [manual(type, value)]);
    assert.equal(calculateActorAction(a, a.actions[0])[type].total, total);
    assert.equal(actorRollModifiers(a)[type][0].value, value);
  });
}
for (const [options, expected] of [[{ hope: 1 }, 5], [{ hope: 6 }, 4], [{ hope: -6 }, 7], [{ severity: 1 }, 7], [{ severity: 2, care: "bandaged" }, 7], [{ severity: 2, care: "treated" }, 6], [{ endurance: 0, load: 1 }, 8]]) {
  test(`manual modifiers stack with ${JSON.stringify(options)}`, async () => {
    const a = actor({ severity: 0, ...options });
    await setManual(a, [manual("successThreshold", 3), manual("successThreshold", -1), manual("successDice", 2), manual("successDice", -1)]);
    const calculation = calculateActorAction(a, a.actions[0]);
    assert.equal(calculation.successThreshold.total, expected);
    assert.equal(calculation.successDice.total, 5);
  });
}
test("Planner combines manual, stance, Multi-Action and projected Endurance Push; snapshot stays frozen", async () => {
  const a = actor({ severity: 2, endurance: 2, spend: 2, load: 1, count: 2, stance: "offensive" });
  await setManual(a, [manual("successThreshold", 3), manual("successDice", 1)]);
  const preview = getDeclarationEvaluation(a);
  const calc = preview.entries[0].calculation;
  assert.equal(calc.successDice.total, 5);
  assert.equal(calc.successThreshold.total, 9); // 4 + wounds 2 + manual 3 + load 1 + exhausted 1 - push 2 + multi 1 - offensive 1
  assert.equal(calc.successThreshold.modifiers.find(m => m.source.type === "actor-manual").value, 3);
  await apply(a, { type: "lock" });
  assert.equal(a.system.currentStance, "offensive");
  const locked = structuredClone(getDeclarationEvaluation(a));
  await setManual(a, []);
  await a.update({ "system.resources.hope.value": 6 });
  a.actions[0].modifiers.successThreshold.push({ id: "later", label: "Later", value: 10 });
  assert.deepEqual(getDeclarationEvaluation(a), locked);
});
for (const [options, total, labels] of [[{}, 4, []], [{ hope: 1 }, 3, ["Hope"]], [{ hope: 6 }, 2, ["Hope"]], [{ severity: 1 }, 5, ["Light Wound"]], [{ severity: 1, care: "bandaged" }, 4, ["Light Wound", "Bandaged"]]]) {
  test(`global summary ${JSON.stringify(options)}`, () => {
    const a = actor({ severity: 0, ...options });
    const summary = rollSummary(a, translator("en"));
    assert.equal(summary.diceModifier, "+0");
    assert.equal(summary.thresholdBase, 4);
    assert.equal(summary.thresholdTotal, total);
    assert.deepEqual(summary.successThreshold.map(m => m.label), labels);
  });
}
test("summary equals shared globals, preserves authored labels in EN/IT and excludes contextual modifiers", async () => {
  const a = actor({ severity: 2, spend: 2, count: 3, stance: "offensive" });
  a.actions[0].modifiers.successThreshold.push({ id: "item", label: "Item context", value: 2 });
  await setManual(a, [manual("successDice", -5), manual("successThreshold", -1)]);
  const global = actorRollModifiers(a);
  for (const lang of ["en", "it"]) {
    const summary = rollSummary(a, translator(lang));
    assert.equal(summary.diceModifier, "-5");
    assert.equal(summary.thresholdTotal, 4 + global.successThreshold.reduce((n, m) => n + m.value, 0));
    assert.equal(summary.successDice[0].label, "  Hope <custom>  ");
    assert.equal(summary.successThreshold.at(-1).label, "  Hope <custom>  ");
    assert.ok(summary.successThreshold.every(m => ["actor-state", "actor-manual"].includes(m.source.type)));
    for (const value of Object.values(catalogs[lang].FATED.Roll)) assert.ok(typeof value === "string" && value.length);
  }
});
test("desktop stance removed, planner stance and mobile shared calculation retained; NPC unchanged", () => {
  const desktop = readFileSync(new URL("../templates/actor/fated-sheet.hbs", import.meta.url), "utf8");
  assert.doesNotMatch(desktop, /name="system.currentStance"/);
  const mobile = readFileSync(new URL("../module/sheets/mobile-sheet.mjs", import.meta.url), "utf8");
  assert.match(mobile, /calculateActorAction\(this.document, action\)/);
  assert.match(mobile, /stance/);
  assert.equal(Object.hasOwn(NpcDataModel.defineSchema(), "manualRollModifiers"), false);
  assert.deepEqual(actorRollModifiers({ type: "npc", system: { manualRollModifiers: [manual("successDice", 4)] } }), { successDice: [], successThreshold: [] });
});

