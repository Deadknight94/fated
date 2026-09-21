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
  const before = a.system.toObject();
  const { res, updates } = await restAndCount(a);
  assert.equal(res, false);
  assert.equal(updates, 0);
  assert.deepEqual(a.system.toObject(), before);
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

// --- Wound Healing Tests ---

// No Healing input

test("Long Rest preserves Light wound and its valid wound care", async () => {
  const a = actor({
    health: { woundSeverity: 1, woundCare: { care: "bandaged", daysRemaining: 3 } }
  });
  const { res, updates } = await restAndCount(a, { healingSuccesses: undefined });
  assert.equal(res, true);
  assert.equal(updates, 1);
  assert.equal(a.system.health.woundSeverity, 1);
  assert.equal(a.system.health.woundCare.care, "bandaged");
  assert.equal(a.system.health.woundCare.daysRemaining, 3);
});

test("Long Rest preserves Grievous wound and its valid wound care", async () => {
  const a = actor({
    health: { woundSeverity: 2, woundCare: { care: "treated", daysRemaining: 2 } }
  });
  const { res, updates } = await restAndCount(a, { healingSuccesses: undefined });
  assert.equal(res, true);
  assert.equal(updates, 1);
  assert.equal(a.system.health.woundSeverity, 2);
  assert.equal(a.system.health.woundCare.care, "treated");
  assert.equal(a.system.health.woundCare.daysRemaining, 2);
});

// Light wound healing

test("Light wound + healingSuccesses 1 -> severity 0, none/0", async () => {
  const a = actor({
    health: { woundSeverity: 1 }
  });
  const { res, updates } = await restAndCount(a, { healingSuccesses: 1 });
  assert.equal(res, true);
  assert.equal(updates, 1);
  assert.equal(a.system.health.woundSeverity, 0);
  assert.equal(a.system.health.woundCare.care, "none");
  assert.equal(a.system.health.woundCare.daysRemaining, 0);
});

test("Light wound + several successes -> same Healthy result", async () => {
  const a = actor({
    health: { woundSeverity: 1 }
  });
  const { res, updates } = await restAndCount(a, { healingSuccesses: 5 });
  assert.equal(res, true);
  assert.equal(updates, 1);
  assert.equal(a.system.health.woundSeverity, 0);
  assert.equal(a.system.health.woundCare.care, "none");
  assert.equal(a.system.health.woundCare.daysRemaining, 0);
});

test("Existing bandaged Light -> Healthy, none/0", async () => {
  const a = actor({
    health: { woundSeverity: 1, woundCare: { care: "bandaged", daysRemaining: 2 } }
  });
  const { res, updates } = await restAndCount(a, { healingSuccesses: 1 });
  assert.equal(res, true);
  assert.equal(updates, 1);
  assert.equal(a.system.health.woundSeverity, 0);
  assert.equal(a.system.health.woundCare.care, "none");
  assert.equal(a.system.health.woundCare.daysRemaining, 0);
});

// Grievous wound treatment

test("Grievous wound + healingSuccesses 1 -> severity 2, treated/1", async () => {
  const a = actor({
    health: { woundSeverity: 2 }
  });
  const { res, updates } = await restAndCount(a, { healingSuccesses: 1 });
  assert.equal(res, true);
  assert.equal(updates, 1);
  assert.equal(a.system.health.woundSeverity, 2);
  assert.equal(a.system.health.woundCare.care, "treated");
  assert.equal(a.system.health.woundCare.daysRemaining, 1);
});

test("Grievous wound + several successes -> treated/exact successes", async () => {
  const a = actor({
    health: { woundSeverity: 2 }
  });
  const { res, updates } = await restAndCount(a, { healingSuccesses: 4 });
  assert.equal(res, true);
  assert.equal(updates, 1);
  assert.equal(a.system.health.woundSeverity, 2);
  assert.equal(a.system.health.woundCare.care, "treated");
  assert.equal(a.system.health.woundCare.daysRemaining, 4);
});

test("Existing bandaged Grievous is replaced by treated", async () => {
  const a = actor({
    health: { woundSeverity: 2, woundCare: { care: "bandaged", daysRemaining: 3 } }
  });
  const { res, updates } = await restAndCount(a, { healingSuccesses: 2 });
  assert.equal(res, true);
  assert.equal(updates, 1);
  assert.equal(a.system.health.woundSeverity, 2);
  assert.equal(a.system.health.woundCare.care, "treated");
  assert.equal(a.system.health.woundCare.daysRemaining, 2);
});

test("Existing treated duration is replaced by the new success count", async () => {
  const a = actor({
    health: { woundSeverity: 2, woundCare: { care: "treated", daysRemaining: 2 } }
  });
  const { res, updates } = await restAndCount(a, { healingSuccesses: 5 });
  assert.equal(res, true);
  assert.equal(updates, 1);
  assert.equal(a.system.health.woundSeverity, 2);
  assert.equal(a.system.health.woundCare.care, "treated");
  assert.equal(a.system.health.woundCare.daysRemaining, 5);
});

// Invalid Healing requests

test("Healthy + explicit Healing -> false, zero updates, complete state unchanged", async () => {
  const a = actor({
    health: { woundSeverity: 0 }
  });
  const before = a.system.toObject();
  const { res, updates } = await restAndCount(a, { healingSuccesses: 1 });
  assert.equal(res, false);
  assert.equal(updates, 0);
  assert.deepEqual(a.system.toObject(), before);
});

test("Death's Door + explicit Healing -> false, zero updates, complete state unchanged", async () => {
  const a = actor({
    health: { woundSeverity: 3 }
  });
  const before = a.system.toObject();
  const { res, updates } = await restAndCount(a, { healingSuccesses: 1 });
  assert.equal(res, false);
  assert.equal(updates, 0);
  assert.deepEqual(a.system.toObject(), before);
});

test("explicit healingSuccesses 0 -> rejected", async () => {
  const a = actor({
    health: { woundSeverity: 1 }
  });
  const before = a.system.toObject();
  const { res, updates } = await restAndCount(a, { healingSuccesses: 0 });
  assert.equal(res, false);
  assert.equal(updates, 0);
  assert.deepEqual(a.system.toObject(), before);
});

test("negative healingSuccesses -> rejected", async () => {
  const a = actor({
    health: { woundSeverity: 1 }
  });
  const before = a.system.toObject();
  const { res, updates } = await restAndCount(a, { healingSuccesses: -1 });
  assert.equal(res, false);
  assert.equal(updates, 0);
  assert.deepEqual(a.system.toObject(), before);
});

test("fractional healingSuccesses -> rejected", async () => {
  const a = actor({
    health: { woundSeverity: 1 }
  });
  const before = a.system.toObject();
  const { res, updates } = await restAndCount(a, { healingSuccesses: 1.5 });
  assert.equal(res, false);
  assert.equal(updates, 0);
  assert.deepEqual(a.system.toObject(), before);
});

test("nonnumeric healingSuccesses -> rejected", async () => {
  const a = actor({
    health: { woundSeverity: 1 }
  });
  const before = a.system.toObject();
  const { res, updates } = await restAndCount(a, { healingSuccesses: "2" });
  assert.equal(res, false);
  assert.equal(updates, 0);
  assert.deepEqual(a.system.toObject(), before);
});

test("unauthorized Actor -> rejected", async () => {
  const a = actor();
  a.isOwner = false;
  const before = a.system.toObject();
  const { res, updates } = await restAndCount(a, { healingSuccesses: 1 });
  assert.equal(res, false);
  assert.equal(updates, 0);
  assert.deepEqual(a.system.toObject(), before);
});

// Atomicity

test("valid resources + Light healing occur in exactly ONE Actor update", async () => {
  const a = actor({
    resources: { endurance: { value: 3 }, hope: { value: 5 }, power: 2 },
    health: { woundSeverity: 1 }
  });
  const { res, updates } = await restAndCount(a, { healingSuccesses: 1 });
  assert.equal(res, true);
  assert.equal(updates, 1);
  assert.deepEqual(a.updates[0], {
    "system.resources.endurance.value": 5,
    "system.resources.hope.value": 6,
    "system.resources.power": 0,
    "system.health.woundSeverity": 0,
    "system.health.woundCare": { care: "none", daysRemaining: 0 }
  });
});

test("valid resources + Grievous treatment occur in exactly ONE Actor update", async () => {
  const a = actor({
    resources: { endurance: { value: 3 }, hope: { value: 5 }, power: 2 },
    health: { woundSeverity: 2 }
  });
  const { res, updates } = await restAndCount(a, { healingSuccesses: 3 });
  assert.equal(res, true);
  assert.equal(updates, 1);
  assert.deepEqual(a.updates[0], {
    "system.resources.endurance.value": 5,
    "system.resources.hope.value": 6,
    "system.resources.power": 0,
    "system.health.woundCare": { care: "treated", daysRemaining: 3 }
  });
});

test("invalid Healing input must prevent ALL Long Rest changes", async () => {
  const a = actor({
    resources: { endurance: { value: 3 }, hope: { value: 5 }, power: 2 },
    health: { woundSeverity: 1 }
  });
  const before = a.system.toObject();
  const { res, updates } = await restAndCount(a, { healingSuccesses: 0 });
  assert.equal(res, false);
  assert.equal(updates, 0);
  assert.deepEqual(a.system.toObject(), before);
  // Ensure no resources were changed either
  assert.equal(a.system.resources.endurance.value, 3);
  assert.equal(a.system.resources.hope.value, 5);
  assert.equal(a.system.resources.power, 2);
});

test("rejected Long Rest update cannot partially commit resources or Grievous treatment", async () => {
  const a = actor({ health: { woundSeverity: 2 } });
  const before = a.system.toObject();
  const attempts = [];
  a.update = async changes => { attempts.push(structuredClone(changes)); throw new Error("Update rejected"); };
  await assert.rejects(longRest(a, { healingSuccesses: 3 }), /Update rejected/);
  assert.deepEqual(attempts, [{
    "system.resources.endurance.value": 5,
    "system.resources.hope.value": 6,
    "system.resources.power": 0,
    "system.health.woundCare": { care: "treated", daysRemaining: 3 }
  }]);
  assert.deepEqual(a.system.toObject(), before);
  assert.equal(a.updates.length, 0);
});

test("Long Rest Light healing preserves recorded death and unrelated character state", async () => {
  const a = actor({ health: { woundSeverity: 1, dead: true, woundCare: { care: "bandaged", daysRemaining: 2 } } });
  const before = a.system.toObject();
  assert.equal(await longRest(a, { healingSuccesses: 1 }), true);
  assert.equal(a.updates.length, 1);
  assert.equal(a.system.health.woundSeverity, 0);
  assert.equal(a.system.health.dead, true);
  assert.deepEqual(a.system.health.woundCare, { care: "none", daysRemaining: 0 });
  assert.equal(a.system.currentStance, before.currentStance);
  assert.deepEqual(a.system.toObject().declaration, before.declaration);
});
