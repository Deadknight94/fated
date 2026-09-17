import { clampHope } from "../resources.mjs";

/** Beginning of an already fictionally authorized Extended Rest; no elapsed-time tracking. */
export async function beginExtendedRest(actor) {
  if (actor?.type !== "fated" || !actor.isOwner) return false;
  if (actor.system.health.woundSeverity >= 4) return false;
  if (actor.system.resources.power !== 0) await actor.update({ "system.resources.power": 0 });
  return true;
}

/** One explicitly completed fictional day: full Endurance and +1 Hope, leaving Power alone. */
export async function completeExtendedRestDay(actor, { healingSuccesses } = {}) {
  if (actor?.type !== "fated" || !actor.isOwner) return false;
  const { attributes, resources, health } = actor.system;
  if (health.woundSeverity >= 4) return false;
  const healingProvided = healingSuccesses !== undefined;
  if (healingProvided && (!Number.isInteger(healingSuccesses) || healingSuccesses <= 0 || health.woundSeverity !== 2)) return false;
  const endurance = attributes.body + attributes.heart;
  const hope = clampHope(resources.hope.value + 1, attributes);
  const changes = {};
  if (endurance !== resources.endurance.value) changes["system.resources.endurance.value"] = endurance;
  if (hope !== resources.hope.value) changes["system.resources.hope.value"] = hope;
  if (health.woundSeverity === 1) {
    changes["system.health.woundSeverity"] = 0;
    changes["system.health.woundCare"] = { care: "none", daysRemaining: 0 };
  } else if (healingProvided) {
    changes["system.health.woundCare"] = { care: "grievousHealingPending", daysRemaining: 1 };
  }
  if (Object.keys(changes).length) await actor.update(changes);
  return true;
}

/** Caller confirms the scheduled 24 fictional hours have passed; resources are untouched. */
export async function completeExtendedRestGrievousHealing(actor) {
  if (actor?.type !== "fated" || !actor.isOwner) return false;
  const { health } = actor.system;
  if (health.woundSeverity !== 2 || health.woundCare.care !== "grievousHealingPending" || health.woundCare.daysRemaining !== 0) return false;
  await actor.update({ "system.health.woundSeverity": 0,
    "system.health.woundCare": { care: "none", daysRemaining: 0 } });
  return true;
}
