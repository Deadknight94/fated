import { calculateAction } from "./actions/actions.mjs";
import { normalizeWoundCare } from "./wound-care.mjs";
import { clampHope } from "./resources.mjs";

export const WOUND_LABELS = ["Healthy", "Light Wound", "Grievous Wound", "Death's Door", "Dead"];

/** Conditions are calculated, never independently stored/toggled. Accepts source or prepared data. */
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
  const broken = exhausted && despondent;
  const deathsDoor = severity === 3;
  const dead = severity >= 4 || system.health?.dead === true;
  const stabilized = deathsDoor && system.health?.stabilized === true;
  const incapacitated = deathsDoor || broken;
  return { severity, woundLabel: WOUND_LABELS[severity], overburdened, exhausted, inspired, despondent,
    broken, deathsDoor, dead, stabilized, incapacitated };
}

/** Only new causes reached while already incapacitated trigger second-incapacitation death. */
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

export function getActorHealth(actor) {
  return actor.type === "fated" && actor.system.resources ? deriveHealth(actor.system) : null;
}

export function actorStateModifiers(actor) {
  const state = getActorHealth(actor);
  if (!state) return { successThreshold: [] };
  const modifiers = [];
  const add = (condition, label, value) => modifiers.push({ id: `actor-${condition}`, label, value,
    source: { type: "actor-state", actorId: actor.id ?? "", actorUuid: actor.uuid ?? "", condition } });
  if (state.severity === 1 || state.severity === 2) add("wounds", state.woundLabel, state.severity);
  // Wound care modifiers
  const woundSeverity = state.severity;
  const { care } = normalizeWoundCare(woundSeverity, actor.system.health.woundCare || { care: "none" });
  if (woundSeverity === 1 || woundSeverity === 2) {
    if (care === "bandaged") add("bandaged", "Bandaged", -1);
    if (care === "treated" && woundSeverity === 2) add("treated", "Treated", -2);
  }
  if (state.overburdened) add("overburdened", "Overburdened", 1);
  if (state.exhausted) add("exhausted", "Exhausted", 1);
  if (state.inspired) add("inspired", "Inspired", -1);
  if (state.despondent) add("despondent", "Despondent", 1);
  return { successThreshold: modifiers };
}

export function calculateActorAction(actor, action, additionalModifiers = {}) {
  return calculateAction(action, actor.system.attributes, { ...additionalModifiers,
    successThreshold: [...actorStateModifiers(actor).successThreshold, ...(additionalModifiers.successThreshold ?? [])] });
}

export function healthLockIssue(state) {
  if (state?.dead) return "This Fated is Dead and cannot lock a Turn Declaration.";
  if (state?.incapacitated) return `This Fated is Incapacitated (${[state.deathsDoor && "Death's Door", state.broken && "Broken"].filter(Boolean).join(" and ")}) and cannot lock a normal Turn Declaration.`;
  return null;
}

/** Apply one simultaneous damage instance through the existing document health lifecycle. */
export async function applyWounds(actor, wounds) {
  if (actor.type !== "fated" || !actor.isOwner) throw new Error("You cannot update this Fated Actor.");
  if (!Number.isSafeInteger(wounds) || wounds < 0) throw new Error("Wounds must be a nonnegative whole number.");
  if (wounds === 0) return false;
  const severity = Math.min(4, actor.system.health.woundSeverity + wounds);
  if (severity === actor.system.health.woundSeverity) return false;
  await actor.update({ "system.health.woundSeverity": severity });
  return true;
}

/** Manual bookkeeping only; no recovery, timed drain or resurrection. */
export async function updateHealth(actor, operation, { isGM = false } = {}) {
  if (actor.type !== "fated" || !actor.isOwner) return false;
  const health = actor.system.health;
  if (operation.type === "wound" && [-1, 1].includes(operation.delta)) {
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

/** Small shared presentation model for Companion and GM desktop sheets. */
export function healthView(actor, { isGM = false } = {}) {
  const state = getActorHealth(actor);
  if (!state) return null;
  return { ...state, isGM, recordedDead: actor.system.health.dead,
    canDecreaseWound: actor.isOwner && state.severity > 0,
    canIncreaseWound: actor.isOwner && state.severity < 4,
    conditions: [state.overburdened && "Overburdened (+1)", state.exhausted && "Exhausted (+1)",
      state.inspired && "Inspired (−1)", state.despondent && "Despondent (+1)", state.broken && "Broken",
      state.incapacitated && "Incapacitated", state.dead && "Dead"].filter(Boolean) };
}
