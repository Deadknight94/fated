import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
await import(pathToFileURL(resolve(process.env.FOUNDRY_APP_PATH
  ?? resolve(process.env.LOCALAPPDATA ?? ".", "Programs/Foundry Virtual Tabletop/resources/app"), "common/server.mjs")));
const { FatedDataModel } = await import("../module/data-models.mjs");
const { applyWounds, applyWitnessedWoundHopeLoss, applyDeathsDoorDrain, updateHealth, deriveHealth } = await import("../module/health.mjs");
const { applyDamage } = await import("../module/damage.mjs");
const { applyFateDieHope } = await import("../module/resources.mjs");

function actor({ hope = 5, endurance = 4, severity = 0, limit = 6, stabilized = false, dead = false } = {}) {
  const a = { type: "fated", isOwner: true, updates: [],
    system: new FatedDataModel({ attributes: { heart: 2, body: 3, mind: limit - 2 },
      resources: { hope: { value: hope }, endurance: { value: endurance }, power: 3 },
      health: { woundSeverity: severity, stabilized, dead } }),
    async update(changes) {
      await this.system._preUpdate(changes, {}, { isGM: true });
      this.updates.push(structuredClone(changes));
      this.system.updateSource(foundry.utils.expandObject(changes).system);
      this.system.prepareDerivedData();
    } };
  a.system.prepareDerivedData();
  return a;
}

for (const [hope, expected] of [[5, 2], [4, 2], [1, 0], [0, -1], [-2, -3], [-6, -6]]) {
  test(`Light Wound Hope ${hope} becomes ${expected}, in one document update`, async () => {
    const a = actor({ hope });
    await applyWounds(a, 1);
    assert.equal(a.system.resources.hope.value, expected);
    assert.equal(a.system.health.woundSeverity, 1);
    assert.equal(a.system.resources.endurance.value, 4);
    assert.equal(a.system.resources.power, 3);
    assert.equal(a.updates.length, 1);
  });
}
for (const limit of [5, 6]) {
  test(`simultaneous Healthy to Grievous with Hope Limit ${limit} loses only 3`, async () => {
    const a = actor({ limit });
    await applyDamage({ target: a, finalDamage: 2 * a.system.defense });
    assert.equal(a.system.resources.hope.value, 2);
    assert.equal(a.system.health.woundSeverity, 2);
    assert.equal(a.updates.length, 1);
  });
}
test("separate Light and Grievous events each lose Hope", async () => {
  const a = actor();
  await applyWounds(a, 1);
  assert.equal(a.system.resources.hope.value, 2);
  await applyWounds(a, 1);
  assert.equal(a.system.resources.hope.value, -1);
  assert.equal(a.updates.length, 2);
});
test("Grievous clamps at negative limit", async () => {
  const a = actor({ hope: -5 });
  await applyWounds(a, 2);
  assert.equal(a.system.resources.hope.value, -6);
});
test("manual corrections and preparation do not apply narrative loss", async () => {
  const a = actor();
  await updateHealth(a, { type: "wound", delta: 1 });
  await a.update({ "system.health.woundSeverity": 2 });
  a.system.prepareDerivedData();
  assert.equal(a.system.resources.hope.value, 5);
});
test("zero/invalid Wounds and unauthorized Wounds do not mutate", async () => {
  const a = actor();
  assert.equal(await applyWounds(a, 0), false);
  for (const value of [-1, 0.5, NaN]) await assert.rejects(applyWounds(a, value));
  a.isOwner = false;
  await assert.rejects(applyWounds(a, 1));
  a.isOwner = true; a.type = "npc";
  await assert.rejects(applyWounds(a, 1));
  assert.equal(a.updates.length, 0);
});
test("reopening treatment loses Grievous Hope once without increasing severity", async () => {
  const a = actor({ severity: 2 });
  await a.update({ "system.health.woundCare": { care: "treated", daysRemaining: 2 } });
  await applyWounds(a, 1);
  assert.equal(a.system.health.woundSeverity, 2);
  assert.equal(a.system.health.woundCare.care, "none");
  assert.equal(a.system.resources.hope.value, 2);
});
for (const severity of [1, 2, 3]) {
  test(`witness final severity ${severity} loses ${severity}`, async () => {
    const a = actor();
    await applyWitnessedWoundHopeLoss(a, severity);
    assert.equal(a.system.resources.hope.value, 5 - severity);
    assert.equal(a.system.resources.endurance.value, 4);
    assert.equal(a.system.health.woundSeverity, 0);
    assert.equal(a.updates.length, 1);
  });
}
test("Healthy to Death's Door gives witness only final loss; no invented self loss", async () => {
  const target = actor(), witness = actor();
  const result = await applyDamage({ target, finalDamage: 3 * target.system.defense });
  await applyWitnessedWoundHopeLoss(witness, result.resultingWoundSeverity);
  assert.equal(witness.system.resources.hope.value, 2);
  assert.equal(target.system.resources.hope.value, 5);
  assert.equal(witness.updates.length, 1);
});
test("separate witnessed events apply independently and clamp", async () => {
  const a = actor({ hope: 0 });
  for (const severity of [1, 2, 3, 3]) await applyWitnessedWoundHopeLoss(a, severity);
  assert.equal(a.system.resources.hope.value, -6);
  assert.equal(a.updates.length, 3);
});
test("invalid severity, nonowners and NPC witnesses do not mutate", async () => {
  const a = actor();
  for (const severity of [0, 4, -1, 1.5, "1", null]) assert.equal(await applyWitnessedWoundHopeLoss(a, severity), false);
  a.isOwner = false;
  assert.equal(await applyWitnessedWoundHopeLoss(a, 1), false);
  a.isOwner = true; a.type = "npc";
  assert.equal(await applyWitnessedWoundHopeLoss(a, 1), false);
  assert.equal(a.updates.length, 0);
});
for (const endurance of [0, 1, 3]) {
  test(`Death's Door at Endurance ${endurance} drains exactly one resource`, async () => {
    const a = actor({ severity: 3, endurance });
    await applyDeathsDoorDrain(a);
    assert.equal(a.system.resources.endurance.value, Math.max(0, endurance - 1));
    assert.equal(a.system.resources.hope.value, endurance === 0 ? 4 : 5);
    assert.equal(a.system.resources.power, 3);
    assert.equal(a.updates.length, 1);
  });
}
for (const endurance of [0, 2]) {
  test(`stabilized Death's Door at Endurance ${endurance} loses neither resource`, async () => {
    const a = actor({ severity: 3, endurance, stabilized: true });
    assert.equal(await applyDeathsDoorDrain(a), false);
    assert.equal(a.updates.length, 0);
  });
}
test("repeated ticks switch to Hope only after Exhaustion and derive Broken/death normally", async () => {
  const a = actor({ severity: 3, endurance: 2, hope: -4 });
  for (const [endurance, hope, dead] of [[1, -4, false], [0, -4, false], [0, -5, false], [0, -6, true]]) {
    await applyDeathsDoorDrain(a);
    assert.equal(a.system.resources.endurance.value, endurance);
    assert.equal(a.system.resources.hope.value, hope);
    assert.equal(deriveHealth(a.system).broken, dead);
    assert.equal(a.system.health.dead, dead);
  }
  assert.equal(await applyDeathsDoorDrain(a), false);
  assert.equal(a.updates.length, 4);
});
test("minimum Hope with Endurance remaining does not directly cause death", async () => {
  const a = actor({ severity: 3, endurance: 3, hope: -6 });
  await applyDeathsDoorDrain(a);
  assert.equal(a.system.health.dead, false);
  assert.equal(deriveHealth(a.system).broken, false);
});
test("drain rejects nonowners, NPCs, dead and non-Death's Door actors", async () => {
  for (const severity of [0, 1, 2, 4]) assert.equal(await applyDeathsDoorDrain(actor({ severity })), false);
  const a = actor({ severity: 3 });
  a.isOwner = false;
  assert.equal(await applyDeathsDoorDrain(a), false);
  a.isOwner = true; a.type = "npc";
  assert.equal(await applyDeathsDoorDrain(a), false);
  assert.equal(await applyDeathsDoorDrain(actor({ severity: 3, dead: true })), false);
  assert.equal(a.updates.length, 0);
});
for (const face of [17, 18, 19, 20]) {
  test(`physical Fate Die ${face} grants Hope only to roller, never party`, async () => {
    const roller = actor({ hope: 0 }), ally = actor({ hope: 0 });
    const previousGame = globalThis.game;
    try {
      globalThis.game = { get actors() { throw new Error("Party must not be accessed"); } };
      await applyFateDieHope(roller, face);
      assert.equal(roller.system.resources.hope.value, face === 20 ? 2 : 1);
      assert.equal(ally.system.resources.hope.value, 0);
      assert.equal(ally.updates.length, 0);
    } finally { globalThis.game = previousGame; }
  });
}
test("Fate Hope clamps and rejects invalid faces, nonowners and NPCs", async () => {
  const a = actor();
  await applyFateDieHope(a, 20);
  assert.equal(a.system.resources.hope.value, 6);
  assert.equal(await applyFateDieHope(a, 20), false);
  for (const face of [1, 16, 21, 17.5, "20", NaN]) assert.equal(await applyFateDieHope(a, face), false);
  a.isOwner = false;
  assert.equal(await applyFateDieHope(a, 17), false);
  a.isOwner = true; a.type = "npc";
  assert.equal(await applyFateDieHope(a, 17), false);
  assert.equal(a.updates.length, 1);
});
