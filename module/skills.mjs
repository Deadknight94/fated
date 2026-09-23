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

// Export an array of skill keys for convenience
export const SKILL_KEYS = Object.keys(SKILL_ATTRIBUTE_MAP);

