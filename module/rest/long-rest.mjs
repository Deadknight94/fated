// Long Rest resource recovery implementation

import { clampHope } from "../resources.mjs";

/**
 * Perform a Long Rest on a Fated Actor.
 * Restores Endurance by Body (capped at max), +1 Hope (clamped to positive limit),
 * and resets Power to 0. All changes occur in a single Actor update.
 *
 * @param {object} actor - Foundry Actor document.
 * @returns {Promise<boolean>} true if rest succeeded, false otherwise.
 */
export async function longRest(actor) {
  // Validate actor type and ownership.
  if (actor.type !== "fated" || !actor.isOwner) return false;

  const { attributes, resources, health } = actor.system;
  const heart = Number(attributes.heart) || 0;
  const body = Number(attributes.body) || 0;
  
  const enduranceMax = body + heart;
  

  const hope = Number(resources.hope.value) || 0;
  const currentEndurance = Number(resources.endurance.value) || 0;
  const currentPower = Number(resources.power) || 0;

  // Terminal wound severities cannot rest
  const woundSeverity = Number(health?.woundSeverity ?? 0);
  if (woundSeverity >= 4) return false;

  const newEndurance = Math.min(currentEndurance + body, enduranceMax);
  const newHope = clampHope(hope + 1, actor.system.attributes);
  const newPower = 0;

  const changes = {};
  if (newEndurance !== currentEndurance) {
    changes["system.resources.endurance.value"] = newEndurance;
  }
  if (newHope !== hope) {
    changes["system.resources.hope.value"] = newHope;
  }
  if (newPower !== currentPower) {
    changes["system.resources.power"] = newPower;
  }

  if (Object.keys(changes).length) {
    await actor.update(changes);
  }
  return true;
}
