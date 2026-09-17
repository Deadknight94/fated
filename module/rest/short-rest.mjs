/**
 * Perform a Short Rest on a Fated Actor.
 *
 * @param {object} actor - The Foundry Actor document.
 * @param {object} [options] - Options for the rest.
 * @param {boolean} [options.spendHope=false] - Whether to spend 1 Hope for extra Endurance.
 * @param {number} [options.extraRecovery=0] - Extra Endurance to recover when spending Hope.
 * @param {number} [options.healingSuccesses] - Positive integer successes from a Healing check.
 * @returns {Promise<boolean>} - true if the rest succeeded, otherwise false.
 */
export async function shortRest(actor, { spendHope = false, extraRecovery = 0, healingSuccesses } = {}) {
  // Validate actor type and ownership.
  if (actor.type !== "fated" || !actor.isOwner) return false;
  if (typeof spendHope !== "boolean") return false;

  const { attributes, resources } = actor.system;
  const heart = Number(attributes.heart) || 0;
  const body = Number(attributes.body) || 0;
  const mind = Number(attributes.mind) || 0;

  const enduranceMax = body + heart;
  const hopeLimit = mind + heart;

  const hope = Number(resources.hope.value) || 0;
  const currentEndurance = Number(resources.endurance.value) || 0;

  // Wound severity and stabilization status
  const woundSeverity = Number(actor.system.health?.woundSeverity ?? 0);
  const stabilized = !!actor.system.health?.stabilized;

  // Terminal wound severities cannot rest
  if (woundSeverity >= 4) return false;

  // Validate Healing successes if provided.
  if (healingSuccesses !== undefined) {
    // Must be a positive integer.
    if (!Number.isInteger(healingSuccesses) || healingSuccesses <= 0) return false;
    // Bandageable severities are 1 (Light) and 2 (Grievous).
    if (woundSeverity !== 1 && woundSeverity !== 2) return false;
  }

  // Validate Hope spend eligibility.
  if (spendHope) {
    if (hope <= -hopeLimit) return false;
    if (!Number.isInteger(extraRecovery) || extraRecovery < 1 || extraRecovery > heart) return false;
  }

  // Calculate total recovery.
  const totalRecovery = 1 + (spendHope ? extraRecovery : 0);
  const newEndurance = Math.min(currentEndurance + totalRecovery, enduranceMax);

  // Death's Door stabilization recovery
  const deathDoorRecovery = woundSeverity === 3 && stabilized;

  // Commit both resources and wound changes together; Actor lifecycle performs persistent Hope clamping.
  const changes = {};
  if (deathDoorRecovery) {
    changes["system.health.woundSeverity"] = 2;
    changes["system.health.stabilized"] = false;
    changes["system.health.woundCare"] = { care: "none", daysRemaining: 0 };
  }
  if (newEndurance !== currentEndurance) {
    changes["system.resources.endurance.value"] = newEndurance;
  }
  if (spendHope) {
    changes["system.resources.hope.value"] = hope - 1;
  }
  if (healingSuccesses > 0) {
    // Apply bandaging; replace existing care with bandaged.
    changes["system.health.woundCare"] = { care: "bandaged", daysRemaining: healingSuccesses };
  }

  if (Object.keys(changes).length) await actor.update(changes);

  return true;
}
