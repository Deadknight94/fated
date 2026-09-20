import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
await import(pathToFileURL(resolve(process.env.FOUNDRY_APP_PATH ?? resolve(process.env.LOCALAPPDATA ?? ".", "Programs/Foundry Virtual Tabletop/resources/app"), "common/server.mjs")));
const { FatedDataModel } = await import("../module/data-models.mjs");
const { adjustResource } = await import("../module/resources.mjs");

// Helper to create an actor with given attributes and power
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

test("Power cannot exceed derived maximum and cannot go below zero", async () => {
  const a = actor({ power: 2 });
  // Derived maximum = 2 + 3 + 4 = 9
  // Increment by +1 until reaching the maximum
  for (let i = 0; i < 7; i++) await adjustResource(a, "power", 1); // 2 + 7 = 9
  assert.equal(a.system.resources.power, 9);
  // Further +1 calls keep the power at the maximum
  await adjustResource(a, "power", 1);
  assert.equal(a.system.resources.power, 9);
  // Decrement by -1 until reaching zero
  for (let i = 0; i < 9; i++) await adjustResource(a, "power", -1); // 9 - 9 = 0
  assert.equal(a.system.resources.power, 0);
  // Further -1 calls keep the power at zero
  await adjustResource(a, "power", -1);
  assert.equal(a.system.resources.power, 0);
});


