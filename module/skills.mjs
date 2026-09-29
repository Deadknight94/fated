/**
 * @file Shared skill catalog for the schema, Action source resolution and sheet grouping.
 * Keys are stored identifiers; English labels are presentation inputs, localized
 * later by presentation/labels.mjs. This catalog does not enforce advancement costs.
 */
// Canonical skill definitions used throughout the system.
// Each skill maps to a single primary attribute.
// The mapping is kept in a dedicated module to avoid duplication
// across the codebase and to provide a single source of truth.
/**
 * Stored skill-key to attribute-key mapping used to build the schema and group
 * skills. This is catalog data, not runtime enforcement of training limits.
 */
export const SKILL_ATTRIBUTE_MAP = {
  // Body skills
  awe: "body",
  athletics: "body",
  huntingForaging: "body",
  travel: "body",
  craft: "body",
  finesse: "body",
  // Mind skills
  persuade: "mind",
  stealth: "mind",
  perception: "mind",
  explore: "mind",
  reason: "mind",
  lore: "mind",
  // Heart skills
  enhearten: "heart",
  leadership: "heart",
  insight: "heart",
  healing: "heart",
  diplomacy: "heart",
  deceive: "heart"
};
/**
 * English system labels keyed by stable skill IDs. Presentation code localizes
 * these; neither translated labels nor display order become stored identifiers.
 */
export const SKILL_LABELS = {
  awe: "Awe",
  athletics: "Athletics",
  huntingForaging: "Hunting / Foraging",
  travel: "Travel",
  craft: "Craft",
  finesse: "Finesse",

  persuade: "Persuade",
  stealth: "Stealth",
  perception: "Perception",
  explore: "Explore",
  reason: "Reason",
  lore: "Lore",

  enhearten: "Enhearten",
  leadership: "Leadership",
  insight: "Insight",
  healing: "Healing",
  diplomacy: "Diplomacy",
  deceive: "Deceive"
};
// Export an array of skill keys for convenience
/**
 * Skill IDs in catalog insertion order, shared by schema and editor consumers.
 */
export const SKILL_KEYS = Object.keys(SKILL_ATTRIBUTE_MAP);

/**
 * Body/Mind/Heart grouping order for sheet presentation, independent of levels.
 */
export const SKILL_ATTRIBUTE_ORDER = ["body", "mind", "heart"];

/**
 * Pure projection of a skill-value object into attribute groups with key, label
 * and skill rows. Missing values remain undefined; returns new groups without
 * changing the input. Localization is applied by skillGroupsView afterward.
 */
export function buildSkillGroups(skills = {}) {
  return SKILL_ATTRIBUTE_ORDER.map(attribute => ({
    attribute,
    label: attribute[0].toUpperCase() + attribute.slice(1),
    skills: SKILL_KEYS
      .filter(key => SKILL_ATTRIBUTE_MAP[key] === attribute)
      .map(key => ({
        key,
        label: SKILL_LABELS[key],
        value: skills[key]
      }))
  }));
}

