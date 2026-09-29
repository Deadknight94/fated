/**
 * @file Combat lifecycle integration, registered as an import side effect from fated.mjs.
 * Filters updateCombat events to the originating client and round changes before
 * calling the phase service. No initiative ordering or declaration integration.
 * The referenced isManagedRoundAdvance guard is currently undefined/unimported,
 * so this path cannot be assumed to complete successfully.
 */
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
 *
 * Returns Promise<void>; qualifying events reach an unresolved guard reference
 * before startRound. No working managed-round guard is defined/imported here.
 * A successful startRound would write flags; no Actor data is updated directly.
 */
export async function synchronizeCombatRound(combat, changed, userId) {
  // Only react to an actual round change.
  if (!Object.hasOwn(changed, "round")) return;
  // Only the client that performed the update should do the sync.
  if (userId !== game.user.id) return;
  // This guard is referenced but not defined/imported in the current module.
  // Preserve the implementation; callers cannot rely on successful synchronization.
  if (isManagedRoundAdvance(combat)) return;
  await startRound(combat);
}

// Register the post‑update hook.
Hooks.on("updateCombat", (combat, changed, options, userId) => {
  // Fire‑and‑forget; the handler is async.
  void synchronizeCombatRound(combat, changed, userId);
});
