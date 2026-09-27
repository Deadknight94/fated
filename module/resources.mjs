/** Shared bound for prepared values and persistent document corrections. */
export function clampHope(value, { heart, mind }) {
  const limit = heart + mind;
  return Math.max(-limit, Math.min(limit, value)) || 0;
}

/** Record Hope from an explicitly supplied physical Fate Die; only its roller is updated. */
export async function applyFateDieHope(actor, face) {
  if (actor.type !== "fated" || !actor.isOwner || !Number.isInteger(face) || face < 17 || face > 20) return false;
  const hope = actor.system.resources.hope.value;
  const value = clampHope(hope + (face === 20 ? 2 : 1), actor.system.attributes);
  if (value === hope) return false;
  await actor.update({ "system.resources.hope.value": value });
  return true;
}

/** Only these manual bookkeeping controls may issue resource updates. */
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
    // Endurance is capped by its max; other resources have no upper bound here.
    value = Math.max(0, resource === "endurance" ? Math.min(value, actor.system.resources.endurance.max) : value);
  }
  if (value === current) return false;
  const path = resource === "power" ? "system.resources.power" : `system.resources.${resource}.value`;
  await actor.update({ [path]: value });
  return true;
}
