import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
await import(pathToFileURL(resolve(process.env.FOUNDRY_APP_PATH, "common/server.mjs")));
const { FatedDataModel } = await import("../module/data-models.mjs");
const { ActionDataModel } = await import("../module/actions/action-model.mjs");
const { freshDeclaration } = await import("../module/declaration/evaluate.mjs");
const { updateDeclaration, getDeclarationEvaluation } = await import("../module/declaration/service.mjs");
const { actorStateModifiers } = await import("../module/health.mjs");
globalThis.game = { user: { id: "owner" } };

function actor({ count = 2, severity = 2, care = "bandaged", days = 3, classification = "main", dead = false } = {}) {
  const action = { ...new ActionDataModel({ id: "strike", classification, rollRequirement: "required",
    successDice: { source: "fixed", base: 4 }, allowedStances: ["neutral", "offensive"], multiActionEligible: true }).toObject(),
    source: { itemId: "item", itemUuid: "Actor.test.Item.item", itemName: "Test", itemType: "weapon" } };
  const a = { id: "test", uuid: "Actor.test", type: "fated", isOwner: true, updates: [],
    system: new FatedDataModel({ attributes: { heart: 2, body: 3, mind: 4 },
      resources: { endurance: { value: 4 }, hope: { value: 0 }, power: 3 },
      health: { woundSeverity: severity, dead, woundCare: { care, daysRemaining: care === "none" ? 0 : days } },
      declaration: { ...freshDeclaration("offensive"), entries: Array.from({ length: count }, (_, i) =>
        ({ id: `e${i}`, kind: "action", itemId: "item", actionId: "strike" })) } }),
    getAvailableActions: () => [action], async update(changes) {
      await this.system._preUpdate(changes, {}, { isGM: false });
      this.updates.push(structuredClone(changes));
      this.system.updateSource(foundry.utils.expandObject(changes).system);
      this.system.prepareDerivedData();
    } };
  a.system.prepareDerivedData();
  return a;
}
const lock = a => updateDeclaration(a, a.system.declaration.revision, { type: "lock" });
const state = a => structuredClone(a.system.toObject());
const care = a => structuredClone(a.system.health.woundCare);
const modifiers = a => getDeclarationEvaluation(a).entries[0].calculation.successThreshold.modifiers;

for (const count of [1, 2, 3]) test(`${count} Main Actions snapshot Bandaged benefit; only Multi-Action breaks it atomically`, async () => {
  const a = actor({ count });
  await lock(a);
  assert.equal(a.updates.length, 1);
  assert.equal(a.system.currentStance, "offensive");
  assert.equal(a.system.health.woundSeverity, 2);
  assert.deepEqual(care(a), { care: count === 1 ? "bandaged" : "none", daysRemaining: count === 1 ? 3 : 0 });
  for (const entry of getDeclarationEvaluation(a).entries) {
    const threshold = entry.calculation.successThreshold;
    assert.equal(threshold.base, 4);
    assert.equal(threshold.total, 4 + 2 - 1 + count - 1);
    assert.deepEqual(threshold.modifiers.map(m => [m.label, m.value]),
      [["Grievous Wound", 2], ["Bandaged", -1], ["Multi-Action", count - 1]]);
  }
  assert.deepEqual(actorStateModifiers(a).successThreshold.map(m => [m.label, m.value]),
    count === 1 ? [["Grievous Wound", 2], ["Bandaged", -1]] : [["Grievous Wound", 2]]);
  if (count > 1) assert.deepEqual(a.updates[0]["system.health.woundCare"], { care: "none", daysRemaining: 0 });
  else assert.equal("system.health.woundCare" in a.updates[0], false);
  const snapshot = a.system.declaration.snapshot.toObject();
  await updateDeclaration(a, 1, { type: "complete", entryId: "e0" });
  assert.deepEqual(a.system.declaration.snapshot.toObject(), snapshot);
  assert.ok(modifiers(a).some(m => m.label === "Bandaged"));
  await updateDeclaration(a, 2, { type: "clear" });
  assert.equal(a.system.declaration.snapshot, null);
  assert.ok(snapshot.entries[0].calculation.successThreshold.modifiers.some(m => m.label === "Bandaged"));
  if (count > 1) {
    await updateDeclaration(a, 3, { type: "add", kind: "action", itemId: "item", actionId: "strike" });
    assert.equal(getDeclarationEvaluation(a).entries[0].calculation.successThreshold.total, 6);
  }
});

test("editable Multi-Action evaluation and draft changes leave bandage intact", async () => {
  const a = actor();
  assert.equal(getDeclarationEvaluation(a).multiActionPenalty, 1);
  assert.deepEqual(care(a), { care: "bandaged", daysRemaining: 3 });
  assert.equal(a.updates.length, 0);
  await updateDeclaration(a, 0, { type: "stance", stance: "neutral" });
  assert.deepEqual(care(a), { care: "bandaged", daysRemaining: 3 });
});

for (const reason of ["invalid", "unauthorized", "stale", "failed-update"]) test(`${reason} lock preserves complete Actor state`, async () => {
  const a = actor();
  if (reason === "invalid") a.getAvailableActions = () => [];
  if (reason === "unauthorized") a.isOwner = false;
  if (reason === "failed-update") a.update = async changes => {
    await a.system._preUpdate(changes, {}, { isGM: false });
    assert.equal(changes["system.declaration"].status, "locked");
    assert.deepEqual(changes["system.health.woundCare"], { care: "none", daysRemaining: 0 });
    throw new Error("Persistence failed");
  };
  const before = state(a);
  await assert.rejects(updateDeclaration(a, reason === "stale" ? -1 : 0, { type: "lock" }));
  assert.deepEqual(state(a), before);
  assert.equal(a.updates.length, 0);
});

test("persistent death and incapacitation prevent lock without breaking care", async () => {
  for (const change of [null,
    { "system.resources.endurance.value": 0, "system.resources.hope.value": -6 }]) {
    const a = actor({ dead: change === null });
    if (change) await a.update(change);
    const before = state(a);
    const updateCount = a.updates.length;
    await assert.rejects(lock(a), /Dead|Incapacitated/);
    assert.deepEqual(state(a), before);
    assert.equal(a.updates.length, updateCount);
    assert.deepEqual(care(a), { care: "bandaged", daysRemaining: 3 });
  }
});

for (const [severity, currentCare] of [[2, "none"], [2, "treated"], [2, "grievousHealingPending"], [1, "bandaged"], [0, "none"]])
  test(`severity ${severity} care ${currentCare} is unaffected by Multi-Action`, async () => {
    const a = actor({ severity, care: currentCare });
    const before = care(a);
    await lock(a);
    assert.deepEqual(care(a), before);
    assert.equal("system.health.woundCare" in a.updates[0], false);
  });

test("Movement and Free Actions beside one Main Action do not break bandage", async () => {
  const a = actor({ count: 1 });
  const actions = a.getAvailableActions();
  a.getAvailableActions = () => [...actions, { ...actions[0], id: "free", classification: "free", rollRequirement: "none" }];
  a.system.declaration.updateSource({ entries: [...a.system.declaration.entries,
    { id: "move", kind: "movement" }, { id: "free", kind: "action", itemId: "item", actionId: "free" }] });
  await lock(a);
  assert.equal(a.system.declaration.snapshot.multiActionPenalty, 0);
  assert.deepEqual(care(a), { care: "bandaged", daysRemaining: 3 });
});

test("Power alone preserves bandage; conflicting Power declarations still reject", async () => {
  const a = actor({ count: 1, classification: "power" });
  await lock(a);
  assert.deepEqual(care(a), { care: "bandaged", daysRemaining: 3 });
  const illegal = actor({ classification: "power" });
  const before = state(illegal);
  await assert.rejects(lock(illegal), /only Main\/Power/);
  assert.deepEqual(state(illegal), before);
});

test("lock evaluates authoritative replacement care rather than an obsolete Bandaged draft", async () => {
  const a = actor();
  assert.ok(modifiers(a).some(m => m.label === "Bandaged"));
  await a.update({ "system.health.woundCare": { care: "treated", daysRemaining: 4 } });
  await lock(a);
  assert.deepEqual(care(a), { care: "treated", daysRemaining: 4 });
  assert.ok(modifiers(a).some(m => m.label === "Treated"));
  assert.ok(!modifiers(a).some(m => m.label === "Bandaged"));
  assert.equal("system.health.woundCare" in a.updates[1], false);
});

test("legacy Bandaged/0 follows existing normalized care semantics at lock", async () => {
  const a = actor({ days: 0 });
  assert.ok(modifiers(a).some(m => m.label === "Bandaged"));
  await lock(a);
  assert.deepEqual(care(a), { care: "none", daysRemaining: 0 });
  assert.ok(modifiers(a).some(m => m.label === "Bandaged"));
});
