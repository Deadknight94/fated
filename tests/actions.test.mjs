import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

// Uses Foundry's actual field validation and serialization; no mock DataFields.
const app = process.env.FOUNDRY_APP_PATH
  ?? resolve(process.env.LOCALAPPDATA ?? ".", "Programs/Foundry Virtual Tabletop/resources/app");
await import(pathToFileURL(resolve(app, "common/server.mjs")));
const { ActionDataModel, migrateLegacyAction } = await import("../module/actions/action-model.mjs");
const { FatedDataModel, NpcDataModel, WeaponDataModel, EquipmentDataModel, WeaponProficiencyDataModel } = await import("../module/data-models.mjs");
const { calculateAction, calculateValue, getItemActions, getActorActions } = await import("../module/actions/actions.mjs");
const { readActionForm } = await import("../module/sheets/action-form.mjs");

test("unknown rules stay unspecified and model round trips preserve multiple Actions", () => {
  const item = new WeaponDataModel({ actions: [{ name: "First" }, { name: "Second", classification: "free" }] });
  assert.equal(item.actions.length, 2);
  assert.notEqual(item.actions[0].id, item.actions[1].id);
  const action = item.actions[0];
  assert.equal(action.successDice.base, null);
  assert.equal(action.successDice.source, "");
  assert.equal(action.successThreshold, 4);
  assert.equal(action.multiActionEligible, null);
  assert.equal(action.range.max, null);
  assert.deepEqual(action.allowedStances, []);
  assert.deepEqual(new WeaponDataModel(JSON.parse(JSON.stringify(item))).toObject(), item.toObject());
});

test("legacy Action migration is loss-aware and never recreates deliberately removed Actions", () => {
  const legacy = { action: { enabled: true, name: "Legacy", type: "main", stance: "ranged", range: { min: 0, max: 3 } } };
  const item = new EquipmentDataModel(structuredClone(legacy));
  assert.equal(item.actions[0].name, "Legacy");
  assert.equal(item.actions[0].classification, "main");
  assert.deepEqual(item.actions[0].allowedStances, ["ranged"]);
  assert.equal(item.actions[0].range.max, 3);
  assert.equal(item.actions[0].successThreshold, 4);
  assert.deepEqual(new EquipmentDataModel({ ...legacy, actions: [] }).actions, []);
  const disabled = new EquipmentDataModel({ action: { enabled: false, name: "Disabled configuration" } });
  assert.equal(disabled.actions[0].enabled, false);
  assert.equal(disabled.actions[0].name, "Disabled configuration");
  assert.equal(disabled.actions[0].classification, "");
  assert.equal(disabled.actions[0].range.min, null);
  assert.equal(disabled.actions[0].range.max, null);
  const migrated = migrateLegacyAction(structuredClone(legacy));
  const firstMigration = structuredClone(migrated);
  for (let i = 0; i < 5; i++) migrateLegacyAction(migrated);
  assert.deepEqual(migrated, firstMigration);
  assert.deepEqual(new EquipmentDataModel({}).actions, []);
  const passive = new EquipmentDataModel({ action: { enabled: true, type: "passive" } });
  assert.equal(passive.actions[0].classification, "");
  assert.match(passive.actions[0].rules, /passive/);
  assert.deepEqual(new EquipmentDataModel(item.toObject()).toObject(), item.toObject());
});

test("invalid Action records are rejected by Foundry", () => {
  for (const data of [{ classification: "attack" }, { successThreshold: "invalid" },
    { allowedStances: ["invented"] }, { range: { min: 4, max: 1 } }]) {
    assert.throws(() => new ActionDataModel(data, { strict: true }));
  }
  assert.throws(() => new EquipmentDataModel({ actions: [{ id: "same" }, { id: "same" }] }, { strict: true }));
});

test("pool and threshold adjustments are independently traceable and recomputed without side effects", () => {
  const action = new ActionDataModel({ successDice: { source: "fixed", base: 4 }, successThreshold: 4,
    modifiers: { successDice: [{ label: "Equipment", value: 1 }], successThreshold: [{ label: "Example", value: 1 }] } }).toObject();
  const before = structuredClone(action);
  const extra = { successDice: [{ label: "Condition example", value: -1 }], successThreshold: [{ label: "Other example", value: -1 }] };
  assert.equal(calculateAction(action, {}, extra).successDice.total, 4);
  assert.equal(calculateAction(action, {}, extra).successThreshold.total, 4);
  assert.equal(calculateAction(action).successDice.total, 5);
  assert.equal(calculateAction(action).successThreshold.total, 5);
  assert.deepEqual(action, before);
  assert.equal(calculateValue(0).total, 0);
  assert.equal(calculateValue(null, [{ value: 1 }]).total, null);
  assert.equal(calculateValue(4, [{ value: null }]).complete, false);
  assert.equal(calculateValue(0, [{ value: -1 }]).total, -1); // No invented floor.
  action.successDice.source = "heart";
  assert.equal(calculateAction(action, { heart: 2 }).successDice.total, 3);
});

test("owned Items expose detached Actions with live source provenance", () => {
  const item = { id: "item", uuid: "Actor.actor.Item.item", type: "feature", name: "Feature",
    system: new EquipmentDataModel({ actions: [{ name: "Enabled", modifiers: {
      successDice: [{ label: "Configured adjustment", value: 1 }]
    } }, { name: "Hidden", enabled: false }] }) };
  item.getAvailableActions = () => getItemActions(item);
  const actions = getActorActions({ items: [item] });
  assert.equal(actions.length, 1);
  assert.equal(actions[0].source.itemUuid, item.uuid);
  assert.equal(actions[0].modifiers.successDice[0].source.actionId, actions[0].id);
  assert.equal(actions[0].modifiers.successDice[0].source.itemUuid, item.uuid);
  const modifierId = actions[0].modifiers.successDice[0].id;
  assert.equal(item.getAvailableActions()[0].modifiers.successDice[0].id, modifierId);
  actions[0].name = "Changed";
  actions[0].modifiers.successDice[0].value = 99;
  assert.equal(item.system.actions[0].name, "Enabled");
  assert.equal(item.system.actions[0].modifiers.successDice[0].value, 1);
  item.uuid = "Actor.other.Item.copy";
  assert.equal(item.getAvailableActions()[0].source.itemUuid, item.uuid);
  assert.equal(item.getAvailableActions()[0].modifiers.successDice[0].source.itemUuid, item.uuid);
  assert.equal(new WeaponProficiencyDataModel({ actions: [{ name: "Training" }] }).actions.length, 1);
});

test("indexed form edits retain sibling Actions and can clear a modifier", () => {
  const current = new EquipmentDataModel({ actions: [{ name: "A", modifiers: { successDice: [{ value: 2 }] } }, { name: "B" }] }).toObject().actions;
  const submitted = { 0: { name: "Edited", successThreshold: "0", multiActionEligible: "false",
    stances: { neutral: true, ranged: false }, modifiers: { successDice: { 0: { value: null } } } } };
  const parsed = readActionForm(submitted, current);
  assert.equal(parsed[0].successThreshold, 4); // Old editable-base input cannot override the universal base.
  assert.equal(parsed[0].multiActionEligible, false);
  assert.equal(parsed[0].modifiers.successDice[0].value, null);
  assert.deepEqual(parsed[0].allowedStances, ["neutral"]);
  assert.deepEqual(parsed[1], current[1]);
  assert.equal(current[0].name, "A");
  assert.doesNotThrow(() => new EquipmentDataModel({ actions: parsed }, { strict: true }));
});

test("universal Threshold resolves absent, undefined, null and redundant 4 without configuration", () => {
  for (const stored of [{}, { successThreshold: undefined }, { successThreshold: null }, { successThreshold: 4 }]) {
    const a = new ActionDataModel({ successDice: { source: "fixed", base: 3 }, ...stored }).toObject();
    const threshold = calculateAction(a).successThreshold;
    assert.equal(threshold.base, 4);
    assert.equal(threshold.total, 4);
    assert.equal(threshold.complete, true);
    assert.equal(threshold.reviewIssue, null);
    delete a.successThreshold;
    assert.equal(calculateAction(a).successThreshold.total, 4);
  }
});

test("universal Threshold plus configured and external modifiers remains traceable", () => {
  const a = new ActionDataModel({ modifiers: { successThreshold: [{ id: "specific", label: "Action deviation", value: -1 }] } }).toObject();
  const result = calculateAction(a, {}, { successThreshold: [{ id: "other", label: "Other modifier", value: 2, source: { type: "test" } }] });
  assert.equal(result.successThreshold.base, 4);
  assert.equal(result.successThreshold.total, 5);
  assert.deepEqual(result.successThreshold.modifiers.map(m => m.id), ["specific", "other"]);
  assert.equal(result.successThreshold.modifiers[1].source.type, "test");
});

test("non-4 legacy Thresholds remain stored and reported, even through unrelated form edits", () => {
  for (const value of [0, 8]) {
    const a = new ActionDataModel({ successThreshold: value }).toObject();
    const parsed = readActionForm({ 0: { name: "Edited" } }, [a])[0];
    assert.equal(parsed.successThreshold, value);
    const reloaded = new ActionDataModel(JSON.parse(JSON.stringify(parsed))).toObject();
    assert.equal(reloaded.successThreshold, value);
    assert.equal(calculateAction(reloaded).successThreshold.base, 4);
    assert.match(calculateAction(reloaded).successThreshold.reviewIssue, /requires review/);
    assert.deepEqual(reloaded.modifiers.successThreshold, []);
  }
});

test("existing Fated and NPC derived resources are preserved", () => {
  const actor = new FatedDataModel({ attributes: { heart: 2, body: 3, mind: 4 }, resources: { endurance: { value: 4 }, hope: { value: -2 }, power: 3 } });
  const source = actor.toObject();
  actor.prepareDerivedData();
  assert.equal(actor.resources.endurance.max, 5);
  assert.equal(actor.resources.hope.max, 6);
  assert.equal(actor.resources.hope.value, -2);
  assert.equal(actor.resources.power, 3);
  assert.deepEqual(actor.toObject(), source);
  const npc = new NpcDataModel({ resilience: { value: 3, max: 5 }, defense: 2 });
  npc.prepareDerivedData();
  assert.equal(npc.resilience.value, 3);
  assert.equal(npc.defense, 2);
});
