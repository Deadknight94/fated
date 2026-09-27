import { actorStateModifiers, actorRollModifiers, getActorHealth } from "../health.mjs";

/** Only the system's Wound and wound-care contributions are suppressible. */
export function suppressibleWoundPenalty(system) {
  const modifiers = actorStateModifiers({ type: "fated", system }).successThreshold;
  return Math.max(0, modifiers.filter(m => ["wounds", "bandaged", "treated"].includes(m.source.condition))
    .reduce((sum, m) => sum + m.value, 0));
}

export function enduranceSpendIssue(spend, system) {
  if (!Number.isInteger(spend) || spend < 0 || spend > 2) return "Choose 0, 1 or 2 Endurance.";
  if (!spend) return null;
  if (!system?.resources || spend > system.resources.endurance.value) return "Not enough Endurance for this turn.";
  if (spend > suppressibleWoundPenalty(system)) return "Endurance spend exceeds the remaining Wound penalty.";
  return null;
}

/** Preview post-cost conditions without mutating the Actor or removing unrelated penalties. */
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

export function enduranceSpendOptions(actor, selected) {
  return [0, 1, 2].map(value => ({ value, selected: value === selected,
    disabled: Boolean(enduranceSpendIssue(value, actor.system)) }));
}
