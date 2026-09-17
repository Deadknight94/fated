import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
await import(pathToFileURL(resolve(process.env.FOUNDRY_APP_PATH, "common/server.mjs")));
const { ArmorDataModel, EquipmentDataModel, WeaponDataModel } = await import("../module/data-models.mjs");
const { calculateDefense } = await import("../module/defense.mjs");
const { setEquipped, wornArmorIssue } = await import("../module/equipment.mjs");
function fixture() {
  const actor = { type: "fated", system: { attributes: { body: 2, mind: 3 }, currentStance: "neutral" }, items: [] };
  const item = { id: "armor1", uuid: "Actor.test.Item.armor1", name: "Chainmail", type: "armor", parent: actor,
    isOwner: true, system: new ArmorDataModel({ armor: 3, load: 2 }), updates: [],
    async update(changes) {
      const issue = wornArmorIssue(this, changes["system.equipped"]);
      if (issue) throw new Error(issue);
      this.updates.push(changes); this.system.updateSource(foundry.utils.expandObject(changes).system);
    } };
  actor.items.push(item); return { actor, item };
}
test("equipment state defaults false and Armor value is nonnegative structured data", () => {
  for (const Model of [ArmorDataModel, EquipmentDataModel, WeaponDataModel]) assert.equal(new Model({}).equipped, false);
  assert.equal(new ArmorDataModel({}).armor, 0);
  assert.equal(new ArmorDataModel({ armor: -2 }).armor, 0);
});
test("unworn Armor contributes nothing; wearing persists and separately traces Armor alongside stance", async () => {
  const { actor, item } = fixture(); assert.equal(calculateDefense(actor).total, 5);
  await setEquipped(item, true);
  assert.equal(item.updates.length, 1); assert.equal(item.system.toObject().equipped, true);
  actor.system.currentStance = "defensive";
  const d = calculateDefense(actor); assert.equal(d.total, 9);
  assert.equal(d.modifiers[1].label, "Chainmail (Worn Armor)");
  assert.equal(d.modifiers[1].source.itemUuid, item.uuid); assert.equal(d.modifiers[1].value, 3);
  await setEquipped(item, false); assert.equal(calculateDefense(actor).total, 6);
  assert.equal(item.system.load, 2);
});
test("Armor and offensive stance preserve raw breakdown and effective Defense floor", async () => {
  const { actor, item } = fixture(); actor.system.attributes = { body: 0, mind: 0 };
  actor.system.currentStance = "offensive"; await setEquipped(item, true);
  item.system.updateSource({ armor: 0 });
  const d = calculateDefense(actor); assert.equal(d.raw, -1); assert.equal(d.total, 1);
  assert.equal(d.modifiers.length, 2);
});
test("second Worn Armor is rejected without swapping; explicit unwear allows the next", async () => {
  const { actor, item } = fixture(); await setEquipped(item, true);
  const second = { ...item, id: "armor2", name: "Leather Tunic", system: new ArmorDataModel({ armor: 1 }), updates: [] };
  actor.items.push(second);
  await assert.rejects(setEquipped(second, true), /Chainmail is already Worn/);
  assert.equal(item.system.equipped, true); assert.equal(second.system.equipped, false); assert.equal(second.updates.length, 0);
  await setEquipped(item, false); await setEquipped(second, true); assert.equal(calculateDefense(actor).total, 6);
});
test("read-only users cannot toggle and non-Armor equipment does not add Defense", async () => {
  const { actor, item } = fixture(); item.isOwner = false;
  await assert.rejects(setEquipped(item, true), /cannot update/); assert.equal(item.updates.length, 0);
  actor.items.push({ type: "equipment", system: { equipped: true, armor: 99 } });
  assert.equal(calculateDefense(actor).total, 5);
});
test("Armor lifecycle rejects direct update/create bypasses when another Armor is worn", async () => {
  const { actor, item } = fixture(); await setEquipped(item, true);
  const second = { ...item, id: "armor2", name: "Leather Tunic" };
  const model = new ArmorDataModel({ armor: 1 });
  Object.defineProperty(model, "parent", { value: second });
  await assert.rejects(model._preUpdate({ "system.equipped": true }, {}, {}), /already Worn/);
  model.updateSource({ equipped: true });
  await assert.rejects(model._preCreate({}, {}, {}), /already Worn/);
});
