import { normalizeWoundCare } from "../wound-care.mjs";

/** Caller explicitly advances one fictional day; no rest effects or automatic healing. */
export async function advanceWoundCareDay(actor) {
  if (actor?.type !== "fated" || !actor.isOwner) return false;
  const { woundSeverity, woundCare } = actor.system.health;
  const normalized = normalizeWoundCare(woundSeverity, woundCare);
  // Incompatible care is left to the existing document normalization, never repaired here.
  if (normalized.care !== woundCare.care || normalized.daysRemaining !== woundCare.daysRemaining) return false;
  if (normalized.care === "none") return true;
  const daysRemaining = Math.max(0, normalized.daysRemaining - 1);
  const care = daysRemaining === 0 && normalized.care !== "grievousHealingPending" ? "none" : normalized.care;
  if (care === normalized.care && daysRemaining === normalized.daysRemaining) return true;
  await actor.update({ "system.health.woundCare": { care, daysRemaining } });
  return true;
}
