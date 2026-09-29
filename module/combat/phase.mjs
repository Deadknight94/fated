/**
 * @file Combat flag service. Read helpers inspect flags; async commands persist phase/acted
 * flags or advance Combat.round. Does not enforce action economy, resolve turns,
 * reset declarations or run health timers. Hook registration lives in hooks.mjs.
 */
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
 * Getters are synchronous. Commands persist flags or advance Combat.round;
 * they do not independently enforce when a combatant may act.
 */

/**
 * Get the current combat phase.
 * @param {Combat} combat
 * @returns {"players"|"adversaries"|undefined}
 *
 * Read-only flag access; may return undefined before initialization. No schema
 * field or phase validation is introduced by this getter.
 */
export function getCombatPhase(combat) {
  return combat.getFlag("fated", "phase");
}

/**
 * Has a combatant already acted this round?
 * @param {Combatant} combatant
 * @returns {boolean}
 *
 * Read-only flag access coerced to Boolean; an unset flag means false.
 */
export function hasCombatantActed(combatant) {
  return Boolean(combatant.getFlag("fated", "acted"));
}

/**
 * Set the phase to "players" and reset all combatants' acted flags.
 * @param {Combat} combat
 *
 * Persistent command returning Promise<void>. Writes phase first, then resets
 * combatant flags concurrently; these are multiple Document operations, not one
 * atomic update. Does not reset stance, declarations or resources.
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
 *
 * Persistent Combat.setFlag call only; does not mark combatants or enforce who
 * may act. Returns Promise<void>.
 */
export async function beginAdversaryPhase(combat) {
  await combat.setFlag("fated", "phase", "adversaries");
}

/**
 * Mark a combatant as having acted.
 * @param {Combatant} combatant
 *
 * Persistent Combatant.setFlag call; records bookkeeping without resolving an
 * Action or changing a locked checklist. Returns Promise<void>.
 */
export async function markActed(combatant) {
  await combatant.setFlag("fated", "acted", true);
}

/**
 * Revert an acted flag.
 * @param {Combatant} combatant
 *
 * Persistent Combatant.setFlag call clearing acted; does not undo gameplay or
 * refund resources. Returns Promise<void>.
 */
export async function undoActed(combatant) {
  await combatant.setFlag("fated", "acted", false);
}

/**
 * End the current round.  This simply advances the Foundry round counter;
 * phase/acted reset is delegated to the updateCombat integration (see below).
 * @param {Combat} combat
 *
 * Calls Combat.nextRound() and returns Promise<void>. Phase synchronization is
 * registered on updateCombat in hooks.mjs, whose unresolved guard currently
 * prevents reliable reset; this function does not perform resets itself.
 */
export async function endRound(combat) {
  await combat.nextRound();
}

