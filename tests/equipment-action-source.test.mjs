import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

// Load Foundry before importing system modules.
const app = process.env.FOUNDRY_APP_PATH
  ?? resolve(process.env.LOCALAPPDATA ?? ".", "Programs/Foundry Virtual Tabletop/resources/app");

await import(pathToFileURL(resolve(app, "common/server.mjs")));

const { calculateActionFromActorData } =
  await import("../module/actions/actions.mjs");

/** Helper to create a minimal valid Action. */
function makeAction(opts = {}) {
  return {
    successDice: { source: "fixed", base: null },
    successThreshold: 4,
    modifiers: {
      successDice: [],
      successThreshold: []
    },
    ...opts
  };
}

test("proficiency level 3 gives base 3 and no untrained flag", () => {
  const action = makeAction({ source: { proficiency: "swords" } });
  const result = calculateActionFromActorData(action, { proficiencies: [{ key: "swords", level: 3 }] });
  assert.equal(result.successDice.total, 3);
  assert.equal(result.successDice.untrained, undefined);
});

test("proficiency level 0 gives base 1 and untrained flag", () => {
  const action = makeAction({ source: { proficiency: "swords" } });
  const result = calculateActionFromActorData(action, { proficiencies: [{ key: "swords", level: 0 }] });
  assert.equal(result.successDice.total, 1);
  assert.equal(result.successDice.untrained, true);
});

test("missing proficiency entry yields incomplete calculation", () => {
  const action = makeAction({ source: { proficiency: "swords" } });
  const result = calculateActionFromActorData(action, { proficiencies: [] });
  assert.equal(result.successDice.complete, false);
  assert.equal(result.successDice.total, null);
});

test("proficiency takes precedence over action skill", () => {
  const action = makeAction({ source: { proficiency: "swords" }, skill: "stealth" });
  const result = calculateActionFromActorData(action, {
    proficiencies: [{ key: "swords", level: 2 }],
    skills: { stealth: 5 },
  });
  assert.equal(result.successDice.total, 2); // not 5
});

test("skill used when proficiency missing", () => {
  const action = makeAction({ skill: "stealth" });
  const result = calculateActionFromActorData(action, {
    skills: { stealth: 4 },
  });
  assert.equal(result.successDice.total, 4);
});

test("missing skill yields incomplete calculation", () => {
  const action = makeAction({ skill: "stealth" });
  const result = calculateActionFromActorData(action, { skills: {} });
  assert.equal(result.successDice.complete, false);
});

test("additional modifiers are applied after resolving source", () => {
  const action = makeAction({ source: { proficiency: "swords" } });
  const result = calculateActionFromActorData(action, {
    proficiencies: [{ key: "swords", level: 2 }],
  }, { successDice: [{ label: "bonus", value: 1 }] });
  assert.equal(result.successDice.total, 3); // 2 base + 1
});

test("legacy attribute source used when no proficiency or skill", () => {
  const action = makeAction({ successDice: { source: "body", base: null } });
  const result = calculateActionFromActorData(action, {
    attributes: { body: 5 },
  });
  assert.equal(result.successDice.total, 5);
});

// --- Provenance assertions
test("proficiency provenance contains correct fields", () => {
  const action = makeAction({ source: { proficiency: "swords" } });
  const result = calculateActionFromActorData(action, { proficiencies: [{ key: "swords", level: 3 }] });
  assert.deepEqual(result.sourceProvenance, {
    kind: "proficiency",
    key: "swords",
    level: 3,
    displayName: undefined,
    untrained: false
  });
});

test("level-0 proficiency provenance marks untrained", () => {
  const action = makeAction({ source: { proficiency: "swords" } });
  const result = calculateActionFromActorData(action, { proficiencies: [{ key: "swords", level: 0 }] });
  assert.deepEqual(result.sourceProvenance, {
    kind: "proficiency",
    key: "swords",
    level: 0,
    displayName: undefined,
    untrained: true
  });
});

test("missing proficiency produces missing provenance", () => {
  const action = makeAction({ source: { proficiency: "swords" } });
  const result = calculateActionFromActorData(action, { proficiencies: [] });
  assert.deepEqual(result.sourceProvenance, {
    kind: "missing",
    type: "proficiency",
    key: "swords"
  });
});

test("skill provenance contains correct fields", () => {
  const action = makeAction({ skill: "stealth" });
  const result = calculateActionFromActorData(action, { skills: { stealth: 4 } });
  assert.deepEqual(result.sourceProvenance, {
    kind: "skill",
    key: "stealth",
    level: 4
  });
});

test("missing skill produces missing provenance", () => {
  const action = makeAction({ skill: "stealth" });
  const result = calculateActionFromActorData(action, { skills: {} });
  assert.deepEqual(result.sourceProvenance, {
    kind: "missing",
    type: "skill",
    key: "stealth"
  });
});

test("proficiency precedence over skill in provenance", () => {
  const action = makeAction({ source: { proficiency: "swords" }, skill: "stealth" });
  const result = calculateActionFromActorData(action, {
    proficiencies: [{ key: "swords", level: 2 }],
    skills: { stealth: 5 }
  });
  assert.deepEqual(result.sourceProvenance, {
    kind: "proficiency",
    key: "swords",
    level: 2,
    displayName: undefined,
    untrained: false
  });
});

test("legacy provenance uses base value, not modified total", () => {
  const action = makeAction({ successDice: { source: "body", base: null } });
  const result = calculateActionFromActorData(action, { attributes: { body: 5 } });
  assert.deepEqual(result.sourceProvenance, {
    kind: "legacy",
    key: "body",
    value: 5
  });
});
