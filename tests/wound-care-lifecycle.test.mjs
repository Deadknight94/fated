import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

await import(pathToFileURL(resolve(process.env.FOUNDRY_APP_PATH ?? resolve(process.env.LOCALAPPDATA ?? ".", "Programs/Foundry Virtual Tabletop/resources/app"), "common/server.mjs")));

const { FatedDataModel } = await import("../module/data-models.mjs");

function actor(data = {}) {
  const system = foundry.utils.mergeObject(
    {
      attributes: { heart: 2, body: 3, mind: 4 },
      resources: { endurance: { value: 4 }, hope: { value: 0 }, power: 3 },
      health: { woundSeverity: 0, stabilized: false, dead: false, woundCare: { care: "none", daysRemaining: 0 } },
    },
    data,
    { inplace: false }
  );
  const a = {
    id: "test",
    uuid: "Actor.test",
    type: "fated",
    isOwner: true,
    user: { isGM: false },
    updates: [],
    system: new FatedDataModel(system),
    getAvailableActions: () => [],
    async update(changes) {
      await this.system._preUpdate(changes, {}, this.user);
      this.updates.push(structuredClone(changes));
      this.system.updateSource(foundry.utils.expandObject(changes).system);
      this.system.prepareDerivedData();
    },
  };
  a.system.prepareDerivedData();
  return a;
}

// 1. creation normalizes incompatible wound care

test("creation normalizes incompatible wound care", async () => {
  const source = foundry.utils.mergeObject({
    attributes: { heart: 2, body: 3, mind: 4 },
    resources: { endurance: { value: 4 }, hope: { value: 0 }, power: 3 },
    health: { woundSeverity: 0, woundCare: { care: "bandaged", daysRemaining: 3 } },
  }, {}, { inplace: false });
  const patches = [];
  await FatedDataModel.prototype._preCreate.call({
    toObject: () => source,
    parent: { updateSource: patch => patches.push(patch) }
  }, {}, {}, {});
  const patch = patches.find(p => "system.health.woundCare.care" in p || "system.health.woundCare.daysRemaining" in p);
  assert.ok(patch, "woundCare patch not found");
  const care = patch["system.health.woundCare.care"]; const days = patch["system.health.woundCare.daysRemaining"];
  assert.equal(care, "none");
  assert.equal(days, 0);
});

// 2. creation preserves compatible wound care

test("creation preserves compatible wound care", async () => {
  const source = foundry.utils.mergeObject({
    attributes: { heart: 2, body: 3, mind: 4 },
    resources: { endurance: { value: 4 }, hope: { value: 0 }, power: 3 },
    health: { woundSeverity: 1, woundCare: { care: "bandaged", daysRemaining: 3 } },
  }, {}, { inplace: false });
  const patches = [];
  await FatedDataModel.prototype._preCreate.call({
    toObject: () => source,
    parent: { updateSource: patch => patches.push(patch) }
  }, {}, {}, {});
  const woundPatch = patches.find(p => "system.health.woundCare" in p);
  assert.ok(!woundPatch, "woundCare patch should not be present for compatible care");
  // Ensure source woundCare remains unchanged
  assert.equal(source.health.woundCare.care, "bandaged");
  assert.equal(source.health.woundCare.daysRemaining, 3);
});

// 3. severity change invalidates existing care

test("severity change invalidates existing care", async () => {
  const a = actor({ health: { woundSeverity: 2, woundCare: { care: "treated", daysRemaining: 3 } } });
  await a.update({ "system.health.woundSeverity": 1 });
  const w = a.system.health.woundCare;
  assert.equal(w.care, "none");
  assert.equal(w.daysRemaining, 0);
});

// 4. partial woundCare update uses existing sibling values

test("partial woundCare update uses existing sibling values", async () => {
  const a = actor({ health: { woundSeverity: 1, woundCare: { care: "bandaged", daysRemaining: 3 } } });
  await a.update({ "system.health.woundCare.daysRemaining": 2 });
  const w = a.system.health.woundCare;
  assert.equal(w.care, "bandaged");
  assert.equal(w.daysRemaining, 2);
});

// 5. care none forces daysRemaining 0

test("care none forces daysRemaining 0", async () => {
  const a = actor({ health: { woundSeverity: 0, woundCare: { care: "none", daysRemaining: 0 } } });
  await a.update({ "system.health.woundCare.care": "bandaged", "system.health.woundCare.daysRemaining": 3 });
  const w = a.system.health.woundCare;
  assert.equal(w.care, "none");
  assert.equal(w.daysRemaining, 0);
});

// 6. incompatible direct care update normalizes to none/0

test("incompatible direct care update normalizes to none/0", async () => {
  const a = actor({ health: { woundSeverity: 2, woundCare: { care: "treated", daysRemaining: 3 } } });
  await a.update({ "system.health.woundCare.care": "none" });
  const w = a.system.health.woundCare;
  assert.equal(w.care, "none");
  assert.equal(w.daysRemaining, 0);
});

// 7. unrelated update preserves wound care

test("unrelated update preserves wound care", async () => {
  const a = actor({ health: { woundSeverity: 2, woundCare: { care: "treated", daysRemaining: 3 } } });
  await a.update({ load: 5 });
  const w = a.system.health.woundCare;
  assert.equal(w.care, "treated");
  assert.equal(w.daysRemaining, 3);
});
