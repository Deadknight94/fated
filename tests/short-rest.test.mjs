import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
await import(pathToFileURL(resolve(process.env.FOUNDRY_APP_PATH ?? resolve(process.env.LOCALAPPDATA ?? ".", "Programs/Foundry Virtual Tabletop/resources/app"), "common/server.mjs")));
const { FatedDataModel } = await import("../module/data-models.mjs");
const { shortRest } = await import("../module/rest/short-rest.mjs");

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

// Helper to perform rest and return actor updates count.
async function restAndCount(a, opts) {
  const res = await shortRest(a, opts);
  return { res, updates: a.updates.length };
}

test("Short Rest base gives +1 Endurance, capped at max", async () => {
  const a = actor({ resources: { endurance: { value: 3 } } });
  const { res, updates } = await restAndCount(a, {});
  assert.equal(res, true);
  assert.equal(a.system.resources.endurance.value, 4);
  assert.equal(updates, 1);
  // Max cap
  const a2 = actor({ resources: { endurance: { value: 5 } } }); // max=5
  const { res: r2, updates: u2 } = await restAndCount(a2, {});
  assert.equal(r2, true);
  assert.equal(a2.system.resources.endurance.value, 5);
  assert.equal(u2, 0);
});

test("Hope unchanged without spend", async () => {
  const a = actor({ resources: { hope: { value: 5 } } });
  await restAndCount(a, {});
  assert.equal(a.system.resources.hope.value, 5);
});

test("Spending 1 Hope adds chosen extra Endurance", async () => {
  const a = actor({ resources: { hope: { value: 5 } } });
  const { updates } = await restAndCount(a, { spendHope: true, extraRecovery: 1 });
  assert.equal(a.system.resources.hope.value, 4);
  assert.equal(a.system.resources.endurance.value, 5); // 3 + 1 base + 1 extra = 5
  assert.equal(updates, 1); // Endurance and Hope commit atomically.
  assert.deepEqual(a.updates[0], { "system.resources.endurance.value": 5, "system.resources.hope.value": 4 });
});

test("Extra recovery exactly Heart works, capped at max", async () => {
  const a = actor({ resources: { endurance: { value: 4 } } }); // max=5
  const { updates } = await restAndCount(a, { spendHope: true, extraRecovery: 2 });
  assert.equal(a.system.resources.endurance.value, 5); // capped
  assert.equal(a.system.resources.hope.value, 4);
  assert.equal(updates, 1);
});

test("Cannot spend Hope at negative Hope Limit", async () => {
  const a = actor({ resources: { hope: { value: -6 } } }); // heart=2, mind=4 -> limit=6
  const { res, updates } = await restAndCount(a, { spendHope: true, extraRecovery: 1 });
  assert.equal(res, false);
  assert.equal(a.system.resources.hope.value, -6);
  assert.equal(a.system.resources.endurance.value, 3);
  assert.equal(updates, 0);
});

test("Invalid extra recovery 0, >Heart, fractional rejected", async () => {
  const a = actor();
  const before = a.system.toObject();
  const cases = [0, -1, 3, 1.5, NaN, Infinity, "1"];
  for (const val of cases) {
    const { res, updates } = await restAndCount(a, { spendHope: true, extraRecovery: val });
    assert.equal(res, false);
    assert.equal(updates, 0);
    assert.deepEqual(a.system.toObject(), before);
  }
});

test("read-only actor cannot mutate", async () => {
  const a = actor();
  a.isOwner = false;
  const before = a.system.toObject();
  const { res, updates } = await restAndCount(a, { spendHope: true, extraRecovery: 1 });
  assert.equal(res, false);
  assert.equal(updates, 0);
  assert.deepEqual(a.system.toObject(), before);
});

test("non-boolean Hope spend requests are rejected without resource mutation", async () => {
  for (const spendHope of ["false", "true", 1, 0, null, {}]) {
    const a = actor();
    const before = a.system.toObject();
    assert.equal(await shortRest(a, { spendHope, extraRecovery: 1 }), false);
    assert.equal(a.updates.length, 0);
    assert.deepEqual(a.system.toObject(), before);
  }
});

test("Hope cost stays exactly 1 even when Endurance is already capped", async () => {
  const a = actor({ resources: { endurance: { value: 5 } } });
  await shortRest(a, { spendHope: true, extraRecovery: 2 });
  assert.equal(a.system.resources.endurance.value, 5);
  assert.equal(a.system.resources.hope.value, 4);
  assert.deepEqual(a.updates, [{ "system.resources.hope.value": 4 }]);
});

test("spending the last available Hope reaches the negative limit without partial updates", async () => {
  const a = actor({ resources: { hope: { value: -5 } } });
  await shortRest(a, { spendHope: true, extraRecovery: 1 });
  assert.equal(a.system.resources.hope.value, -6);
  assert.equal(a.system.toObject().resources.hope.value, -6);
  assert.equal(a.system.resources.endurance.value, 5);
  assert.equal(a.updates.length, 1);
});

test("rejected Actor update leaves both resources and unrelated state unchanged", async () => {
  const a = actor();
  const before = a.system.toObject();
  const attempts = [];
  a.update = async changes => { attempts.push(changes); throw new Error("Update rejected"); };
  await assert.rejects(shortRest(a, { spendHope: true, extraRecovery: 2 }), /Update rejected/);
  assert.deepEqual(attempts, [{ "system.resources.endurance.value": 5, "system.resources.hope.value": 4 }]);
  assert.deepEqual(a.system.toObject(), before);
});

// Bandaging tests

test("Light wound + 1 success bands for 1 day", async () => {
  const a = actor({ health: { woundSeverity: 1, woundCare: { care: "none", daysRemaining: 0 } } });
  const { res, updates } = await restAndCount(a, { healingSuccesses: 1 });
  assert.equal(res, true);
  assert.deepEqual(a.system.health.woundCare, { care: "bandaged", daysRemaining: 1 });
  assert.equal(updates, 1);
});

// Light wound + 3 successes bands for 3 days

test("Light wound + 3 successes bands for 3 days", async () => {
  const a = actor({ health: { woundSeverity: 1, woundCare: { care: "none", daysRemaining: 0 } } });
  const { res, updates } = await restAndCount(a, { healingSuccesses: 3 });
  assert.equal(res, true);
  assert.deepEqual(a.system.health.woundCare, { care: "bandaged", daysRemaining: 3 });
  assert.equal(updates, 1);
});

// Grievous wound + 2 successes bands for 2 days

test("Grievous wound + 2 successes bands for 2 days", async () => {
  const a = actor({ health: { woundSeverity: 2, woundCare: { care: "none", daysRemaining: 0 } } });
  const { res, updates } = await restAndCount(a, { healingSuccesses: 2 });
  assert.equal(res, true);
  assert.deepEqual(a.system.health.woundCare, { care: "bandaged", daysRemaining: 2 });
  assert.equal(updates, 1);
});

// Existing treated grievous wound is replaced by bandaged

test("Existing treated grievous wound is replaced by bandaged", async () => {
  const a = actor({ health: { woundSeverity: 2, woundCare: { care: "treated", daysRemaining: 0 } } });
  const { res, updates } = await restAndCount(a, { healingSuccesses: 1 });
  assert.equal(res, true);
  assert.deepEqual(a.system.health.woundCare, { care: "bandaged", daysRemaining: 1 });
  assert.equal(updates, 1);
});

// Existing bandaged wound days are replaced by new count

test("Existing bandaged wound days are replaced by new count", async () => {
  const a = actor({ health: { woundSeverity: 1, woundCare: { care: "bandaged", daysRemaining: 5 } } });
  const { res, updates } = await restAndCount(a, { healingSuccesses: 2 });
  assert.equal(res, true);
  assert.deepEqual(a.system.health.woundCare, { care: "bandaged", daysRemaining: 2 });
  assert.equal(updates, 1);
});

// Healthy actor with healingSuccesses rejected

test("Healthy actor with healingSuccesses rejected", async () => {
  const a = actor({ health: { woundSeverity: 0, woundCare: { care: "none", daysRemaining: 0 } } });
  const { res, updates } = await restAndCount(a, { healingSuccesses: 1 });
  assert.equal(res, false);
  assert.deepEqual(a.system.health.woundCare, { care: "none", daysRemaining: 0 });
  assert.equal(updates, 0);
});

// Death's Door wound with healingSuccesses rejected

test("Death's Door wound with healingSuccesses rejected", async () => {
  const a = actor({ health: { woundSeverity: 3, woundCare: { care: "none", daysRemaining: 0 } } });
  const { res, updates } = await restAndCount(a, { healingSuccesses: 1 });
  assert.equal(res, false);
  assert.deepEqual(a.system.health.woundCare, { care: "none", daysRemaining: 0 });
  assert.equal(updates, 0);
});

// Dead actor with healingSuccesses rejected

test("Dead actor with healingSuccesses rejected", async () => {
  const a = actor({ health: { woundSeverity: 4, woundCare: { care: "none", daysRemaining: 0 } } });
  const { res, updates } = await restAndCount(a, { healingSuccesses: 1 });
  assert.equal(res, false);
  assert.deepEqual(a.system.health.woundCare, { care: "none", daysRemaining: 0 });
  assert.equal(updates, 0);
});

// Explicit healingSuccesses 0 rejected

test("Explicit healingSuccesses 0 rejected", async () => {
  const a = actor();
  const { res, updates } = await restAndCount(a, { healingSuccesses: 0 });
  assert.equal(res, false);
  assert.equal(updates, 0);
});

// Negative healingSuccesses rejected

test("Negative healingSuccesses rejected", async () => {
  const a = actor();
  const { res, updates } = await restAndCount(a, { healingSuccesses: -1 });
  assert.equal(res, false);
  assert.equal(updates, 0);
});

// Fractional healingSuccesses rejected

test("Fractional healingSuccesses rejected", async () => {
  const a = actor();
  const { res, updates } = await restAndCount(a, { healingSuccesses: 1.5 });
  assert.equal(res, false);
  assert.equal(updates, 0);
});

// Non-numeric healingSuccesses rejected

// ----- Death's Door Recovery Tests -----

// Stabilized Death's Door + ordinary Short Rest recovers to Grievous

test("Stabilized Death's Door + ordinary Short Rest recovers to Grievous", async () => {
  const a = actor({ health: { woundSeverity: 3, woundCare: { care: "none", daysRemaining: 0 }, stabilized: true } });
  const { res, updates } = await restAndCount(a, {});
  assert.equal(res, true);
  assert.equal(a.system.health.woundSeverity, 2);
  assert.equal(a.system.health.stabilized, false);
  assert.deepEqual(a.system.health.woundCare, { care: "none", daysRemaining: 0 });
  assert.equal(updates, 1);
});

// Stabilized Death's Door + resource recovery same update

test("Stabilized Death's Door + resource recovery same update", async () => {
  const a = actor({ health: { woundSeverity: 3, woundCare: { care: "none", daysRemaining: 0 }, stabilized: true }, resources: { endurance: { value: 3 } } });
  const { res, updates } = await restAndCount(a, { spendHope: true, extraRecovery: 1 });
  assert.equal(res, true);
  assert.equal(a.system.resources.endurance.value, 5); // 3 +1 base +1 extra
  assert.equal(a.system.resources.hope.value, 4);
  assert.equal(a.system.health.woundSeverity, 2);
  assert.equal(a.system.health.stabilized, false);
  assert.equal(updates, 1);
  assert.deepEqual(a.updates[0], {
    "system.resources.endurance.value": 5,
    "system.resources.hope.value": 4,
    "system.health.woundSeverity": 2,
    "system.health.stabilized": false,
    "system.health.woundCare": { care: "none", daysRemaining: 0 }
  });
});

// Unstabilized Death's Door remains severity 3 and no stabilized flag

test("Unstabilized Death's Door remains severity 3 and no stabilized flag", async () => {
  const a = actor({ health: { woundSeverity: 3, woundCare: { care: "none", daysRemaining: 0 }, stabilized: false } });
  const { res, updates } = await restAndCount(a, {});
  assert.equal(res, true);
  assert.equal(a.system.health.woundSeverity, 3);
  assert.equal(a.system.health.stabilized, false);
  // Endurance should still increase
  assert.equal(a.system.resources.endurance.value, 4);
  assert.equal(updates, 1);
});

// Dead actor does not recover severity

test("Dead actor does not recover severity", async () => {
  const a = actor({ health: { woundSeverity: 4, woundCare: { care: "none", daysRemaining: 0 }, stabilized: true } });
  const before = a.system.toObject();
  const { res, updates } = await restAndCount(a, {});
  assert.equal(res, false);
  assert.equal(updates, 0);
  assert.deepEqual(a.system.toObject(), before);
});

// Invalid Short Rest request causes no wound recovery or resource mutation

test("Invalid Short Rest request causes no wound recovery or resource mutation", async () => {
  const a = actor({ health: { woundSeverity: 3, woundCare: { care: "none", daysRemaining: 0 }, stabilized: true } });
  const before = a.system.toObject();
  const { res, updates } = await restAndCount(a, { spendHope: true, extraRecovery: 0 });
  assert.equal(res, false);
  assert.equal(updates, 0);
  assert.deepEqual(a.system.toObject(), before);
});

// Bandaging request at Death's Door remains rejected

test("Bandaging request at Death's Door remains rejected", async () => {
  const a = actor({ health: { woundSeverity: 3, woundCare: { care: "none", daysRemaining: 0 }, stabilized: true } });
  const { res, updates } = await restAndCount(a, { healingSuccesses: 1 });
  assert.equal(res, false);
  assert.equal(updates, 0);
});

test("Non-numeric healingSuccesses rejected", async () => {
  const a = actor();
  const { res, updates } = await restAndCount(a, { healingSuccesses: "1" } );
  assert.equal(res, false);
  assert.equal(updates, 0);
});

// Unauthorized actor cannot mutate with healingSuccesses

test("Unauthorized actor cannot mutate with healingSuccesses", async () => {
  const a = actor();
  a.isOwner = false;
  const { res, updates } = await restAndCount(a, { healingSuccesses: 1 });
  assert.equal(res, false);
  assert.equal(updates, 0);
});

// Combining valid Hope recovery and bandaging in single update

test("Combining valid Hope recovery and bandaging in single update", async () => {
  const a = actor({ resources: { hope: { value: 5 }, endurance: { value: 3 } }, health: { woundSeverity: 1, woundCare: { care: "none", daysRemaining: 0 } } });
  const { res, updates } = await restAndCount(a, { spendHope: true, extraRecovery: 1, healingSuccesses: 2 });
  assert.equal(res, true);
  assert.equal(a.system.resources.hope.value, 4);
  assert.equal(a.system.resources.endurance.value, 5);
  assert.deepEqual(a.system.health.woundCare, { care: "bandaged", daysRemaining: 2 });
  assert.equal(updates, 1);
  // Verify single update contains both keys
  assert.deepEqual(a.updates[0], {
    "system.resources.endurance.value": 5,
    "system.resources.hope.value": 4,
    "system.health.woundCare": { care: "bandaged", daysRemaining: 2 }
  });
});

// Rejected bandaging request does not partially apply Hope or Endurance

test("Rejected bandaging request does not partially apply Hope or Endurance", async () => {
  const a = actor({ resources: { hope: { value: 5 }, endurance: { value: 3 } }, health: { woundSeverity: 1, woundCare: { care: "none", daysRemaining: 0 } } });
  const { res, updates } = await restAndCount(a, { spendHope: true, extraRecovery: 1, healingSuccesses: -1 });
  assert.equal(res, false);
  assert.equal(updates, 0);
  assert.equal(a.system.resources.hope.value, 5);
  assert.equal(a.system.resources.endurance.value, 3);
});
