import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
await import(pathToFileURL(resolve(process.env.FOUNDRY_APP_PATH ?? resolve(process.env.LOCALAPPDATA ?? ".", "Programs/Foundry Virtual Tabletop/resources/app"), "common/server.mjs")));
const { FatedDataModel } = await import("../module/data-models.mjs");
const { adjustResource } = await import("../module/resources.mjs");
const { updateDeclaration } = await import("../module/declaration/service.mjs");

function actor(data = {}) {
  const document = { type: "fated", isOwner: true, updates: [], system: new FatedDataModel({
    attributes: { heart: 2, body: 3, mind: 4 }, resources: { endurance: { value: 3 }, hope: { value: 5 }, power: 2 }, ...data
  }), getAvailableActions: () => [], async update(changes) {
    await this.system._preUpdate(changes, {}, {});
    this.updates.push(structuredClone(changes));
    this.system.updateSource(foundry.utils.expandObject(changes).system);
    this.system.prepareDerivedData();
  } };
  document.system.prepareDerivedData();
  return document;
}

test("Hope upper/lower bounds persist in source, with flat and nested updates", async () => {
  for (const value of [99, -99]) {
    for (const flat of [true, false]) {
      const a = actor();
      await a.update(flat ? { "system.resources.hope.value": value } : { system: { resources: { hope: { value } } } });
      assert.equal(a.system.toObject().resources.hope.value, Math.sign(value) * 6);
      assert.equal(a.system.currentStance, "neutral");
    }
  }
});

test("shrinking and zero Hope Limit permanently clamp both signs, even after later increases", async () => {
  for (const sign of [1, -1]) {
    const a = actor({ currentStance: "ranged", resources: { hope: { value: sign * 6 }, power: 2 } });
    await a.update({ "system.attributes.heart": 1, "system.attributes.mind": 1 });
    assert.equal(a.system.toObject().resources.hope.value, sign * 2);
    assert.equal(a.system.attributes.heart, 1);
    assert.equal(a.system.currentStance, "ranged");
    await a.update({ system: { attributes: { heart: 4, mind: 4 } } });
    assert.equal(a.system.toObject().resources.hope.value, sign * 2);
    await a.update({ "system.attributes.heart": 0, "system.attributes.mind": 0 });
    assert.equal(a.system.toObject().resources.hope.value, 0);
    await a.update({ "system.attributes.heart": 4, "system.attributes.mind": 4 });
    assert.equal(new FatedDataModel(JSON.parse(JSON.stringify(a.system.toObject()))).resources.hope.value, 0);
    assert.equal(a.updates.length, 4);
  }
});

test("legacy out-of-range Hope cannot reappear on an increase; preparation never writes", async () => {
  const a = actor({ attributes: { heart: 1, mind: 1 }, resources: { hope: { value: 6 } } });
  assert.equal(a.system.toObject().resources.hope.value, 6);
  assert.equal(a.updates.length, 0);
  await a.update({ "system.attributes.mind": 5 });
  assert.equal(a.system.toObject().resources.hope.value, 2);
});

test("simultaneous attribute and Hope edits use the proposed limit", async () => {
  const a = actor();
  await a.update({ "system.attributes.heart": 0, "system.attributes.mind": 1, "system.resources.hope.value": -9 });
  assert.equal(a.system.toObject().resources.hope.value, -1);
  assert.equal(a.updates.length, 1);
});

test("creation corrects Hope in the pending Actor source without a document update", async () => {
  let patch;
  await FatedDataModel.prototype._preCreate.call({ toObject: () => ({ attributes: { heart: 0, mind: 0 }, resources: { hope: { value: -5 } } }),
    parent: { updateSource: changes => { patch = changes; } } }, {}, {}, {});
  assert.deepEqual(patch, { "system.resources.hope.value": 0 });
});

test("resource step controls write real Actor paths and respect all bounds", async () => {
  const a = actor();
  for (const resource of ["endurance", "hope", "power"]) {
    await adjustResource(a, resource, 1);
    await adjustResource(a, resource, -1);
  }
  assert.equal(a.system.toObject().resources.endurance.value, 3);
  assert.equal(a.system.toObject().resources.hope.value, 5);
  assert.equal(a.system.toObject().resources.power, 2);
  assert.equal(a.updates.length, 6);
  assert.deepEqual(Object.keys(a.updates[0]), ["system.resources.endurance.value"]);
  await a.update({ "system.resources.endurance.value": 5, "system.resources.hope.value": 6, "system.resources.power": 0 });
  assert.equal(await adjustResource(a, "endurance", 1), false);
  assert.equal(await adjustResource(a, "hope", 1), false);
  assert.equal(await adjustResource(a, "power", -1), false);
  await a.update({ "system.resources.hope.value": -6, "system.resources.endurance.value": 0 });
  assert.equal(await adjustResource(a, "hope", -1), false);
  assert.equal(await adjustResource(a, "endurance", -1), false);
});

test("read-only, NPC, unsupported resource and invalid step paths cannot mutate", async () => {
  const a = actor();
  const before = a.system.toObject();
  a.isOwner = false;
  for (const resource of ["endurance", "hope", "power"]) assert.equal(await adjustResource(a, resource, 1), false);
  await assert.rejects(updateDeclaration(a, 0, { type: "stance", stance: "ranged" }), /owner/);
  a.isOwner = true;
  assert.equal(await adjustResource(a, "load", 1), false);
  assert.equal(await adjustResource(a, "power", 2), false);
  a.type = "npc";
  assert.equal(await adjustResource(a, "power", 1), false);
  assert.deepEqual(a.system.toObject(), before);
  assert.equal(a.updates.length, 0);
});

test("current stance defaults, validates and survives source round trips; fresh drafts use it", () => {
  assert.equal(new FatedDataModel().currentStance, "neutral");
  for (const currentStance of ["neutral", "offensive", "defensive", "ranged"]) {
    const a = actor({ currentStance });
    assert.equal(a.system.declaration.stance, currentStance);
    assert.equal(new FatedDataModel(JSON.parse(JSON.stringify(a.system.toObject()))).currentStance, currentStance);
  }
  assert.throws(() => new FatedDataModel({ currentStance: "invalid" }, { strict: true }));
});

test("declaration edits stay separate; lock commits atomically; clear preserves current stance and resources", async () => {
  globalThis.game ??= { user: { id: "test" } };
  const a = actor({ currentStance: "defensive" });
  const resources = a.system.toObject().resources;
  await updateDeclaration(a, 0, { type: "stance", stance: "offensive" });
  assert.equal(a.system.currentStance, "defensive");
  await updateDeclaration(a, 1, { type: "add", kind: "movement" });
  await updateDeclaration(a, 2, { type: "lock" });
  assert.equal(a.system.currentStance, "offensive");
  assert.deepEqual(Object.keys(a.updates.at(-1)), ["system.declaration", "system.currentStance"]);
  const snapshot = a.system.declaration.snapshot.toObject();
  await a.update({ "system.currentStance": "ranged" });
  assert.deepEqual(a.system.declaration.snapshot.toObject(), snapshot);
  await updateDeclaration(a, 3, { type: "clear" });
  assert.equal(a.system.currentStance, "ranged");
  assert.equal(a.system.declaration.stance, "ranged");
  assert.equal(a.system.declaration.snapshot, null);
  assert.deepEqual(a.system.toObject().resources, resources);
});

test("Load derives only from physical owned Items, and is not an adjustable resource", async () => {
  globalThis.Actor ??= class { prepareDerivedData() {} };
  globalThis.Item ??= class {};
  const { FatedActor } = await import("../module/documents.mjs");
  const a = { type: "fated", system: { load: 999, attributes: { body: 2, mind: 3 }, currentStance: "neutral" }, items: ["weapon", "armor", "equipment", "feature", "weaponProficiency"].map(type => ({ type, system: { load: 2 } })) };
  FatedActor.prototype.prepareDerivedData.call(a);
  assert.equal(a.system.load, 6);
  assert.equal(a.system.defense, 5);
});

test("an illegal declaration cannot commit current stance or change resources", async () => {
  const a = actor({ currentStance: "defensive", declaration: { stance: "offensive", entries: [{ id: "a", kind: "action", itemId: "missing", actionId: "missing" }] } });
  const before = a.system.toObject();
  await assert.rejects(updateDeclaration(a, 0, { type: "lock" }), /missing|no longer/i);
  assert.deepEqual(a.system.toObject(), before);
  assert.equal(a.updates.length, 0);
});
