import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

await import(pathToFileURL(resolve(process.env.FOUNDRY_APP_PATH ?? resolve(process.env.LOCALAPPDATA ?? ".", "Programs/Foundry Virtual Tabletop/resources/app"), "common/server.mjs")));

const { FatedDataModel } = await import("../module/data-models.mjs");
const { ActionDataModel } = await import("../module/actions/action-model.mjs");
const { calculateActorAction } = await import("../module/health.mjs");

function actor(data = {}) {
  const system = foundry.utils.mergeObject({
    attributes: { heart: 2, body: 3, mind: 4 },
    resources: { endurance: { value: 4 }, hope: { value: 0 }, power: 3 },
    health: { woundSeverity: 0, stabilized: false, dead: false },
  }, data, { inplace: false });
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

function action() {
  return { ...new ActionDataModel({ id: "strike", classification: "main", rollRequirement: "required",
    successDice: { source: "fixed", base: 4 }, allowedStances: ["neutral"], multiActionEligible: true }).toObject(),
    source: { itemId: "item", itemUuid: "Actor.test.Item.item", itemName: "Test", itemType: "weapon" } };
}

// Helper to compute total and modifiers
function calc(actor) {
  const result = calculateActorAction(actor, action());
  return { total: result.successThreshold.total, modifiers: result.successThreshold.modifiers };
}

const base = actor();

// 1. Healthy + none
const hNone = actor();
const r1 = calc(hNone);
assert.equal(r1.total, 4);
assert.deepEqual(r1.modifiers.map(m => m.label), []);

// 2. Light + none
const lNone = actor({ health: { woundSeverity: 1 } });
const r2 = calc(lNone);
assert.equal(r2.total, 5);
assert.deepEqual(r2.modifiers.map(m => m.label), ["Light Wound"]);

// 3. Light + bandaged
const lBandaged = actor({ health: { woundSeverity: 1, woundCare: { care: "bandaged", daysRemaining: 3 } } });
const r3 = calc(lBandaged);
assert.equal(r3.total, 4);
assert.deepEqual(r3.modifiers.map(m => m.label), ["Light Wound", "Bandaged"]);
assert.equal(r3.modifiers[1].source.type, "actor-state");
assert.equal(r3.modifiers[1].source.condition, "bandaged");

// 4. Grievous + none
const gNone = actor({ health: { woundSeverity: 2 } });
const r4 = calc(gNone);
assert.equal(r4.total, 6);
assert.deepEqual(r4.modifiers.map(m => m.label), ["Grievous Wound"]);

// 5. Grievous + bandaged
const gBandaged = actor({ health: { woundSeverity: 2, woundCare: { care: "bandaged", daysRemaining: 3 } } });
const r5 = calc(gBandaged);
assert.equal(r5.total, 5);
assert.deepEqual(r5.modifiers.map(m => m.label), ["Grievous Wound", "Bandaged"]);
assert.equal(r5.modifiers[1].source.condition, "bandaged");

// 6. Grievous + treated
const gTreated = actor({ health: { woundSeverity: 2, woundCare: { care: "treated", daysRemaining: 3 } } });
const r6 = calc(gTreated);
assert.equal(r6.total, 4);
assert.deepEqual(r6.modifiers.map(m => m.label), ["Grievous Wound", "Treated"]);
assert.equal(r6.modifiers[1].source.condition, "treated");

// 7. Grievous + grievousHealingPending
const gPending = actor({ health: { woundSeverity: 2, woundCare: { care: "grievousHealingPending", daysRemaining: 3 } } });
const r7 = calc(gPending);
assert.equal(r7.total, 6);
assert.deepEqual(r7.modifiers.map(m => m.label), ["Grievous Wound"]);

// 8. Death's Door
const dd = actor({ health: { woundSeverity: 3 } });
const r8 = calc(dd);
assert.equal(r8.total, 4);
assert.deepEqual(r8.modifiers.map(m => m.label), []);

