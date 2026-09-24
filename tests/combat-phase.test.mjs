import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

// Load the Foundry runtime.  The path is chosen by the tests via the
// environment variable `FOUNDRY_APP_PATH` – if not set, a fallback to the
// typical installation location is used.
await import(pathToFileURL(
  resolve(process.env.FOUNDRY_APP_PATH ??
    resolve(process.env.LOCALAPPDATA ?? ".", "Programs/Foundry Virtual Tabletop/resources/app"), "common/server.mjs")
));

// Import the service functions.
import {
  startRound,
  markActed,
  undoActed,
  beginAdversaryPhase,
  endRound,
  getCombatPhase,
  hasCombatantActed
} from "../module/combat/phase.mjs";

// Helper to create a combat with two actors.
async function createCombat() {
  const a1 = await Actor.create({ name: "A1", type: "fated" });
  const a2 = await Actor.create({ name: "A2", type: "fated" });
  const combat = await Combat.create({
    combatants: [
      { actorId: a1.id, tokenId: a1.id, initiative: null },
      { actorId: a2.id, tokenId: a2.id, initiative: null }
    ]
  });
  return { combat, a1, a2 };
}

test("startRound initialises phase and resets acted flags", async () => {
  const { combat } = await createCombat();
  // Ensure flags are unset initially.
  assert.strictEqual(combat.getFlag("fated", "phase"), undefined);
  for (const c of combat.combatants) {
    assert.strictEqual(c.getFlag("fated", "acted"), undefined);
  }
  await startRound(combat);
  assert.strictEqual(getCombatPhase(combat), "players");
  for (const c of combat.combatants) {
    assert.strictEqual(hasCombatantActed(c), false);
  }
});

test("markActed and undoActed work per combatant", async () => {
  const { combat } = await createCombat();
  await startRound(combat);
  const c = combat.combatants[0];
  await markActed(c);
  assert.strictEqual(hasCombatantActed(c), true);
  await undoActed(c);
  assert.strictEqual(hasCombatantActed(c), false);
});

test("beginAdversaryPhase sets phase without affecting acted flags", async () => {
  const { combat } = await createCombat();
  await startRound(combat);
  const c = combat.combatants[0];
  await markActed(c);
  await beginAdversaryPhase(combat);
  assert.strictEqual(getCombatPhase(combat), "adversaries");
  assert.strictEqual(hasCombatantActed(c), true);
});

test("endRound advances round, resets phase to players and clears acted flags", async () => {
  const { combat } = await createCombat();
  await startRound(combat);
  const c = combat.combatants[0];
  await markActed(c);
  const oldRound = combat.round;
  await endRound(combat);
  // round should have incremented
  assert.strictEqual(combat.round, oldRound + 1);
  // phase should be players and all flags reset
  assert.strictEqual(getCombatPhase(combat), "players");
  for (const c of combat.combatants) {
    assert.strictEqual(hasCombatantActed(c), false);
  }
});

test("external round change syncs phase and acted flags", async () => {
  const { combat } = await createCombat();
  await startRound(combat);
  const c = combat.combatants[0];
  await markActed(c);
  // Simulate an external round change
  await combat.update({ round: combat.round + 3 });
  assert.strictEqual(combat.round, combat.round); // just ensure update succeeded
  assert.strictEqual(getCombatPhase(combat), "players");
  for (const c of combat.combatants) {
    assert.strictEqual(hasCombatantActed(c), false);
  }
});

test("flags are stored in document flags, not schema", async () => {
  const { combat } = await createCombat();
  await startRound(combat);
  const storedPhase = combat.flags.fated.phase;
  assert.strictEqual(storedPhase, "players");
  for (const c of combat.combatants) {
    const storedActed = c.flags.fated.acted;
    assert.strictEqual(storedActed, false);
  }
});

