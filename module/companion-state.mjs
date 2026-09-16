/** Small desktop windows and touch tablets (including 1366×1024 iPads). No UA sniffing. */
export function shouldActivateCompanion({ isGM, width, height, touch = false, coarse = false }) {
  return !isGM && (width <= 1024 || ((touch || coarse) && Math.min(width, height) <= 1024));
}

export function companionCharacterState(user) {
  const actor = user.character;
  if (!actor) return { actor: null, message: "No Fated character is assigned to your User. Ask the GM to assign your character in Foundry's User configuration." };
  if (actor.type !== "fated") return { actor: null, message: `Your assigned character (${actor.name}) is not a Fated Actor. Companion Mode supports Fated characters only.` };
  if (!actor.testUserPermission(user, "OBSERVER")) return { actor: null, message: "Your assigned Fated character is unavailable. Ask the GM to check your Actor permissions." };
  return { actor, message: "" };
}
