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

test("new and legacy declarations default spend to zero", () => {
  assert.equal(freshDeclaration().enduranceSpend, 0);
  assert.equal(new DeclarationDataModel().enduranceSpend, 0);
  assert.equal(actor().system.declaration.enduranceSpend, 0);
});
for (const spend of [-1, 3, 1.5, NaN]) {
  test(`invalid spend ${spend} rejected by edit operation; model follows bounded integer cleaning`, () => {
    assert.throws(() => editDeclaration(freshDeclaration(), { type: "endurance-spend", enduranceSpend: spend }));
    try {
      const d = new DeclarationDataModel({ enduranceSpend: spend });
      assert.ok(Number.isInteger(d.enduranceSpend) && d.enduranceSpend >= 0 && d.enduranceSpend <= 2);
    } catch (error) { assert.match(error.message, /validation|enduranceSpend/i); }
  });
}
for (const [severity, endurance, allowed] of [[0, 5, [0]], [1, 5, [0, 1]], [2, 5, [0, 1, 2]], [2, 1, [0, 1]], [2, 0, [0]]]) {
  test(`availability severity ${severity}, Endurance ${endurance}`, () => {
    const a = actor({ severity, endurance });
    assert.deepEqual(enduranceSpendOptions(a, 0).filter(o => !o.disabled).map(o => o.value), allowed);
  });
}
for (const [severity, spend, total] of [[0, 0, 4], [1, 0, 5], [1, 1, 4], [2, 0, 6], [2, 1, 5], [2, 2, 4]]) {
  test(`severity ${severity}, spend ${spend}: threshold ${total} in preview and snapshot`, async () => {
    const a = actor({ severity, spend });
    assert.equal(threshold(a).total, total);
    assert.equal(a.system.resources.endurance.value, 5);
    await apply(a, { type: "lock" });
    assert.equal(threshold(a).total, total);
    assert.equal(a.system.declaration.snapshot.enduranceSpend, spend);
    assert.equal(a.system.resources.endurance.value, 5 - spend);
    assert.equal(a.system.health.woundSeverity, severity);
    assert.equal(a.updates.length, 1);
  });
}
test("editing, repeated evaluation and completion never charge; End resets without refund", async () => {
  const a = actor({ count: 2 });
  await apply(a, { type: "endurance-spend", enduranceSpend: 2 });
  for (let i = 0; i < 4; i++) getDeclarationEvaluation(a);
  assert.equal(a.system.resources.endurance.value, 5);
  await apply(a, { type: "lock" });
  assert.equal(a.system.resources.endurance.value, 3);
  for (const entryId of ["0", "1", "0"]) await apply(a, { type: "complete", entryId });
  await assert.rejects(apply(a, { type: "lock" }), /already locked/);
  assert.equal(a.system.resources.endurance.value, 3);
  await apply(a, { type: "clear" });
  assert.equal(a.system.declaration.enduranceSpend, 0);
  assert.equal(a.system.declaration.snapshot, null);
  assert.equal(a.system.resources.endurance.value, 3);
});
for (const kind of ["insufficient", "excess", "invalid-action", "stale", "unauthorized", "failed-update", "broken"]) {
  test(`failed ${kind} lock leaves all state and resources intact`, async () => {
    const a = actor({ spend: 2, endurance: kind === "insufficient" ? 1 : kind === "broken" ? 2 : 5,
      severity: kind === "excess" ? 1 : 2, hope: kind === "broken" ? -6 : 0 });
    if (kind === "invalid-action") a.actions[0].rollRequirement = null;
    if (kind === "unauthorized") a.isOwner = false;
    if (kind === "failed-update") a.update = async () => { throw new Error("Failed write"); };
    const before = a.system.toObject();
    await assert.rejects(updateDeclaration(a, kind === "stale" ? 99 : 0, { type: "lock" }));
    assert.deepEqual(a.system.toObject(), before);
    assert.equal(a.updates.length, 0);
  });
}
test("current resource and wound changes invalidate an earlier selection", async () => {
  const a = actor({ spend: 2 });
  await a.update({ "system.resources.endurance.value": 1 });
  assert.equal(getDeclarationEvaluation(a).canLock, false);
  await assert.rejects(apply(a, { type: "lock" }), /Not enough/);
  await a.update({ "system.resources.endurance.value": 5, "system.health.woundSeverity": 1 });
  await assert.rejects(apply(a, { type: "lock" }), /remaining Wound/);
});
test("post-cost Exhausted and Multi-Action stack to 6", async () => {
  const a = actor({ spend: 2, endurance: 2, count: 2 });
  assert.equal(threshold(a).total, 6);
  const modifiers = threshold(a).modifiers;
  assert.equal(modifiers.find(m => m.source.condition === "exhausted").value, 1);
  assert.equal(modifiers.find(m => m.id === "multi-action").value, 1);
  await apply(a, { type: "lock" });
  assert.equal(a.system.resources.endurance.value, 0);
  assert.equal(threshold(a).total, 6);
});
test("post-cost Overburdened remains +1", async () => {
  const a = actor({ spend: 2, endurance: 3, load: 2 });
  assert.equal(threshold(a).total, 5);
  await apply(a, { type: "lock" });
  assert.equal(threshold(a).modifiers.find(m => m.source.condition === "overburdened").value, 1);
});
for (const [hope, bonus] of [[1, -1], [6, -2], [-6, 1]]) {
  test(`Hope ${hope} tier stacks unchanged with Wound suppression and offensive stance`, () => {
    const a = actor({ spend: 2, hope, stance: "offensive" });
    assert.equal(threshold(a).total, 4 + bonus - 1);
    assert.equal(threshold(a).modifiers.find(m => m.source.condition === "hope").value, bonus);
  });
}
test("Action modifiers remain and forged Endurance Push labels are not translated", () => {
  const a = actor({ spend: 2 });
  a.actions[0].modifiers = { successDice: [], successThreshold: [{ id: "custom", label: "Equipment", value: 3 }] };
  assert.equal(threshold(a).total, 7);
  assert.equal(modifierLabel({ id: "endurance-push", label: "Custom", source: { type: "item" } }), "Custom");
});
test("locked snapshot survives later Endurance, wounds, item and reload changes", async () => {
  const a = actor({ spend: 2 });
  await apply(a, { type: "lock" });
  const snapshot = a.system.declaration.snapshot.toObject();
  await a.update({ "system.resources.endurance.value": 0, "system.health.woundSeverity": 0 });
  a.actions = [];
  assert.deepEqual(a.system.declaration.snapshot.toObject(), snapshot);
  assert.equal(threshold(a).total, 4);
  assert.equal(getDeclarationEvaluation(a).enduranceSpend, 2);
  const reload = new FatedDataModel(a.system.toObject());
  assert.deepEqual(reload.declaration.snapshot.toObject(), snapshot);
});
for (const [severity, care, allowed] of [[1, "bandaged", [0]], [2, "bandaged", [0, 1]], [2, "treated", [0]]]) {
  test(`wound care ${severity}/${care} caps suppression at remaining penalty`, async () => {
    const a = actor({ severity, care });
    assert.deepEqual(enduranceSpendOptions(a, 0).filter(o => !o.disabled).map(o => o.value), allowed);
    await assert.rejects(apply(a, { type: "endurance-spend", enduranceSpend: 2 }), /remaining Wound/);
  });
}
test("bandage breaks atomically after its benefit and push are snapshotted", async () => {
  const a = actor({ care: "bandaged", count: 2, spend: 1 });
  await apply(a, { type: "lock" });
  assert.equal(threshold(a).total, 5);
  assert.equal(a.system.health.woundCare.care, "none");
  assert.equal(a.system.resources.endurance.value, 4);
  assert.equal(a.updates.length, 1);
});
for (const [lang, label] of [["en", "Endurance Push"], ["it", "Sforzo di Resistenza"]]) {
  test(`${lang} translates traceable push and planner controls use localization`, () => {
    const catalog = JSON.parse(readFileSync(new URL(`../lang/${lang}.json`, import.meta.url), "utf8"));
    const i18n = { localize: key => key.split(".").reduce((v, k) => v[k], catalog) };
    const modifier = threshold(actor({ spend: 2 })).modifiers.find(m => m.id === "endurance-push");
    assert.equal(modifierLabel(modifier, i18n), label);
    assert.equal(modifier.source.suppressedModifierId, "actor-wounds");
    assert.equal(modifier.source.enduranceSpend, 2);
    const template = readFileSync(new URL("../templates/actor/turn-planner.hbs", import.meta.url), "utf8");
    assert.match(template, /localize "FATED.Planner.EndurancePush"/);
    assert.match(template, /data-operation="endurance-spend"/);
    assert.match(template, /planner.enduranceSpend/);
  });
}
