/**
 * @file Health rule/service layer. Pure projections derive conditions and roll modifiers;
 * explicit async operations persist Wound events or manual bookkeeping via Actor.update().
 * Data Model hooks own history-sensitive death normalization. No timers, witness
 * discovery or dice rolling are installed here; sheets localize the returned text.
 */
import { calculateActionFromActorData } from "./actions/actions.mjs";
import { normalizeWoundCare, manualWoundCareChoices } from "./wound-care.mjs";
import { adjustResource, clampHope } from "./resources.mjs";

/**
 * English severity labels indexed 0 through 4; localizedHealth translates by
 * severity at display time. These labels are not stored condition flags.
 */
export const WOUND_LABELS = ["Healthy", "Light Wound", "Grievous Wound", "Death's Door", "Dead"];

/**
 * Conditions are calculated, never independently stored/toggled. Accepts source or prepared data.
 *
 * Pure calculation from system attributes, resources, Load and health. Returns
 * severity, display label, resource/health condition booleans and the single
 * Hope Threshold tier. Does not infer historical death from simultaneous causes.
 */
export function deriveHealth(system) {
  const severity = Math.min(4, system.health?.woundSeverity ?? 0);
  const { heart, body, mind } = system.attributes;
  const endurance = Math.max(0, Math.min(system.resources.endurance.value, body + heart));
  const hope = clampHope(system.resources.hope.value, system.attributes);
  const limit = heart + mind;
  const overburdened = system.load > endurance;
  const exhausted = endurance === 0;
  const inspired = limit > 0 && hope === limit;
  const despondent = limit > 0 && hope === -limit;
  const hopeThresholdModifier = inspired ? -2 : limit > 0 && hope > 0 ? -1 : despondent ? 1 : 0;
  const broken = exhausted && despondent;
  const deathsDoor = severity === 3;
  const dead = severity >= 4 || system.health?.dead === true;
  const stabilized = deathsDoor && system.health?.stabilized === true;
  const incapacitated = deathsDoor || broken;
  return { severity, woundLabel: WOUND_LABELS[severity], overburdened, exhausted, inspired, despondent,
    hopeThresholdModifier, broken, deathsDoor, dead, stabilized, incapacitated };
}

/**
 * Only new causes reached while already incapacitated trigger second-incapacitation death.
 *
 * Pure comparison of previous/proposed system data; returns {dead, stabilized}
 * for Data Model hooks to persist. Administrative correction bypasses retained
 * death, but cannot override terminal severity. Neither input is mutated.
 */
export function healthTransition(previous, next, { administrativeCorrection = false } = {}) {
  const before = deriveHealth(previous);
  const after = deriveHealth(next);
  const newCause = (!before.deathsDoor && after.deathsDoor) || (!before.broken && after.broken);
  const secondIncapacitation = !before.dead && before.incapacitated && newCause;
  return {
    dead: after.severity >= 4 || next.health.dead || (!administrativeCorrection && (before.dead || secondIncapacitation)),
    stabilized: after.deathsDoor && before.deathsDoor && next.health.stabilized === true
  };
}

/**
 * Read-only Actor adapter for deriveHealth; returns the condition object or null
 * for unsupported Actors. Does not update a Foundry Document.
 */
export function getActorHealth(actor) {
  return actor.type === "fated" && actor.system.resources ? deriveHealth(actor.system) : null;
}

/**
 * Pure Actor-state projection returning {successThreshold: [...]} with stable
 * condition IDs and Actor provenance. Care offsets Wound penalties separately;
 * manual and contextual Action modifiers are added elsewhere.
 */
export function actorStateModifiers(actor) {
  const state = getActorHealth(actor);
  if (!state) return { successThreshold: [] };
  const modifiers = [];
  const add = (condition, label, value) => modifiers.push({ id: `actor-${condition}`, label, value,
    source: { type: "actor-state", actorId: actor.id ?? "", actorUuid: actor.uuid ?? "", condition } });
  if (state.severity === 1 || state.severity === 2) add("wounds", state.woundLabel, state.severity);
  // Wound care modifiers
  const woundSeverity = state.severity;
  const { care } = normalizeWoundCare(state.dead ? 4 : woundSeverity, actor.system.health.woundCare || { care: "none" });
  if (woundSeverity === 1 || woundSeverity === 2) {
    if (care === "bandaged") add("bandaged", "Bandaged", -1);
    if (care === "treated" && woundSeverity === 2) add("treated", "Treated", -2);
  }
  if (state.overburdened) add("overburdened", "Overburdened", 1);
  if (state.exhausted) add("exhausted", "Exhausted", 1);
  if (state.hopeThresholdModifier) add("hope", "Hope", state.hopeThresholdModifier);
  return { successThreshold: modifiers };
}

/**
 * Read-only Action calculation adapter combining Actor-wide and caller-provided
 * modifier arrays, then resolving dice from Actor system data. Returns separate
 * dice/Threshold breakdowns and source provenance; no dice or updates occur.
 */
export function calculateActorAction(actor, action, additionalModifiers = {}) {
  const global = actorRollModifiers(actor);
  return calculateActionFromActorData(action, actor.system, { ...additionalModifiers,
    successDice: [...global.successDice, ...(additionalModifiers.successDice ?? [])],
    successThreshold: [...global.successThreshold, ...(additionalModifiers.successThreshold ?? [])] });
}

/**
 * Actor-wide modifiers only; contextual Action/turn modifiers belong to callers.
 *
 * Pure projection returning separate successDice/successThreshold arrays. Adds
 * valid stored manual entries with actor-manual provenance; preserves authored
 * labels and does not include stance, Item, Multi-Action or Endurance Push context.
 */
export function actorRollModifiers(actor) {
  const result = { successDice: [], successThreshold: [...actorStateModifiers(actor).successThreshold] };
  if (actor.type !== "fated") return result;
  for (const modifier of actor.system.manualRollModifiers ?? []) {
    if (!Object.hasOwn(result, modifier.type) || !Number.isInteger(modifier.value)) continue;
    result[modifier.type].push({ id: modifier.id, label: modifier.label, value: modifier.value,
      source: { type: "actor-manual", actorId: actor.id ?? "", actorUuid: actor.uuid ?? "" } });
  }
  return result;
}

/**
 * Pure lock gate from derived health; returns an English system message for
 * Dead/Incapacitated state, otherwise null. Presentation localizes the message.
 */
export function healthLockIssue(state) {
  if (state?.dead) return "This Fated is Dead and cannot lock a Turn Declaration.";
  if (state?.incapacitated) return `This Fated is Incapacitated (${[state.deathsDoor && "Death's Door", state.broken && "Broken"].filter(Boolean).join(" and ")}) and cannot lock a normal Turn Declaration.`;
  return null;
}

/**
 * Pure projection of one simultaneous wound instance, including treatment reopening.
 *
 * Accepts stored health and a nonnegative safe-integer Wound count; returns
 * woundSeverity, treatmentReopened and normalized woundCare. A treated Grievous
 * Wound consumes the first incoming Wound; remaining simultaneous Wounds count.
 * Throws on invalid counts and never mutates health.
 */
export function projectWounds(health, wounds) {
  if (!Number.isSafeInteger(wounds) || wounds < 0) throw new Error("Wounds must be a nonnegative whole number.");
  const woundCare = normalizeWoundCare(health.woundSeverity, health.woundCare);
  const treatmentReopened = wounds > 0 && health.dead !== true && health.woundSeverity === 2 && woundCare.care === "treated";
  const woundSeverity = Math.min(4, health.woundSeverity + wounds - (treatmentReopened ? 1 : 0));
  return { woundSeverity, treatmentReopened,
    woundCare: normalizeWoundCare(woundSeverity, treatmentReopened ? { care: "none", daysRemaining: 0 } : woundCare) };
}

/**
 * Apply one simultaneous damage instance through the existing document health lifecycle.
 *
 * Persistent Wound-event API for an owned Fated Actor. Includes final-severity
 * self-Hope loss and any treatment reopening in one Actor.update(). Returns
 * true after a write, false for zero/no change; invalid inputs throw. Manual
 * severity correction uses updateHealth and does not share this Hope-loss path.
 */
export async function applyWounds(actor, wounds) {
  if (actor.type !== "fated" || !actor.isOwner) throw new Error("You cannot update this Fated Actor.");
  if (!Number.isSafeInteger(wounds) || wounds < 0) throw new Error("Wounds must be a nonnegative whole number.");
  if (wounds === 0) return false;
  const projection = projectWounds(actor.system.health, wounds);
  if (projection.woundSeverity === actor.system.health.woundSeverity && !projection.treatmentReopened) return false;
  const changes = { "system.health.woundSeverity": projection.woundSeverity };
  const hope = actor.system.resources.hope.value;
  // One simultaneous event uses only the resulting severity, not each crossed step.
  const loss = projection.woundSeverity === 1 ? Math.max(1, Math.ceil(hope / 2))
    : projection.woundSeverity === 2 ? Math.ceil((actor.system.attributes.heart + actor.system.attributes.mind) / 2) : 0;
  if (loss) changes["system.resources.hope.value"] = clampHope(hope - loss, actor.system.attributes);
  if (projection.treatmentReopened) changes["system.health.woundCare"] = projection.woundCare;
  await actor.update(changes);
  return true;
}

/**
 * Explicit witnesses only: call once per witness per simultaneous Wound event.
 *
 * Persists 1/2/3 Hope loss for a supplied final severity of 1/2/3 via Actor.update().
 * Returns false for unsupported/non-owner/no-change cases, true after writing.
 * This API does not discover witnesses or prevent duplicate event calls.
 */
export async function applyWitnessedWoundHopeLoss(actor, resultingSeverity) {
  if (actor.type !== "fated" || !actor.isOwner || ![1, 2, 3].includes(resultingSeverity)) return false;
  const hope = actor.system.resources.hope.value;
  const value = clampHope(hope - resultingSeverity, actor.system.attributes);
  if (value === hope) return false;
  await actor.update({ "system.resources.hope.value": value });
  return true;
}

/**
 * One elapsed combat round or out-of-combat hour; caller owns timing, never both.
 *
 * Persists one explicit unstabilized living Death's Door tick through
 * adjustResource: Endurance first, Hope only if already Exhausted. Returns
 * false when inapplicable; installs no combat or world-time hook.
 */
export async function applyDeathsDoorDrain(actor) {
  if (actor.type !== "fated" || !actor.isOwner) return false;
  const state = getActorHealth(actor);
  if (!state.deathsDoor || state.stabilized || state.dead) return false;
  return adjustResource(actor, state.exhausted ? "hope" : "endurance", -1);
}

/**
 * Manual correction is separate from Wound-event Hope loss and rest recovery.
 *
 * Dispatches care, severity +/-1, stabilization or GM death-correction operations.
 * Returns a Promise<boolean>; permitted operations call Actor.update(), whose
 * lifecycle validates the transition. This is manual correction, not a Wound event.
 */
export async function updateHealth(actor, operation, { isGM = false } = {}) {
  if (actor.type !== "fated" || !actor.isOwner) return false;
  const health = actor.system.health;
  if (operation.type === "care") {
    if (!manualWoundCareChoices(health.woundSeverity, health.dead).includes(operation.care)) return false;
    await actor.update({ "system.health.woundCare": normalizeWoundCare(health.dead ? 4 : health.woundSeverity,
      { ...health.woundCare, care: operation.care }) });
  } else if (operation.type === "wound" && [-1, 1].includes(operation.delta)) {
    const value = Math.max(0, Math.min(4, health.woundSeverity + operation.delta));
    if (value === health.woundSeverity) return false;
    await actor.update({ "system.health.woundSeverity": value });
  } else if (operation.type === "stabilize" && health.woundSeverity === 3) {
    await actor.update({ "system.health.stabilized": !health.stabilized });
  } else if (operation.type === "correct-death" && isGM) {
    await actor.update({ "system.health.dead": !health.dead });
  } else return false;
  return true;
}

/**
 * Small shared presentation model for Companion and GM desktop sheets.
 *
 * Read-only presentation projection adding care choices, control eligibility and
 * condition strings to derived health; returns null for unsupported Actors.
 * The consumer must apply localizedHealth before rendering system labels.
 */
export function healthView(actor, { isGM = false } = {}) {
  const state = getActorHealth(actor);
  if (!state) return null;
  return { ...state, isGM, recordedDead: actor.system.health.dead,
    care: normalizeWoundCare(state.dead ? 4 : state.severity, actor.system.health.woundCare).care,
    careChoices: !state.dead && [1, 2].includes(state.severity) ? manualWoundCareChoices(state.severity) : [],
    canDecreaseWound: actor.isOwner && state.severity > 0,
    canIncreaseWound: actor.isOwner && state.severity < 4,
    conditions: [state.overburdened && "Overburdened (+1)", state.exhausted && "Exhausted (+1)",
      state.inspired && "Inspired (−2)",
      state.hopeThresholdModifier === -1 && "Hope (−1)",
      state.despondent && "Despondent (+1)", state.broken && "Broken",
      state.incapacitated && "Incapacitated", state.dead && "Dead"].filter(Boolean) };
}
