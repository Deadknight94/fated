import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
await import(pathToFileURL(resolve(process.env.FOUNDRY_APP_PATH
  ?? resolve(process.env.LOCALAPPDATA ?? ".", "Programs/Foundry Virtual Tabletop/resources/app"), "common/server.mjs")));
const { FatedDataModel } = await import("../module/data-models.mjs");
const { beginExtendedRest, completeExtendedRestDay } = await import("../module/rest/extended-rest.mjs");

function actor(data = {}) {
  const a = { type: "fated", isOwner: true, updates: [],
    system: new FatedDataModel(foundry.utils.mergeObject({
      attributes: { heart: 2, body: 3, mind: 4 },
      resources: { endurance: { value: 1 }, hope: { value: -2 }, power: 4 },
      currentStance: "defensive",
      health: { woundSeverity: 2, woundCare: { care: "treated", daysRemaining: 7 } }
    }, data, { inplace: false })),
    async update(changes) {
      await this.system._preUpdate(changes, {}, {});
      this.updates.push(structuredClone(changes));
      this.system.updateSource(foundry.utils.expandObject(changes).system);
      this.system.prepareDerivedData();
    }
  };
  a.system.prepareDerivedData();
  return a;
}

function unchangedExcept(a, before, paths) {
  const expected = structuredClone(before);
  const after = a.system.toObject();
  for (const path of paths) foundry.utils.setProperty(expected, path, foundry.utils.getProperty(after, path));
  assert.deepEqual(after, expected);
}

for (const power of [4, 0]) {
  test(`Extended Rest beginning resets only Power (${power})`, async () => {
    const a = actor({ resources: { power } }); const before = a.system.toObject();
    assert.equal(await beginExtendedRest(a), true);
    assert.equal(a.system.resources.power, 0);
    assert.deepEqual(a.updates, power ? [{ "system.resources.power": 0 }] : []);
    unchangedExcept(a, before, ["resources.power"]);
  });
}

for (const endurance of [0, 1, 4, 5]) {
  test(`Extended Rest completed day fills Endurance from ${endurance} and changes Hope atomically`, async () => {
    const a = actor({ resources: { endurance: { value: endurance }, hope: { value: 0 } } });
    const before = a.system.toObject();
    assert.equal(await completeExtendedRestDay(a), true);
    assert.equal(a.system.resources.endurance.value, 5);
    assert.equal(a.system.resources.hope.value, 1);
    assert.deepEqual(a.updates, [endurance === 5 ? { "system.resources.hope.value": 1 }
      : { "system.resources.endurance.value": 5, "system.resources.hope.value": 1 }]);
    unchangedExcept(a, before, ["resources.endurance.value", "resources.hope.value"]);
  });
}

for (const [hope, expected] of [[-6, -5], [-2, -1], [0, 1], [5, 6], [6, 6]]) {
  test(`Extended Rest completed day Hope ${hope} -> ${expected}`, async () => {
    const a = actor({ resources: { endurance: { value: 5 }, hope: { value: hope } } });
    const before = a.system.toObject();
    assert.equal(await completeExtendedRestDay(a), true);
    assert.equal(a.system.resources.hope.value, expected);
    assert.deepEqual(a.updates, hope === expected ? [] : [{ "system.resources.hope.value": expected }]);
    unchangedExcept(a, before, ["resources.hope.value"]);
  });
}

test("Extended Rest zero Hope Limit keeps Hope zero", async () => {
  const a = actor({ attributes: { heart: 0, mind: 0 }, resources: { hope: { value: 0 } } });
  const before = a.system.toObject();
  assert.equal(await completeExtendedRestDay(a), true);
  assert.equal(a.system.resources.endurance.value, 3);
  assert.equal(a.system.resources.hope.value, 0);
  unchangedExcept(a, before, ["resources.endurance.value"]);
});

for (const operation of [beginExtendedRest, completeExtendedRestDay]) {
  for (const invalid of ["unauthorized", "unsupported", "terminal"]) {
    test(`${operation.name} rejects ${invalid} with complete state preserved`, async () => {
      const a = actor(invalid === "terminal" ? { health: { woundSeverity: 4 } } : {});
      if (invalid === "unauthorized") a.isOwner = false;
      if (invalid === "unsupported") a.type = "npc";
      const before = a.system.toObject();
      assert.equal(await operation(a), false);
      assert.deepEqual(a.system.toObject(), before);
      assert.deepEqual(a.updates, []);
    });
  }
  test(`${operation.name} rejected document update preserves all state`, async () => {
    const a = actor(); const before = a.system.toObject(); const attempts = [];
    a.update = async changes => { attempts.push(structuredClone(changes)); throw new Error("Update rejected"); };
    await assert.rejects(operation(a), /Update rejected/);
    assert.equal(attempts.length, 1);
    assert.deepEqual(a.system.toObject(), before);
    assert.deepEqual(a.updates, []);
  });
}

test("Extended Rest beginning and two completed days have separate resource timings", async () => {
  const a = actor(); const before = a.system.toObject();
  assert.equal(await beginExtendedRest(a), true);
  assert.equal(a.system.resources.power, 0);
  assert.equal(a.system.resources.endurance.value, 1);
  assert.equal(a.system.resources.hope.value, -2);
  assert.equal(await completeExtendedRestDay(a), true);
  assert.equal(a.system.resources.endurance.value, 5);
  assert.equal(a.system.resources.hope.value, -1);
  assert.equal(a.system.resources.power, 0);
  assert.equal(await completeExtendedRestDay(a), true);
  assert.equal(a.system.resources.endurance.value, 5);
  assert.equal(a.system.resources.hope.value, 0);
  assert.equal(a.system.resources.power, 0);
  assert.deepEqual(a.updates, [{ "system.resources.power": 0 },
    { "system.resources.endurance.value": 5, "system.resources.hope.value": -1 },
    { "system.resources.hope.value": 0 }]);
  unchangedExcept(a, before, ["resources.power", "resources.endurance.value", "resources.hope.value"]);
});

const { completeExtendedRestGrievousHealing } = await import('../module/rest/extended-rest.mjs');
const none = { care: 'none', daysRemaining: 0 };
const pending = { care: 'grievousHealingPending', daysRemaining: 1 };

for (const care of ['none', 'bandaged']) {
  test(`Extended day automatically heals Light (${care}) atomically with resources`, async () => {
    const a=actor({health:{woundSeverity:1,woundCare:{care,daysRemaining:care==='none'?0:3}}});
    const before=a.system.toObject();
    assert.equal(await completeExtendedRestDay(a),true);
    assert.deepEqual(a.updates,[{'system.resources.endurance.value':5,'system.resources.hope.value':-1,
      'system.health.woundSeverity':0,'system.health.woundCare':none}]);
    assert.equal(a.system.health.woundSeverity,0);
    assert.deepEqual(a.system.health.woundCare,none);
    unchangedExcept(a,before,['resources.endurance.value','resources.hope.value','health.woundSeverity','health.woundCare']);
  });
}
for (const care of ['none','bandaged','treated','grievousHealingPending']) {
  test(`Extended day without Healing preserves Grievous ${care} and its duration`,async()=>{
    const days=care==='none'?0:3;
    const a=actor({health:{woundCare:{care,daysRemaining:days}}});const before=a.system.toObject();
    assert.equal(await completeExtendedRestDay(a),true);
    assert.equal(a.system.health.woundSeverity,2);
    assert.deepEqual(a.system.health.woundCare,{care,daysRemaining:days});
    unchangedExcept(a,before,['resources.endurance.value','resources.hope.value']);
  });
}
for (const care of ['none','bandaged','treated']) {
  for (const healingSuccesses of [1,5]) {
    test(`Grievous ${care} + ${healingSuccesses} Healing successes schedules exactly one day`,async()=>{
      const a=actor({health:{woundCare:{care,daysRemaining:care==='none'?0:4}}});const before=a.system.toObject();
      assert.equal(await completeExtendedRestDay(a,{healingSuccesses}),true);
      assert.deepEqual(a.updates,[{'system.resources.endurance.value':5,'system.resources.hope.value':-1,'system.health.woundCare':pending}]);
      assert.equal(a.system.health.woundSeverity,2);
      assert.deepEqual(a.system.health.woundCare,pending);
      unchangedExcept(a,before,['resources.endurance.value','resources.hope.value','health.woundCare']);
    });
  }
}
for (const healingSuccesses of [0,-1,1.5,'2',null,NaN]) {
  test(`Invalid Extended Healing ${String(healingSuccesses)} rejects all changes`,async()=>{
    const a=actor();const before=a.system.toObject();
    assert.equal(await completeExtendedRestDay(a,{healingSuccesses}),false);
    assert.deepEqual(a.updates,[]);assert.deepEqual(a.system.toObject(),before);
  });
}
for (const severity of [0,1,3,4]) {
  test(`Explicit Extended Healing at severity ${severity} rejects complete day`,async()=>{
    const a=actor({health:{woundSeverity:severity,woundCare:none}});const before=a.system.toObject();
    assert.equal(await completeExtendedRestDay(a,{healingSuccesses:2}),false);
    assert.deepEqual(a.updates,[]);assert.deepEqual(a.system.toObject(),before);
  });
}
test('Unauthorized Extended scheduling preserves complete state',async()=>{
  const a=actor();a.isOwner=false;const before=a.system.toObject();
  assert.equal(await completeExtendedRestDay(a,{healingSuccesses:2}),false);
  assert.deepEqual(a.updates,[]);assert.deepEqual(a.system.toObject(),before);
});
test('Explicit pending completion heals atomically and preserves persistent death and resources',async()=>{
  for(const dead of [false,true]){
    const a=actor({health:{dead,woundCare:pending}});const before=a.system.toObject();
    assert.equal(await completeExtendedRestGrievousHealing(a),true);
    assert.deepEqual(a.updates,[{'system.health.woundSeverity':0,'system.health.woundCare':none}]);
    assert.equal(a.system.health.woundSeverity,0);assert.deepEqual(a.system.health.woundCare,none);
    unchangedExcept(a,before,['health.woundSeverity','health.woundCare']);
  }
});
for(const care of ['none','bandaged','treated']){
  test(`Explicit completion rejects nonpending Grievous ${care}`,async()=>{
    const a=actor({health:{woundCare:{care,daysRemaining:care==='none'?0:3}}});const before=a.system.toObject();
    assert.equal(await completeExtendedRestGrievousHealing(a),false);
    assert.deepEqual(a.updates,[]);assert.deepEqual(a.system.toObject(),before);
  });
}
for(const severity of [0,1,3,4]){
  test(`Pending care at incompatible severity ${severity} cannot heal`,async()=>{
    const a=actor({health:{woundSeverity:severity,woundCare:pending}});const before=a.system.toObject();
    assert.equal(await completeExtendedRestGrievousHealing(a),false);
    assert.deepEqual(a.updates,[]);assert.deepEqual(a.system.toObject(),before);
  });
}
for(const invalid of ['unauthorized','unsupported']){
  test(`Explicit pending completion rejects ${invalid}`,async()=>{
    const a=actor({health:{woundCare:pending}});if(invalid==='unauthorized')a.isOwner=false;else a.type='npc';
    const before=a.system.toObject();assert.equal(await completeExtendedRestGrievousHealing(a),false);
    assert.deepEqual(a.updates,[]);assert.deepEqual(a.system.toObject(),before);
  });
}
test('Schedule, ordinary day, and explicit completion remain separate operations',async()=>{
  const a=actor();const before=a.system.toObject();
  await completeExtendedRestDay(a,{healingSuccesses:3});assert.deepEqual(a.system.health.woundCare,pending);
  await completeExtendedRestDay(a);assert.deepEqual(a.system.health.woundCare,pending);assert.equal(a.system.health.woundSeverity,2);
  assert.equal(a.system.resources.endurance.value,5);assert.equal(a.system.resources.hope.value,0);
  await completeExtendedRestGrievousHealing(a);assert.equal(a.system.health.woundSeverity,0);assert.deepEqual(a.system.health.woundCare,none);
  assert.equal(a.updates.length,3);
  unchangedExcept(a,before,['resources.endurance.value','resources.hope.value','health.woundSeverity','health.woundCare']);
});
for(const operation of [a=>completeExtendedRestDay(a,{healingSuccesses:2}),completeExtendedRestGrievousHealing]){
  test(`Rejected ${operation.name||'scheduling'} update preserves resources and health`,async()=>{
    const a=actor({health:{woundCare:pending}});const before=a.system.toObject();let calls=0;
    a.update=async()=>{calls++;throw Error('Rejected update')};
    await assert.rejects(operation(a),/Rejected update/);assert.equal(calls,1);assert.deepEqual(a.system.toObject(),before);
  });
}
