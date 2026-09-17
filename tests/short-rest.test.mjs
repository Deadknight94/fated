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
