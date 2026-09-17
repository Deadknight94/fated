// Long Rest resource recovery implementation

import { clampHope } from "../resources.mjs";

/**
 * Perform a Long Rest on a Fated Actor.
 * Restores Endurance by Body (capped at max), +1 Hope (clamped to positive limit),
 * and resets Power to 0.  The function optionally accepts a
 * `healingSuccesses` option representing a successful Healing check
 * performed during the Long Rest.
 *
 * When `healingSuccesses` is supplied it must be a positive integer and
 * the actor must have a wound severity of 1 (Light) or 2 (Grievous).
 * A successful Healing with:
 *   - Light wound: heals completely (severity 0, woundCare none)
 *   - Grievous wound: keeps severity 2 and applies treated care for the
 *     exact number of successes.
 *
 * The function validates all inputs before mutating data.  If the
 * validation fails, the function returns `false` and performs no updates.
 *
 * @param {object} actor - Foundry Actor document.
 * @param {object} [options]
 * @param {number} [options.healingSuccesses]
 * @returns {Promise<boolean>} true if rest succeeded, false otherwise.
 */
export async function longRest(actor, { healingSuccesses } = {}) {
  // Validate actor type and ownership.
  if (actor.type !== "fated" || !actor.isOwner) return false;

  const { attributes, resources, health } = actor.system;
  const heart = Number(attributes.heart) || 0;
  const body = Number(attributes.body) || 0;
  const enduranceMax = body + heart;

  const hope = Number(resources.hope.value) || 0;
  const currentEndurance = Number(resources.endurance.value) || 0;
  const currentPower = Number(resources.power) || 0;

  const woundSeverity = Number(health?.woundSeverity ?? 0);
  // Terminal severities cannot rest
  if (woundSeverity >= 4) return false;

  // Validate optional healingSuccesses
  const healingProvided = healingSuccesses !== undefined;
  if (healingProvided) {
    if (!Number.isInteger(healingSuccesses) || healingSuccesses <= 0) return false;
    if (woundSeverity !== 1 && woundSeverity !== 2) return false;
  }

  const newEndurance = Math.min(currentEndurance + body, enduranceMax);
  const newHope = clampHope(hope + 1, actor.system.attributes);
  const newPower = 0;

  const changes = {};
  if (newEndurance !== currentEndurance) changes["system.resources.endurance.value"] = newEndurance;
  if (newHope !== hope) changes["system.resources.hope.value"] = newHope;
  if (newPower !== currentPower) changes["system.resources.power"] = newPower;

  if (healingProvided) {
    if (woundSeverity === 1) {
      changes["system.health.woundSeverity"] = 0;
      changes["system.health.woundCare"] = { care: "none", daysRemaining: 0 };
    } else if (woundSeverity === 2) {
      changes["system.health.woundCare"] = { care: "treated", daysRemaining: healingSuccesses };
    }
  }

  if (Object.keys(changes).length) await actor.update(changes);
  return true;
}
