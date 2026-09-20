import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
await import(pathToFileURL(resolve(process.env.FOUNDRY_APP_PATH ?? resolve(process.env.LOCALAPPDATA ?? ".", "Programs/Foundry Virtual Tabletop/resources/app"), "common/server.mjs")));
const { FatedDataModel } = await import("../module/data-models.mjs");

/**
 * Helper to create a minimal Actor-like object for testing lifecycle logic.
 * It mimics the parts of an Actor that the data‑model uses during persistence.
 */
function actor({ heart = 2, body = 3, mind = 4, power = 2 } = {}) {
  const data = {
    type: "fated",
    isOwner: true,
    updates: [],
    system: new FatedDataModel({
      attributes: { heart, body, mind },
      resources: { endurance: { value: 5 }, hope: { value: 3 }, power },
    }),
    getAvailableActions: () => [],
    async update(changes) {
      await this.system._preUpdate(changes, {}, {});
      this.updates.push(structuredClone(changes));
      this.system.updateSource(foundry.utils.expandObject(changes).system);
      this.system.prepareDerivedData();
    },
  };
  data.system.prepareDerivedData();
  return data;
}

test("Power clamped on model persistence and attribute changes", async () => {
  const a = actor();
  // Exceed max
  await a.update({ "system.resources.power": 10 });
  assert.equal(a.system.resources.power, 9, "Clamped to derived max 9");
  // Reduce attributes, new max 6
  await a.update({ "system.attributes.heart": 1, "system.attributes.body": 1 });
  await a.update({ "system.resources.power": 10 });
  assert.equal(a.system.resources.power, 6, "Clamped to new max 6");
  // Simultaneous proposed changes
  await a.update({
    "system.attributes.heart": 0,
    "system.attributes.body": 0,
    "system.resources.power": 5,
  });
  assert.equal(a.system.resources.power, 4, "Clamped to simultaneous max 4");
});

test("Power cannot go below zero", async () => {
  const a = actor({ power: 2 });
  await a.update({ "system.resources.power": -5 });
  assert.equal(a.system.resources.power, 0, "Clamped to zero");
});

test("Unrelated updates preserve valid Power", async () => {
  const a = actor();
  const originalPower = a.system.resources.power;
  await a.update({ "system.attributes.heart": 1 });
  assert.equal(a.system.resources.power, originalPower, "Power unchanged on unrelated update");
});

test("Actor creation normalizes invalid Power", async () => {
  const a = actor({ power: 10 }); // start above max
  // Trigger the clamping logic via an update
  await a.update({ "system.resources.power": 10 });
  assert.equal(a.system.resources.power, 9, "Initial power clamped on creation via update");
});
