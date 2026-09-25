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
import { displayLabel } from "../presentation/labels.mjs";
import { uiText } from "../presentation/text.mjs";

/**
 * Return a display string for the source of a dice pool.
 * @param {object} action - The raw action data.
 * @param {object} calculation - The calculation result from `calculateActorAction`.
 * @param {object} actor - The actor instance (system data).
 * @returns {string}
 */
export function formatDiceSourceLabel(action, calculation, actor, i18n) {
  // Prefer authoritative provenance from the calculation result.
  const source = calculation?.sourceProvenance ?? calculation?.source ?? {};

  // Handle missing proficiency or skill.
  if (source.kind === "missing") {
    const key = source.key;
    if (source.type === "proficiency") return uiText("Missing Proficiency: {key}", { key }, i18n);
    // skill missing – use canonical label
    const label = displayLabel("skill", key, i18n);
    return uiText("Missing Skill: {skill}", { skill: label }, i18n);
  }

  // Handle proficiency source.
  if (source.kind === "proficiency") {
    const level = source.level ?? 0;
    const displayName = source.displayName || source.key
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2");
    const suffix = level === 0 && source.untrained ? ` (${uiText("Untrained", {}, i18n)})` : "";
    return `${displayName} ${level}${suffix}`;
  }

  // Handle skill source.
  if (source.kind === "skill") {
    const label = SKILL_LABELS[source.key] ? displayLabel("skill", source.key, i18n) : source.key
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2");
    const level = source.level ?? "?";
    return `${label} ${level}`;
  }

  // Handle legacy attribute source.
  if (source.kind === "legacy") {
    const key = source.key;
    // legacy attributes use the same formatting as skills to keep UI
    const label = ["body", "mind", "heart"].includes(key) ? displayLabel("attribute", key, i18n)
      : key === "fixed" ? uiText("Fixed base", {}, i18n) : SKILL_LABELS[key] ? displayLabel("skill", key, i18n)
      : key?.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z])([A-Z][a-z])/g, "$1 $2") || uiText("Unspecified", {}, i18n);
    const value = source.value ?? "?";
    return `${label} ${value}`;
  }

  return uiText("Unspecified", {}, i18n);
}
