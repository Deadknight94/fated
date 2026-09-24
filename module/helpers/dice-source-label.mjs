// Helper for formatting the source label of a dice pool.
// It inspects the calculation result from `calculateActorAction` and
// uses the action definition and the actor data to produce a
// human‑readable label.
//
// Examples:
//   - Proficiency: "Long Swords 3"
//   - Proficiency level 0: "Long Swords 0 (Untrained)"
//   - Skill: "Stealth 4"
//   - Missing proficiency: "Missing Proficiency: swords"
//   - Missing skill: "Missing Skill: stealth"
//   - Legacy attribute source: "Body 5"

import { SKILL_LABELS } from "../skills.mjs";

/**
 * Return a display string for the source of a dice pool.
 * @param {object} action - The raw action data.
 * @param {object} calculation - The calculation result from `calculateActorAction`.
 * @param {object} actor - The actor instance (system data).
 * @returns {string}
 */
export function formatDiceSourceLabel(action, calculation, actor) {
  // Prefer authoritative provenance from the calculation result.
  const source = calculation?.sourceProvenance ?? calculation?.source ?? {};

  // Handle missing proficiency or skill.
  if (source.kind === "missing") {
    const key = source.key;
    if (source.type === "proficiency") return `Missing Proficiency: ${key}`;
    // skill missing – use canonical label
    const label = SKILL_LABELS[key] || key;
    return `Missing Skill: ${label}`;
  }

  // Handle proficiency source.
  if (source.kind === "proficiency") {
    const level = source.level ?? 0;
    const displayName = source.displayName || source.key
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2");
    const suffix = level === 0 && source.untrained ? " (Untrained)" : "";
    return `${displayName} ${level}${suffix}`;
  }

  // Handle skill source.
  if (source.kind === "skill") {
    const label = SKILL_LABELS[source.key] || source.key
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2");
    const level = source.level ?? "?";
    return `${label} ${level}`;
  }

  // Handle legacy attribute source.
  if (source.kind === "legacy") {
    const key = source.key;
    // legacy attributes use the same formatting as skills to keep UI
    const label = SKILL_LABELS[key] || key
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2");
    const value = source.value ?? "?";
    return `${label} ${value}`;
  }

  return "Unspecified";
}
