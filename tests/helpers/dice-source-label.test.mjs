import assert from "node:assert/strict";
import test from "node:test";
import { formatDiceSourceLabel } from "../../module/helpers/dice-source-label.mjs";
import { SKILL_LABELS } from "../../module/skills.mjs";

// Helper to create a sourceProvenance object used in tests.
function p(data) {
  return { sourceProvenance: data };
}

test("trained proficiency", () => {
  const label = formatDiceSourceLabel({}, p({
    kind: "proficiency",
    key: "longSwords",
    level: 3,
    displayName: "Long Swords",
    untrained: false
  }), {});
  assert.equal(label, "Long Swords 3");
});

test("level-0 proficiency", () => {
  const label = formatDiceSourceLabel({}, p({
    kind: "proficiency",
    key: "longSwords",
    level: 0,
    displayName: "Long Swords",
    untrained: true
  }), {});
  assert.equal(label, "Long Swords 0 (Untrained)");
});

test("skill", () => {
  const label = formatDiceSourceLabel({}, p({
    kind: "skill",
    key: "stealth",
    level: 4
  }), {});
  assert.equal(label, "Stealth 4");
});

test("missing proficiency", () => {
  const label = formatDiceSourceLabel({}, p({
    kind: "missing",
    type: "proficiency",
    key: "longSwords"
  }), {});
  assert.equal(label, "Missing Proficiency: longSwords");
});

test("missing skill", () => {
  const label = formatDiceSourceLabel({}, p({
    kind: "missing",
    type: "skill",
    key: "stealth"
  }), {});
  assert.equal(label, "Missing Skill: Stealth");
});

test("legacy", () => {
  const label = formatDiceSourceLabel({}, p({
    kind: "legacy",
    key: "body",
    value: 5
  }), {});
  assert.equal(label, "Body 5");
});

