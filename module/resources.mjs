/** Shared bound for prepared values and persistent document corrections. */
export function clampHope(value, { heart, mind }) {
  const limit = heart + mind;
  return Math.max(-limit, Math.min(limit, value)) || 0;
}

/** Only these manual bookkeeping controls may issue resource updates. */
export async function adjustResource(actor, resource, delta) {
  if (actor.type !== "fated" || !actor.isOwner) return false;
  if (!["endurance", "hope", "power"].includes(resource) || ![-1, 1].includes(delta)) return false;
  const current = resource === "power" ? actor.system.resources.power : actor.system.resources[resource].value;
  let value = current + delta;
  if (resource === "hope") value = clampHope(value, actor.system.attributes);
  else value = Math.max(0, resource === "endurance" ? Math.min(value, actor.system.resources.endurance.max) : value);
  if (value === current) return false;
  const path = resource === "power" ? "system.resources.power" : `system.resources.${resource}.value`;
  await actor.update({ [path]: value });
  return true;
}
