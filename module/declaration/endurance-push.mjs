/**
 * @file Pure turn-context projection for Endurance Push. Suppresses only the net system
 * Wound/care Threshold penalty and previews post-cost conditions. Actual Endurance
 * spending belongs to the declaration service when locking.
 */
import { actorStateModifiers, actorRollModifiers, getActorHealth } from "../health.mjs";

/**
 * Only the system's Wound and wound-care contributions are suppressible.
 *
 * Pure sum of system Wound/bandaged/treated Threshold entries, floored at zero.
 * Manual penalties are deliberately excluded even if their label mentions Wounds.
 */
export function suppressibleWoundPenalty(system) {
  const modifiers = actorStateModifiers({ type: "fated", system }).successThreshold;
  return Math.max(0, modifiers.filter(m => ["wounds", "bandaged", "treated"].includes(m.source.condition))
    .reduce((sum, m) => sum + m.value, 0));
}

/**
 * Pure validation of integer spend 0-2 against current Endurance and remaining
 * suppressible Wound penalty. Returns a system message or null; zero needs no cost.
 */
export function enduranceSpendIssue(spend, system) {
  if (!Number.isInteger(spend) || spend < 0 || spend > 2) return "Choose 0, 1 or 2 Endurance.";
  if (!spend) return null;
  if (!system?.resources || spend > system.resources.endurance.value) return "Not enough Endurance for this turn.";
  if (spend > suppressibleWoundPenalty(system)) return "Endurance spend exceeds the remaining Wound penalty.";
  return null;
}

/**
 * Preview post-cost conditions without mutating the Actor or removing unrelated penalties.
 *
 * Returns {modifiers, actorState} for a detached post-cost resource projection.
 * Invalid spend projects as zero; evaluator separately reports the issue. Retains
 * other penalties and manual provenance; never charges the Actor.
 */
export function endurancePushContext(actor, spend) {
  const validSpend = enduranceSpendIssue(spend, actor.system) ? 0 : spend;
  const system = { ...actor.system, resources: { ...actor.system.resources,
    endurance: { ...actor.system.resources.endurance, value: actor.system.resources.endurance.value - validSpend } } };
  const projected = { type: actor.type, id: actor.id, uuid: actor.uuid, system };
  const modifiers = actorRollModifiers(projected);
  if (validSpend) modifiers.successThreshold.push({
    id: "endurance-push", label: "Endurance Push", value: -validSpend,
    source: { type: "declaration", condition: "wound-suppression", enduranceSpend: validSpend,
      suppressedModifierId: "actor-wounds", actorId: actor.id ?? "", actorUuid: actor.uuid ?? "" }
  });
  return { modifiers, actorState: getActorHealth(projected) };
}

/**
 * Pure presentation options for 0/1/2: each has value, selected and disabled.
 * Validation is reused, but the returned buttons are not authorization to spend.
 */
export function enduranceSpendOptions(actor, selected) {
  return [0, 1, 2].map(value => ({ value, selected: value === selected,
    disabled: Boolean(enduranceSpendIssue(value, actor.system)) }));
}
