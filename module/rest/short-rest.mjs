/**
 * Perform a Short Rest on a Fated Actor.
 *
 * @param {object} actor - The Foundry Actor document.
 * @param {object} [options] - Options for the rest.
 * @param {boolean} [options.spendHope=false] - Whether to spend 1 Hope for extra Endurance.
 * @param {number} [options.extraRecovery=0] - Extra Endurance to recover when spending Hope.
 * @returns {Promise<boolean>} - true if the rest succeeded, otherwise false.
 */
export async function shortRest(actor, { spendHope = false, extraRecovery = 0 } = {}) {
  // Validate actor type and ownership.
  if (actor.type !== "fated" || !actor.isOwner) return false;

  const { attributes, resources } = actor.system;
  const heart = Number(attributes.heart) || 0;
  const body = Number(attributes.body) || 0;
  const mind = Number(attributes.mind) || 0;

  const enduranceMax = body + heart;
  const hopeLimit = mind + heart;

  const hope = Number(resources.hope.value) || 0;
  const currentEndurance = Number(resources.endurance.value) || 0;

  // Validate Hope spend eligibility.
  if (spendHope) {
    if (hope <= -hopeLimit) return false;
    if (!Number.isInteger(extraRecovery) || extraRecovery < 1 || extraRecovery > heart) return false;
  }

  // Calculate total recovery.
  const totalRecovery = 1 + (spendHope ? extraRecovery : 0);
  const newEndurance = Math.min(currentEndurance + totalRecovery, enduranceMax);

  // Commit both resources together; Actor lifecycle performs persistent Hope clamping.
  const changes = {};
  if (newEndurance !== currentEndurance) {
    changes["system.resources.endurance.value"] = newEndurance;
  }
  if (spendHope) {
    changes["system.resources.hope.value"] = hope - 1;
  }
  if (Object.keys(changes).length) await actor.update(changes);

  return true;
}
