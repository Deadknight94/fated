// Canonical skill definitions used throughout the system.
// Each skill maps to a single primary attribute.
// The mapping is kept in a dedicated module to avoid duplication
// across the codebase and to provide a single source of truth.
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
export const SKILL_KEYS = Object.keys(SKILL_ATTRIBUTE_MAP);

export const SKILL_ATTRIBUTE_ORDER = ["body", "mind", "heart"];

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

