/**
 * @file Resource bookkeeping services used by mobile controls and health services.
 * clampHope is pure; async helpers update an owned Fated Actor. Physical Fate Die
 * Hope entry is explicit and does not roll dice, generate Shadow or scan the party.
 */
/**
 * Shared bound for prepared values and persistent document corrections.
 *
 * Pure numeric bound within +/- (Heart + Mind), returning zero rather than -0.
 * Used both for prepared projections and pending persistent source correction.
 */
export function clampHope(value, { heart, mind }) {
  const limit = heart + mind;
  return Math.max(-limit, Math.min(limit, value)) || 0;
}

/**
 * Record Hope from an explicitly supplied physical Fate Die; only its roller is updated.
 *
 * Accepts only integer faces 17-20: +1 Hope for 17-19, +2 for 20. Returns
 * Promise<boolean>, false for ineligible/no-change cases; otherwise writes one
 * Actor update. Other Fate Die outcomes are outside this helper.
 */
export async function applyFateDieHope(actor, face) {
  if (actor.type !== "fated" || !actor.isOwner || !Number.isInteger(face) || face < 17 || face > 20) return false;
  const hope = actor.system.resources.hope.value;
  const value = clampHope(hope + (face === 20 ? 2 : 1), actor.system.attributes);
  if (value === hope) return false;
  await actor.update({ "system.resources.hope.value": value });
  return true;
}

/**
 * Manual +/-1 resource bookkeeping shared with explicit health drain.
 *
 * Persists one +/-1 adjustment to Endurance, Hope or Power on an owned Fated.
 * Applies resource bounds and returns false for invalid/no-change requests, true
 * after Actor.update(). Generic Endurance decrement does not convert loss to Hope.
 */
export async function adjustResource(actor, resource, delta) {
  if (actor.type !== "fated" || !actor.isOwner) return false;
  if (!["endurance", "hope", "power"].includes(resource) || ![-1, 1].includes(delta)) return false;
  const current = resource === "power" ? actor.system.resources.power : actor.system.resources[resource].value;
  let value = current + delta;
  if (resource === "hope") {
    value = clampHope(value, actor.system.attributes);
  } else if (resource === "power") {
    // Power has a derived maximum of heart + body + mind.
    const limit = actor.system.attributes.heart + actor.system.attributes.body + actor.system.attributes.mind;
    value = Math.max(0, Math.min(value, limit));
  } else {
    // The remaining supported resource is Endurance, bounded by prepared max.
    value = Math.max(0, resource === "endurance" ? Math.min(value, actor.system.resources.endurance.max) : value);
  }
  if (value === current) return false;
  const path = resource === "power" ? "system.resources.power" : `system.resources.${resource}.value`;
  await actor.update({ [path]: value });
  return true;
}
