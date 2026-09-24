/**
 * Register hooks for the combat phase service.
 *
 * The hooks keep the Fated combat flags in sync with Foundry's built‑in
 * combat lifecycle events.  No hooks are added that modify the combat order
 * or initiative – the system deliberately does not use those.
 */

import { startRound } from "./phase.mjs";

/**
 * Synchronise the Fated combat flags after a round change.
 * The function is exported for unit testing.
 *
 * @param {Combat} combat
 * @param {object} changed
 * @param {string} userId
 */
export async function synchronizeCombatRound(combat, changed, userId) {
  // Only react to an actual round change.
  if (!Object.hasOwn(changed, "round")) return;
  // Only the client that performed the update should do the sync.
  if (userId !== game.user.id) return;
  // If this round advance was performed via endRound(), the guard will
  // prevent double‑reset.
  if (isManagedRoundAdvance(combat)) return;
  await startRound(combat);
}

// Register the post‑update hook.
Hooks.on("updateCombat", (combat, changed, options, userId) => {
  // Fire‑and‑forget; the handler is async.
  void synchronizeCombatRound(combat, changed, userId);
});
