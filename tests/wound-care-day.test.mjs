import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
await import(pathToFileURL(resolve(process.env.FOUNDRY_APP_PATH
  ?? resolve(process.env.LOCALAPPDATA ?? '.', 'Programs/Foundry Virtual Tabletop/resources/app'), 'common/server.mjs')));
const { FatedDataModel } = await import('../module/data-models.mjs');
const { advanceWoundCareDay } = await import('../module/rest/wound-care-day.mjs');
const { actorStateModifiers } = await import('../module/health.mjs');
function actor(severity=2,care='treated',daysRemaining=3,dead=false){
 const a={type:'fated',isOwner:true,updates:[],system:new FatedDataModel({attributes:{heart:2,body:3,mind:4},resources:{endurance:{value:3},hope:{value:-2},power:4},currentStance:'defensive',health:{woundSeverity:severity,dead,woundCare:{care,daysRemaining}}}),
 async update(changes){await this.system._preUpdate(changes,{},{});this.updates.push(structuredClone(changes));this.system.updateSource(foundry.utils.expandObject(changes).system);this.system.prepareDerivedData()}};
 a.system.prepareDerivedData();return a;
}
for(const [severity,care,days,expectedCare,expectedDays] of [
 [1,'bandaged',3,'bandaged',2],[1,'bandaged',1,'none',0],[2,'bandaged',2,'bandaged',1],
 [2,'bandaged',1,'none',0],[1,'bandaged',0,'none',0],[2,'bandaged',0,'none',0],
 [2,'treated',3,'treated',2],[2,'treated',1,'none',0],[2,'treated',0,'none',0],
 [2,'grievousHealingPending',2,'grievousHealingPending',1],
 [2,'grievousHealingPending',1,'grievousHealingPending',0],
 [2,'grievousHealingPending',0,'grievousHealingPending',0],[2,'none',0,'none',0]]){
 test(`One day: severity ${severity} ${care}/${days} -> ${expectedCare}/${expectedDays}`,async()=>{
 const a=actor(severity,care,days);const before=a.system.toObject();const expected={care:expectedCare,daysRemaining:expectedDays};
 assert.equal(await advanceWoundCareDay(a),true);
 assert.deepEqual(a.system.health.woundCare,expected);
 const changed=care!==expectedCare||days!==expectedDays;
 assert.deepEqual(a.updates,changed?[{'system.health.woundCare':expected}]:[]);
 before.health.woundCare=expected;assert.deepEqual(a.system.toObject(),before);
 if(care==='treated'&&expectedCare==='none'){
 const mods=actorStateModifiers(a).successThreshold;assert.equal(mods.find(m=>m.source.condition==='wounds').value,2);assert.equal(mods.some(m=>m.source.condition==='treated'),false);
 }
 if(care==='bandaged'&&expectedCare==='none')assert.equal(actorStateModifiers(a).successThreshold.some(m=>m.source.condition==='bandaged'),false);
 });
}
for(const invalid of ['unauthorized','unsupported','incompatible']){
 test(`Wound-care day rejects ${invalid} without mutation`,async()=>{
 const a=actor();if(invalid==='unauthorized')a.isOwner=false;else if(invalid==='unsupported')a.type='npc';else a.system.health.woundCare={care:'bandaged',daysRemaining:3},a.system.health.woundSeverity=3;
 const before=a.system.toObject();assert.equal(await advanceWoundCareDay(a),false);assert.deepEqual(a.updates,[]);assert.deepEqual(a.system.toObject(),before);
 });
}
test('Advancement preserves persistent death and all unrelated state',async()=>{
 const a=actor(2,'treated',1,true);const before=a.system.toObject();assert.equal(await advanceWoundCareDay(a),true);
 before.health.woundCare={care:'none',daysRemaining:0};assert.deepEqual(a.system.toObject(),before);assert.equal(a.updates.length,1);
});
test('Rejected wound-care update leaves complete state unchanged',async()=>{
 const a=actor();const before=a.system.toObject();let calls=0;a.update=async changes=>{calls++;assert.deepEqual(changes,{'system.health.woundCare':{care:'treated',daysRemaining:2}});throw Error('Rejected update')};
 await assert.rejects(advanceWoundCareDay(a),/Rejected update/);assert.equal(calls,1);assert.deepEqual(a.system.toObject(),before);
});

test('No-care advancement preserves Deaths Door stabilization without an update',async()=>{
 const a=actor(3,'none',0);a.system.health.stabilized=true;const before=a.system.toObject();
 assert.equal(await advanceWoundCareDay(a),true);assert.deepEqual(a.updates,[]);assert.deepEqual(a.system.toObject(),before);
});
