import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
await import(pathToFileURL(resolve(process.env.FOUNDRY_APP_PATH ?? resolve(process.env.LOCALAPPDATA ?? ".", "Programs/Foundry Virtual Tabletop/resources/app"), "common/server.mjs")));
const { FatedDataModel } = await import("../module/data-models.mjs");
const { longRest } = await import("../module/rest/long-rest.mjs");

function actor(data = {}) {
  const document = {
    type: "fated",
    isOwner: true,
    updates: [],
    system: new FatedDataModel(foundry.utils.mergeObject({
      attributes: { heart: 2, body: 3, mind: 4 },
      resources: { endurance: { value: 3 }, hope: { value: 5 }, power: 2 },
    }, data, { inplace: false })),
    getAvailableActions: () => [],
    async update(changes) {
      await this.system._preUpdate(changes, {}, {});
      this.updates.push(structuredClone(changes));
      this.system.updateSource(foundry.utils.expandObject(changes).system);
      this.system.prepareDerivedData();
    },
  };
  document.system.prepareDerivedData();
  return document;
}

async function restAndCount(a, opts = {}) {
  const res = await longRest(a, opts);
  return { res, updates: a.updates.length };
}

test("Long Rest restores Endurance by Body, capped at max", async () => {
  const a = actor({ resources: { endurance: { value: 3 } } }); // max 5
  const { res, updates } = await restAndCount(a);
  assert.equal(res, true);
  assert.equal(a.system.resources.endurance.value, 5);
  assert.equal(updates, 1);
  // Max cap
  const a2 = actor({ resources: { endurance: { value: 5 }, hope: { value: 6 }, power: 0 } }); // all resources at final values
  const { res: r2, updates: u2 } = await restAndCount(a2);
  assert.equal(r2, true);
  assert.equal(a2.system.resources.endurance.value, 5);
  assert.equal(u2, 0);
});

test("Long Rest restores +1 Hope, capped at positive limit", async () => {
  const a = actor({ resources: { hope: { value: 5 } } }); // limit 6
  const { updates } = await restAndCount(a);
  assert.equal(a.system.resources.hope.value, 6);
  assert.equal(updates, 1);
  // Already at limit - set all resources to final values to expect 0 updates
  const a2 = actor({ resources: { endurance: { value: 5 }, hope: { value: 6 }, power: 0 } });
  const { updates: u2 } = await restAndCount(a2);
  assert.equal(a2.system.resources.hope.value, 6);
  assert.equal(u2, 0);
});

test("Long Rest resets Power to 0", async () => {
  const a = actor({ resources: { power: 3 } });
  const { updates } = await restAndCount(a);
  assert.equal(a.system.resources.power, 0);
  assert.equal(updates, 1);
});

test("All three changes occur in one Actor update", async () => {
  const a = actor({ resources: { endurance: { value: 3 }, hope: { value: 5 }, power: 2 } });
  const { updates } = await restAndCount(a);
  assert.deepEqual(a.updates[0], {
    "system.resources.endurance.value": 5,
    "system.resources.hope.value": 6,
    "system.resources.power": 0,
  });
  assert.equal(updates, 1);
});

test("Resources already at final values produce no update", async () => {
  const a = actor({ resources: { endurance: { value: 5 }, hope: { value: 6 }, power: 0 } });
  const { updates } = await restAndCount(a);
  assert.equal(updates, 0);
});

test("Negative Hope increases toward zero by 1", async () => {
  const a = actor({ resources: { hope: { value: -2 } } });
  const { updates } = await restAndCount(a);
  assert.equal(a.system.resources.hope.value, -1);
  assert.equal(updates, 1);
});

test("Hope capped at positive limit", async () => {
  const a = actor({ resources: { endurance: { value: 5 }, hope: { value: 6 } } }); // limit 6
  const { updates } = await restAndCount(a);
  assert.equal(a.system.resources.hope.value, 6);
  assert.equal(updates, 1); // power still changes even though hope is capped
});

test("Terminal wound severity prevents Long Rest", async () => {
  const a = actor({ health: { woundSeverity: 4 } });
  const { res, updates } = await restAndCount(a);
  assert.equal(res, false);
  assert.equal(updates, 0);
});

test("Read-only actor cannot mutate", async () => {
  const a = actor();
  a.isOwner = false;
  const before = a.system.toObject();
  const { res, updates } = await restAndCount(a);
  assert.equal(res, false);
  assert.equal(updates, 0);
  assert.deepEqual(a.system.toObject(), before);
});

test("Unsupported actor type rejected", async () => {
  const a = { type: "npc", isOwner: true, updates: [], system: new FatedDataModel(), getAvailableActions: () => [], update: async () => {} };
  const res = await longRest(a);
  assert.equal(res, false);
});
