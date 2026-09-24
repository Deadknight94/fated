/**
 * Combat phase and acted state utilities for the Fated system.
 *
 * The Fated system does not use initiative or a fixed turn order.  A combat
 * round is divided into two phases – the *player phase* and the *adversary
 * phase* – and each combatant may act once per round unless the rules
 * explicitly allow otherwise.  This module stores the current phase and a
 * per‑combatant "acted" flag in document flags, rather than altering the
 * combat or combatant schema.
 *
 * All functions are async and perform the minimal number of writes needed
 * to keep the state in sync with Foundry's built‑in `Combat.round` field.
 */

/**
 * Get the current combat phase.
 * @param {Combat} combat
 * @returns {"players"|"adversaries"|undefined}
 */
export function getCombatPhase(combat) {
  return combat.getFlag("fated", "phase");
}

/**
 * Has a combatant already acted this round?
 * @param {Combatant} combatant
 * @returns {boolean}
 */
export function hasCombatantActed(combatant) {
  return Boolean(combatant.getFlag("fated", "acted"));
}

/**
 * Set the phase to "players" and reset all combatants' acted flags.
 * @param {Combat} combat
 */
export async function startRound(combat) {
  // Phase is always players at the start of a round.
  await combat.setFlag("fated", "phase", "players");
  // Reset acted flags for every combatant.
  await Promise.all(
    combat.combatants.map((c) => c.setFlag("fated", "acted", false))
  );
}

/**
 * Transition to the adversary phase.
 * @param {Combat} combat
 */
export async function beginAdversaryPhase(combat) {
  await combat.setFlag("fated", "phase", "adversaries");
}

/**
 * Mark a combatant as having acted.
 * @param {Combatant} combatant
 */
export async function markActed(combatant) {
  await combatant.setFlag("fated", "acted", true);
}

/**
 * Revert an acted flag.
 * @param {Combatant} combatant
 */
export async function undoActed(combatant) {
  await combatant.setFlag("fated", "acted", false);
}

/**
 * End the current round.  This simply advances the Foundry round counter;
 * the `combatRound` hook will reset the phase to players and clear all
 * acted flags.
 * @param {Combat} combat
 */
export async function endRound(combat) {
  await combat.nextRound();
}

