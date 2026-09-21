import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
await import(pathToFileURL(resolve(process.env.FOUNDRY_APP_PATH ?? resolve(process.env.LOCALAPPDATA ?? ".", "Programs/Foundry Virtual Tabletop/resources/app"), "common/server.mjs")));
await import("./helpers/client-applications.mjs");
const { FatedDataModel } = await import("../module/data-models.mjs");
const { RestApp, openRestApp } = await import("../module/apps/rest-app.mjs");

function actor(data = {}) {
  const document = {
    type: "fated",
    isOwner: true,
    updates: [],
    apps: {}, id: "rest-test",
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
      for (const app of Object.values(this.apps)) await app.render({force:true});
    },
  };
  document.system.prepareDerivedData();
  return document;
}

// Test non-fated actor rejection

test("RestApp rejects non‑fated actors", () => {
  const a = actor();
  a.type = "npc";
  assert.throws(() => new RestApp({ document: a }), /RestApp can only be opened for fated actors/);
});

// Test context values

test("RestApp exposes correct context", async () => {
  const a = actor();
  // Override system values for test
  a.system.attributes.heart = 1;
  a.system.attributes.body = 4;
  a.system.attributes.mind = 3;
  a.system.resources.endurance.value = 4;
  a.system.resources.hope.value = -2;
  a.system.resources.power = 3;
  a.system.health = { woundSeverity: 2, woundCare: { care: "treated", daysRemaining: 1 } };
  a.system.prepareDerivedData();
  const app = new RestApp({ document: a });
  const ctx = await app._prepareContext({});
  assert.equal(ctx.endurance.current, 4);
  assert.equal(ctx.endurance.max, 5); // body+heart
  assert.equal(ctx.hope.current, -2);
  assert.equal(ctx.hope.limit, 4); // mind+heart
  assert.equal(ctx.power.current, 3);
  // Verify power maximum
  assert.equal(ctx.power.max, 8, "Power max derived from heart+body+mind");
  assert.equal(ctx.wound.severity, 2);
  assert.equal(ctx.woundCare.care, "treated");
  assert.equal(ctx.woundCare.daysRemaining, 1);
});

// Test openRestApp returns rendered app and does not mutate actor

test("openRestApp opens app and leaves actor unchanged", async () => {
  const a = actor();
  const app = await openRestApp(a);
  assert.ok(app instanceof RestApp);
  assert.strictEqual(app.document, a);
  // No updates yet
  assert.equal(a.updates.length, 0);
  // Rendering should succeed without throwing
  await app.render({ force: true });
});

 test('RestApp reuses one Actor app, refreshes on document render, and unregisters on close',async()=>{
 const a=actor();const before=a.system.toObject();const app=await openRestApp(a);
 assert.equal(await openRestApp(a),app);assert.deepEqual(a.system.toObject(),before);assert.equal(a.updates.length,0);
 await a.update({'system.resources.endurance.value':1});assert.equal(app.context.endurance.current,1);
 await app.close();assert.equal(Object.values(a.apps).length,0);
 });
 test('Read-only RestApp renders Actor values without mutation',async()=>{
 const a=actor();a.isOwner=false;const before=a.system.toObject();const app=await openRestApp(a);
 assert.equal(app.context.editable,false);assert.deepEqual(a.system.toObject(),before);assert.equal(a.updates.length,0);
 });

globalThis.ui = { notifications: { warn: message => warnings.push(message) } };
const warnings=[];
test('Short Rest UI omits blank Healing and false-spend extra recovery',()=>{
 const app=new RestApp({document:actor()});app.values.shortHealing='  ';app.values.extraRecovery='999';
 assert.deepEqual(app.shortOptions(),{spendHope:false});
 app.values.spendHope=true;app.values.extraRecovery='2';app.values.shortHealing='3';
 assert.deepEqual(app.shortOptions(),{spendHope:true,extraRecovery:2,healingSuccesses:3});
 app.values.shortHealing='0';assert.equal(app.shortOptions().healingSuccesses,0);
});
test('Short Rest UI executes existing service and refreshes resulting state',async()=>{
 const a=actor({resources:{endurance:{value:1},hope:{value:3}}});const app=await openRestApp(a);
 app.values.spendHope=true;app.values.extraRecovery='2';
 assert.equal(await RestApp.DEFAULT_OPTIONS.actions.shortRest.call(app),true);
 assert.equal(a.updates.length,1);assert.equal(app.context.endurance.current,4);assert.equal(app.context.hope.current,2);
});
test('Short Rest UI rejection and read-only paths preserve complete state',async()=>{
 const a=actor();const app=await openRestApp(a);const before=a.system.toObject();app.values.shortHealing='0';
 assert.equal(await RestApp.DEFAULT_OPTIONS.actions.shortRest.call(app),false);assert.deepEqual(a.system.toObject(),before);assert.equal(a.updates.length,0);
 a.isOwner=false;await app.render();assert.equal(app.context.editable,false);
 assert.equal(await RestApp.DEFAULT_OPTIONS.actions.shortRest.call(app),false);assert.deepEqual(a.system.toObject(),before);assert.equal(a.updates.length,0);assert.ok(warnings.length>=2);
});
test('Rest UI performs a service once and blocks overlapping execution',async()=>{
 const app=await openRestApp(actor());let calls=0;let release;
 const promise=app.perform(async()=>{calls++;await new Promise(resolve=>release=resolve);return true},{});
 assert.equal(await app.perform(async()=>{calls++;return true},{}),false);
 await new Promise(resolve=>setImmediate(resolve));release();assert.equal(await promise,true);assert.equal(calls,1);
});

test('Long Rest UI omits blank Healing and delegates daily resources to service',async()=>{
 const a=actor({resources:{endurance:{value:1},hope:{value:3},power:4}});const app=await openRestApp(a);
 assert.deepEqual(app.healingOptions('longHealing'),{});
 assert.equal(await RestApp.DEFAULT_OPTIONS.actions.longRest.call(app),true);
 assert.equal(a.updates.length,1);assert.equal(app.context.endurance.current,4);assert.equal(app.context.hope.current,4);assert.equal(app.context.power.current,0);
});
for(const [severity,expectedSeverity,care] of [[1,0,'none'],[2,2,'treated']]){
 test(`Long Rest UI physical Healing delegates severity ${severity}`,async()=>{
 const a=actor({health:{woundSeverity:severity}});const app=await openRestApp(a);app.values.longHealing='3';
 assert.deepEqual(app.healingOptions('longHealing'),{healingSuccesses:3});assert.equal(await RestApp.DEFAULT_OPTIONS.actions.longRest.call(app),true);
 assert.equal(a.updates.length,1);assert.equal(app.context.wound.severity,expectedSeverity);assert.equal(app.context.woundCare.care,care);
 });
}
test('Long Rest UI invalid Healing and unauthorized execution cannot mutate',async()=>{
 const a=actor({health:{woundSeverity:2}});const app=await openRestApp(a);const before=a.system.toObject();app.values.longHealing='0';
 assert.equal(await RestApp.DEFAULT_OPTIONS.actions.longRest.call(app),false);assert.deepEqual(a.system.toObject(),before);assert.equal(a.updates.length,0);
 a.isOwner=false;app.values.longHealing='2';assert.equal(await RestApp.DEFAULT_OPTIONS.actions.longRest.call(app),false);assert.deepEqual(a.system.toObject(),before);
});

test('Extended UI beginning invokes only Power reset',async()=>{
 const a=actor({resources:{endurance:{value:1},hope:{value:3},power:4}});const app=await openRestApp(a);const before=a.system.toObject();
 assert.equal(await RestApp.DEFAULT_OPTIONS.actions.beginExtended.call(app),true);
 assert.deepEqual(a.updates,[{'system.resources.power':0}]);before.resources.power=0;assert.deepEqual(a.system.toObject(),before);
});
test('Extended UI day schedules pending without advancing or resolving it',async()=>{
 const a=actor({health:{woundSeverity:2},resources:{power:4}});const app=await openRestApp(a);app.values.extendedHealing='3';
 assert.equal(await RestApp.DEFAULT_OPTIONS.actions.completeExtendedDay.call(app),true);
 assert.equal(a.updates.length,1);assert.equal(a.system.resources.power,4);
 assert.deepEqual(a.system.health.woundCare,{care:'grievousHealingPending',daysRemaining:1});assert.equal(app.context.canCompletePending,false);
 app.values.extendedHealing='';assert.deepEqual(app.healingOptions('extendedHealing'),{});
 assert.equal(await RestApp.DEFAULT_OPTIONS.actions.completeExtendedDay.call(app),true);
 assert.deepEqual(a.system.health.woundCare,{care:'grievousHealingPending',daysRemaining:1});assert.equal(a.system.health.woundSeverity,2);
});
test('Extended UI advances care independently, then explicitly completes eligible pending healing',async()=>{
 const a=actor({health:{woundSeverity:2,woundCare:{care:'grievousHealingPending',daysRemaining:1}}});const app=await openRestApp(a);const before=a.system.toObject();
 assert.equal(await RestApp.DEFAULT_OPTIONS.actions.completeGrievousHealing.call(app),false);assert.equal(a.updates.length,0);assert.deepEqual(a.system.toObject(),before);
 assert.equal(await RestApp.DEFAULT_OPTIONS.actions.advanceCareDay.call(app),true);
 assert.deepEqual(a.updates,[{'system.health.woundCare':{care:'grievousHealingPending',daysRemaining:0}}]);assert.equal(app.context.canCompletePending,true);
 assert.deepEqual(a.system.toObject().resources,before.resources);assert.equal(a.system.health.woundSeverity,2);
 assert.equal(await RestApp.DEFAULT_OPTIONS.actions.completeGrievousHealing.call(app),true);
 assert.equal(a.updates.length,2);assert.equal(a.system.health.woundSeverity,0);assert.deepEqual(a.system.toObject().resources,before.resources);
});
test('Extended UI invalid Healing and read-only actions preserve Actor state',async()=>{
 const a=actor({health:{woundSeverity:2}});const app=await openRestApp(a);const before=a.system.toObject();app.values.extendedHealing='0';
 assert.equal(await RestApp.DEFAULT_OPTIONS.actions.completeExtendedDay.call(app),false);assert.equal(a.updates.length,0);assert.deepEqual(a.system.toObject(),before);
 a.isOwner=false;
 for(const action of ['beginExtended','completeExtendedDay','advanceCareDay','completeGrievousHealing'])assert.equal(await RestApp.DEFAULT_OPTIONS.actions[action].call(app),false);
 assert.equal(a.updates.length,0);assert.deepEqual(a.system.toObject(),before);
});

const { FatedActorSheet } = await import('../module/sheets/actor-sheets.mjs');
const { FatedMobileSheet } = await import('../module/sheets/mobile-sheet.mjs');
test('Desktop and mobile Rest entry points reuse the correct Actor app',async()=>{
 const a=actor();const desktop=new FatedActorSheet({document:a});const mobile=new FatedMobileSheet({document:a});
 const first=await FatedActorSheet.DEFAULT_OPTIONS.actions.openRest.call(desktop);
 const second=await FatedMobileSheet.openRest.call(mobile);
 assert.equal(first,second);assert.equal(first.document,a);assert.equal(a.updates.length,0);
 const other=actor();other.id='other-actor';const otherApp=await FatedMobileSheet.openRest.call(new FatedMobileSheet({document:other}));
 assert.notEqual(first,otherApp);assert.equal(otherApp.document,other);assert.equal(other.updates.length,0);
});
test('Observer can open Rest from mobile with editing disabled',async()=>{
 const a=actor();a.isOwner=false;const app=await FatedMobileSheet.openRest.call(new FatedMobileSheet({document:a}));
 assert.equal(app.document,a);assert.equal(app.context.editable,false);assert.equal(a.updates.length,0);
});

test('Rapid repeated Rest opening reserves one document app during first render',async()=>{
 const a=actor();const [first,second]=await Promise.all([openRestApp(a),openRestApp(a)]);
 assert.equal(first,second);assert.equal(Object.keys(a.apps).length,1);assert.equal(a.updates.length,0);
});

test('Malformed browser numeric input is rejected rather than treated as omitted Healing',async()=>{
 const a=actor({health:{woundSeverity:1}});const app=await openRestApp(a);const before=a.system.toObject();
 app.element={querySelector:()=>({validity:{badInput:true}})};
 assert.ok(Number.isNaN(app.healingOptions('shortHealing').healingSuccesses));
 assert.equal(await RestApp.DEFAULT_OPTIONS.actions.shortRest.call(app),false);
 assert.equal(a.updates.length,0);assert.deepEqual(a.system.toObject(),before);
});
