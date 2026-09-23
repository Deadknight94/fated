import { actionDamage, calculateDefense } from "./defense.mjs";
import { applyWounds, getActorHealth, projectWounds } from "./health.mjs";

const nonnegative = (value, label) => {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a nonnegative number.`);
  return value;
};

/** Pure physical-result preview. Manual final Damage bypasses Action-based Damage calculation. */
export function previewDamage({ attacker, action, item, target, successes, damagePerSuccess,
  finalDamage, finalDamageModifiers = [] }) {
  if (target?.type !== "fated") throw new Error("Wound bookkeeping requires a Fated target.");
  const defense = calculateDefense(target);
  const manual = finalDamage !== undefined;
  let baseTotalDamage, modifiers;
  if (manual) {
    baseTotalDamage = nonnegative(finalDamage, "Final Damage");
    modifiers = [];
    successes = null; damagePerSuccess = null;
  } else {
    nonnegative(successes, "Physical Successes");
    if (!Number.isSafeInteger(successes)) throw new Error("Physical Successes must be a whole number.");
    damagePerSuccess = damagePerSuccess ?? actionDamage(action, item);
    nonnegative(damagePerSuccess, "Damage per Success");
    baseTotalDamage = successes * damagePerSuccess;
    modifiers = finalDamageModifiers.map(m => ({ ...m }));
    if (modifiers.some(m => !Number.isFinite(m.value) || !m.label || !m.source)) throw new Error("Final-damage modifiers require a value, label and source.");
  }
  const total = Math.max(0, baseTotalDamage + modifiers.reduce((sum, m) => sum + m.value, 0));
  if (!Number.isFinite(total)) throw new Error("Damage total is not finite.");
  const wounds = Math.floor(total / defense.total);
  if (!Number.isSafeInteger(wounds)) throw new Error("Wound count is too large.");
  const projection = projectWounds(target.system.health, wounds);
  return { manual, successes, damagePerSuccess, baseTotalDamage, finalDamageModifiers: modifiers,
    finalDamage: total, targetDefense: defense.total, defense, wounds, targetHealth: getActorHealth(target),
    targetWoundCare: projectWounds(target.system.health, 0).woundCare,
    treatmentReopened: projection.treatmentReopened, resultingWoundCare: projection.woundCare,
    resultingWoundSeverity: projection.woundSeverity };
}

/** Recalculate from current documents; never trust a caller-supplied wound preview. */
export async function applyDamage(input) {
  if (!input.target?.isOwner) throw new Error("You cannot update this target Actor.");
  const result = previewDamage(input);
  await applyWounds(input.target, result.wounds);
  return { ...result, resultingWoundSeverity: input.target.system.health.woundSeverity };
}
