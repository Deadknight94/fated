/**
 * @file Pure proficiency identifier helpers used by sheet/controller mutations. Normalizes
 * authored names and checks exact key collisions; does not rename stored references
 * or localize keys. proficiency-controls.mjs owns those Document writes.
 */
/**
 * Convert a human-readable proficiency name into a stable,
 * deterministic camelCase key.
 *
 * Examples:
 * - "Long Swords" -> "longSwords"
 * - "Alchemy Kit" -> "alchemyKit"
 * - "   Heavy   Armor  " -> "heavyArmor"
 * - "Sword's" -> "swords"
 * - "Long-Swords" -> "longSwords"
 * - "!!!" -> null
 *
 * @param {string} name
 * @returns {string|null}
 *
 * Pure normalization only; it does not check uniqueness or update references.
 * Already-normalized camelCase keys should not be normalized again on no-op edits.
 */
export function normalizeProficiencyKey(name) {
  if (typeof name !== "string") return null;

  const normalized = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim();

  if (!normalized) return null;

  const parts = normalized.split(/\s+/);

  return parts.map((part, index) => {
    const lower = part.toLowerCase();
    return index === 0
      ? lower
      : lower[0].toUpperCase() + lower.slice(1);
  }).join("");
}

/**
 * Check whether a proficiency key already exists.
 *
 * @param {Array<{key:string}>} proficiencies
 * @param {string} key
 * @returns {boolean}
 *
 * Pure exact-key membership check; display names and localization are irrelevant.
 */
export function hasDuplicateKey(proficiencies, key) {
  return proficiencies.some(proficiency => proficiency.key === key);
}