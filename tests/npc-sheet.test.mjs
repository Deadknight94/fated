import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
await import(pathToFileURL(resolve(process.env.FOUNDRY_APP_PATH ?? resolve(process.env.LOCALAPPDATA ?? ".", "Programs/Foundry Virtual Tabletop/resources/app"), "common/server.mjs")));
await import("./helpers/client-applications.mjs");
foundry.applications.sheets.ActorSheetV2.prototype._prepareContext = async () => ({});
globalThis.Actor = class {};
globalThis.Item = class {};
globalThis.game = { user: { isGM: true }, i18n: { localize: key => key, format: key => key } };
const { NpcDataModel, EquipmentDataModel } = await import("../module/data-models.mjs");
const { FatedActor, FatedItem } = await import("../module/documents.mjs");
const { NpcActorSheet, FatedActorSheet } = await import("../module/sheets/actor-sheets.mjs");

test("NPC Defense is independent, nonnegative, editable and serializable; Shadow is absent", () => {
  assert.equal(Object.hasOwn(NpcDataModel.defineSchema(), "shadow"), false);
  assert.equal(new NpcDataModel().defense, 0);
  for (const defense of [0, 1, 12, 1000000]) {
    const npc = new NpcDataModel({ defense, resilience: { value: 3, max: 7 } });
    npc.prepareDerivedData();
    assert.equal(npc.defense, defense);
    assert.deepEqual(new NpcDataModel(JSON.parse(JSON.stringify(npc))).toObject(), npc.toObject());
    npc.updateSource({ defense: defense + 1 });
    assert.equal(npc.defense, defense + 1);
    assert.deepEqual(npc.resilience, { value: 3, max: 7 });
  }
  assert.throws(() => new NpcDataModel({ defense: "invalid" }, { strict: true }));
  const negative = new NpcDataModel({ defense: -1 });
  assert.equal(negative.defense, 0);
  assert.equal(Number.isInteger(new NpcDataModel({ defense: 2.7 }).defense), true);
});

test("NPC Resilience retains its existing clamp and stored maximum", () => {
  for (const [value, max, expected] of [[0, 0, 0], [3, 7, 3], [9, 7, 7]]) {
    const npc = new NpcDataModel({ resilience: { value, max }, defense: 4 });
    npc.prepareDerivedData();
    assert.deepEqual(npc.resilience, { value: expected, max });
    assert.equal(npc.defense, 4);
  }
});

test("NPC sheet presents owned enabled Actions with stable Item provenance and no Fated data", async () => {
  const items = ["first", "second"].map(id => ({ id, uuid: `Actor.npc.Item.${id}`, name: "Same name", type: "equipment", img: "item.png",
    system: new EquipmentDataModel({ actions: [
      { id: "shared", name: id, classification: "main", rollRequirement: "required", attackType: "ranged", range: { max: 3 }, rules: "Configured rules" },
      { name: "Disabled", enabled: false }
    ] }), getAvailableActions: FatedItem.prototype.getAvailableActions }));
  items.contents = [...items];
  items.get = id => items.find(item => item.id === id);
  const actor = { type: "npc", isOwner: true, system: new NpcDataModel(), items,
    getAvailableActions: FatedActor.prototype.getAvailableActions };
  const before = items.map(item => item.system.toObject());
  const sheet = new NpcActorSheet({ document: actor });
  const context = await sheet._prepareContext({});
  assert.equal(context.actions.length, 2);
  assert.deepEqual(context.actions.map(action => action.source.itemId), ["first", "second"]);
  assert.deepEqual(context.actions.map(action => action.source.itemUuid), items.map(item => item.uuid));
  assert.equal(context.actions[0].rules, "Configured rules");
  assert.ok(context.actions[0].rangeLabel.includes("3"));
  assert.ok(context.actions[0].rollLabel);
  assert.deepEqual(context.system.attributes, { heart: 0, body: 0, mind: 0 });
  assert.equal(context.system.resources, undefined);
  assert.deepEqual(items.map(item => item.system.toObject()), before);
  let opened = false;
  items[1].sheet = { render: () => { opened = true; } };
  NpcActorSheet.openNpcItem.call(sheet, null, { dataset: { itemId: "second" } });
  assert.equal(opened, true);
  sheet.submit = async () => {};
  sheet.render = async () => {};
  await NpcActorSheet.selectNpcSection.call(sheet, null, { dataset: { section: "actions" } });
  assert.equal((await sheet._prepareContext({})).npcActions, true);
  assert.equal((await sheet._prepareContext({})).npcStats, false);
});

test("NPC primary attributes default to zero and accept independent integer updates", () => {
  const npc = new NpcDataModel({ resilience: { value: 3, max: 8 }, defense: 6 });
  assert.deepEqual(npc.attributes, { heart: 0, body: 0, mind: 0 });
  for (const value of [0, 1, 99]) {
    npc.updateSource({ attributes: { heart: value, body: value + 1, mind: value + 2 } });
    npc.prepareDerivedData();
    assert.deepEqual(npc.attributes, { heart: value, body: value + 1, mind: value + 2 });
    assert.deepEqual(npc.resilience, { value: 3, max: 8 });
    assert.equal(npc.defense, 6);
    assert.deepEqual(new NpcDataModel(npc.toObject()).toObject(), npc.toObject());
  }
  assert.deepEqual(Object.keys(npc.toObject()).sort(), ["attributes", "defense", "description", "resilience"]);
});

test("NPC attribute schema rejects negative and fractional values before Foundry cleaning", () => {
  const fields = NpcDataModel.defineSchema().attributes.fields;
  for (const key of ["heart", "body", "mind"]) {
    assert.equal(fields[key].required, true);
    assert.equal(fields[key].nullable, false);
    assert.ok(fields[key].validate(-1));
    assert.ok(fields[key].validate(1.5));
    assert.equal(fields[key].validate(0), undefined);
    // NumberField's normal cleaning clamps negative input to its declared minimum.
    assert.equal(new NpcDataModel({ attributes: { [key]: -1 } }).attributes[key], 0);
  }
});

for (const Sheet of [NpcActorSheet, FatedActorSheet]) {
  test(`${Sheet.name} removes only the requested owned Item using the shared handler`, async () => {
    assert.equal(Sheet.DEFAULT_OPTIONS.actions.removeItem, NpcActorSheet.removeItem);
    const worldItem = { id: "first", system: { actions: [{ name: "World action" }] } };
    const worldBefore = structuredClone(worldItem);
    const items = ["first", "second"].map(id => ({ id, uuid: `Actor.npc.Item.${id}`, name: id, type: "equipment",
      system: new EquipmentDataModel({ actions: [{ name: id }] }), getAvailableActions: FatedItem.prototype.getAvailableActions }));
    items.contents = [...items];
    const siblingBefore = items[1].system.toObject();
    const calls = [];
    const actor = { type: "npc", isOwner: true, items, system: new NpcDataModel(), getAvailableActions: FatedActor.prototype.getAvailableActions,
      async deleteEmbeddedDocuments(type, ids) {
        calls.push([type, ids]);
        assert.equal(type, "Item");
        items.splice(items.findIndex(item => item.id === ids[0]), 1);
        items.contents = [...items];
      }
    };
    const sheet = new NpcActorSheet({ document: actor });
    sheet._npcSection = "items";
    sheet.submit = async () => { calls.push("submit"); };
    await Sheet.DEFAULT_OPTIONS.actions.removeItem.call(sheet, null, { dataset: { itemId: "first" } });
    assert.deepEqual(calls, ["submit", ["Item", ["first"]]]);
    assert.deepEqual(items.map(item => item.id), ["second"]);
    assert.deepEqual(items[0].system.toObject(), siblingBefore);
    assert.deepEqual(worldItem, worldBefore);
    const context = await sheet._prepareContext({});
    assert.equal(context.npcItems, true);
    assert.deepEqual(context.actions.map(action => action.source.itemId), ["second"]);
    assert.deepEqual(NpcActorSheet.PARTS.main.scrollable, [".npc-content"]);
  });

  test(`${Sheet.name} rejects removal through non-editable sheets and ignores missing IDs`, async () => {
    let calls = 0;
    const sheet = { isEditable: false, submit: async () => { calls++; },
      document: { isOwner: false, deleteEmbeddedDocuments: async () => { calls++; } } };
    await Sheet.DEFAULT_OPTIONS.actions.removeItem.call(sheet, null, { dataset: { itemId: "first" } });
    assert.equal(calls, 0);
    sheet.isEditable = true;
    await Sheet.DEFAULT_OPTIONS.actions.removeItem.call(sheet, null, { dataset: {} });
    assert.equal(calls, 1);
  });
}
