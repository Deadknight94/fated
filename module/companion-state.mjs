/**
 * @file Read-only Companion activation and linked-character selection helpers. Uses
 * viewport capabilities and native User permissions, not browser identity.
 * DOM lifecycle and shell synchronization belong to companion.mjs.
 */
/**
 * Small desktop windows and touch tablets (including 1366×1024 iPads). No UA sniffing.
 *
 * Pure viewport predicate returning false for GMs. Narrow desktops qualify;
 * touch/coarse devices use the smaller dimension to allow tablet landscape.
 */
export function shouldActivateCompanion({ isGM, width, height, touch = false, coarse = false }) {
  return !isGM && (width <= 1024 || ((touch || coarse) && Math.min(width, height) <= 1024));
}

/**
 * Read-only User.character selection and OBSERVER permission check. Returns
 * {actor, message}; unavailable/wrong-type Actors become null with a system
 * message for presentation. It does not assign a character or grant ownership.
 */
export function companionCharacterState(user) {
  const actor = user.character;
  if (!actor) return { actor: null, message: "No Fated character is assigned to your User. Ask the GM to assign your character in Foundry's User configuration." };
  if (actor.type !== "fated") return { actor: null, message: `Your assigned character (${actor.name}) is not a Fated Actor. Companion Mode supports Fated characters only.` };
  if (!actor.testUserPermission(user, "OBSERVER")) return { actor: null, message: "Your assigned Fated character is unavailable. Ask the GM to check your Actor permissions." };
  return { actor, message: "" };
}
