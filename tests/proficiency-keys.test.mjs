import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeProficiencyKey,
  hasDuplicateKey
} from "../module/helpers/proficiency-keys.mjs";

test("proficiency names produce stable camelCase keys", () => {
  assert.equal(normalizeProficiencyKey("Long Swords"), "longSwords");
  assert.equal(normalizeProficiencyKey("Alchemy Kit"), "alchemyKit");
  assert.equal(normalizeProficiencyKey("   Heavy   Armor  "), "heavyArmor");
  assert.equal(normalizeProficiencyKey("Long-Swords"), "longSwords");
  assert.equal(normalizeProficiencyKey("Sword's"), "swords");
});

test("proficiency key normalization rejects empty names", () => {
  assert.equal(normalizeProficiencyKey(""), null);
  assert.equal(normalizeProficiencyKey("   "), null);
  assert.equal(normalizeProficiencyKey("!!!"), null);
});

test("proficiency key normalization is deterministic", () => {
  assert.equal(
    normalizeProficiencyKey("Long Swords"),
    normalizeProficiencyKey("Long Swords")
  );
});

test("duplicate proficiency keys are detected", () => {
  const proficiencies = [
    { key: "longSwords" },
    { key: "alchemyKit" }
  ];

  assert.equal(hasDuplicateKey(proficiencies, "longSwords"), true);
  assert.equal(hasDuplicateKey(proficiencies, "bows"), false);
});