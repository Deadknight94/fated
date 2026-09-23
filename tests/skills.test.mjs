import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

// Load Foundry and module code
const app = process.env.FOUNDRY_APP_PATH ?? resolve(process.env.LOCALAPPDATA ?? ".", "Programs/Foundry Virtual Tabletop/resources/app");
await import(pathToFileURL(resolve(app, "common/server.mjs")));
const { FatedDataModel } = await import("../module/data-models.mjs");
const { SKILL_ATTRIBUTE_MAP, SKILL_KEYS } = await import("../module/skills.mjs");

/** Helper to construct an actor system object */
function actorData(overrides = {}) {
  const base = {
    attributes: { heart: 2, body: 2, mind: 2 },
    resources: { endurance: { value: 0 }, hope: { value: 0 }, power: 0 },
    ...overrides
  };
  return base;
}

test("default Fated contains 18 canonical skills at level 1", () => {
  const a = new FatedDataModel(actorData());
  for (const key of SKILL_KEYS) {
    assert.equal(a.skills[key], 1, `Skill ${key} should default to 1`);
  }
  assert.equal(Object.keys(a.skills).length, SKILL_KEYS.length);
});

test("skill attribute mapping is correct", () => {
  assert.deepEqual(SKILL_ATTRIBUTE_MAP, {
    awe: "body",
    athletics: "body",
    huntingForaging: "body",
    travel: "body",
    craft: "body",
    finesse: "body",

    persuade: "mind",
    stealth: "mind",
    perception: "mind",
    explore: "mind",
    reason: "mind",
    lore: "mind",

    enhearten: "heart",
    leadership: "heart",
    insight: "heart",
    healing: "heart",
    diplomacy: "heart",
    deceive: "heart"
  });
});

test("no legacy skills exist", () => {
  const a = new FatedDataModel(actorData());
  for (const legacy of ["awareness", "song", "scan", "riddle", "courtesy", "battle"]) {
    assert.equal(a.skills[legacy], undefined, `Legacy skill ${legacy} should not exist`);
  }
});

test("default proficiencies empty", () => {
  const a = new FatedDataModel(actorData());
  assert.deepEqual(a.proficiencies, [], "Default proficiencies should be empty array");
});

test("arbitrary proficiency representation", () => {
  const proficiency = {
    key: "alchemy",
    displayName: "Alchemy Kit",
    attribute: "mind",
    level: 0
  };
  const a = new FatedDataModel(actorData({ proficiencies: [proficiency] }));
  assert.deepEqual(a.proficiencies[0], proficiency, "Proficiency should be stored correctly");
});

test("proficiency can use heart, body, or mind", () => {
  for (const attr of ["heart", "body", "mind"]) {
    const proficiency = { key: `test-${attr}`, displayName: `Test ${attr}`, attribute: attr, level: 0 };
    const a = new FatedDataModel(actorData({ proficiencies: [proficiency] }));
    assert.equal(a.proficiencies[0].attribute, attr);
  }
});

test("proficiency level 0 is valid", () => {
  const proficiency = { key: "x", displayName: "X", attribute: "body", level: 0 };
  const a = new FatedDataModel(actorData({ proficiencies: [proficiency] }));
  assert.equal(a.proficiencies[0].level, 0);
});

test("existing unrelated actor data remains unchanged", () => {
  const a = new FatedDataModel(actorData({
    attributes: { heart: 3, body: 4, mind: 5 },
    load: 2
  }));

  assert.equal(a.attributes.heart, 3);
  assert.equal(a.attributes.body, 4);
  assert.equal(a.attributes.mind, 5);
  assert.equal(a.load, 2);
});

