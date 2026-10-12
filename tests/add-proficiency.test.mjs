import assert from "node:assert/strict";
import test from "node:test";

// Definition-only client stubs; handlers execute without a live Foundry application.
globalThis.foundry = {
  data: { fields: new Proxy({}, { get: () => class {} }) },
  abstract: { DataModel: class {}, Type: class {} },
  utils: { randomID: () => "id" },
  common: { documentTypes: new Proxy({}, { get: () => class {} }) }
};
globalThis.Actor = class {};
globalThis.Item = class {};
globalThis.game = { user: { isGM: false }, i18n: { localize: key => key } };
await import("./helpers/client-applications.mjs");
const { FatedActorSheet } = await import("../module/sheets/actor-sheets.mjs");
const { FatedMobileSheet } = await import("../module/sheets/mobile-sheet.mjs");

function setup(Sheet, response, { editable = true, proficiencies = [], pending } = {}) {
  const writes = [], events = [], warnings = [];
  const actor = {
    isOwner: editable,
    system: { proficiencies: structuredClone(proficiencies) },
    async update(data) {
      events.push("update");
      writes.push(structuredClone(data));
      this.system.proficiencies = data["system.proficiencies"];
    }
  };
  const sheet = new Sheet({ document: actor });
  sheet.submit = async () => {
    events.push("submit-start");
    await Promise.resolve();
    if (pending) actor.system.proficiencies = structuredClone(pending);
    events.push("submit-end");
  };
  foundry.applications.api.DialogV2 = { async input(options) {
    events.push("dialog");
    assert.ok(options.content.includes('name="name" required autofocus'));
    return response;
  } };
  globalThis.ui = { notifications: { warn: message => warnings.push(message) } };
  const run = () => Sheet.DEFAULT_OPTIONS.actions.addProficiency.call(sheet);
  return { actor, writes, events, warnings, run };
}

for (const [label, Sheet] of [["desktop", FatedActorSheet], ["mobile", FatedMobileSheet]]) {
  test(`${label}: adding proficiency writes once and completes without an exception`, async () => {
    const existing = { key: "alchemy", displayName: "Alchemy", attribute: "mind", level: 2 };
    const f = setup(Sheet, { name: "  Long-Swords  " }, { proficiencies: [existing] });
    await assert.doesNotReject(f.run);
    assert.deepEqual(f.events, ["submit-start", "submit-end", "dialog", "update"]);
    assert.deepEqual(f.writes, [{ "system.proficiencies": [existing,
      { key: "longSwords", displayName: "Long-Swords", attribute: "body", level: 0 }
    ] }]);
    assert.deepEqual(f.warnings, []);
  });

  for (const [caseName, response] of [["cancel", null], ["empty name", { name: "  " }],
    ["missing name", {}], ["invalid key", { name: "!!!" }]]) {
    test(`${label}: ${caseName} leaves the Actor unchanged`, async () => {
      const f = setup(Sheet, response);
      await assert.doesNotReject(f.run);
      assert.deepEqual(f.writes, []);
      assert.deepEqual(f.actor.system.proficiencies, []);
      assert.equal(f.warnings.length, caseName === "invalid key" ? 1 : 0);
    });
  }

  test(`${label}: duplicate normalized keys are rejected`, async () => {
    const existing = { key: "longSwords", displayName: "Blades", attribute: "heart", level: 3 };
    const f = setup(Sheet, { name: "Long Swords" }, { proficiencies: [existing] });
    await assert.doesNotReject(f.run);
    assert.deepEqual(f.writes, []);
    assert.deepEqual(f.actor.system.proficiencies, [existing]);
    assert.equal(f.warnings.length, 1);
  });

  test(`${label}: read-only access prevents submit, dialog and update`, async () => {
    const f = setup(Sheet, { name: "Alchemy" }, { editable: false });
    await assert.doesNotReject(f.run);
    assert.deepEqual(f.events, []);
    assert.deepEqual(f.writes, []);
  });

  test(`${label}: pending form changes finish before creation and are preserved`, async () => {
    const pending = [{ key: "alchemy", displayName: "Edited Alchemy", attribute: "mind", level: 4 }];
    const f = setup(Sheet, { name: "Travel Kit" }, { pending });
    await assert.doesNotReject(f.run);
    assert.deepEqual(f.events, ["submit-start", "submit-end", "dialog", "update"]);
    assert.equal(f.writes.length, 1);
    assert.deepEqual(f.writes[0]["system.proficiencies"], [...pending,
      { key: "travelKit", displayName: "Travel Kit", attribute: "body", level: 0 }
    ]);
  });

  test(`${label}: duplicate detection sees submitted form changes`, async () => {
    const pending = [{ key: "alchemy", displayName: "Alchemy", attribute: "mind", level: 1 }];
    const f = setup(Sheet, { name: "Alchemy" }, { pending });
    await assert.doesNotReject(f.run);
    assert.deepEqual(f.events, ["submit-start", "submit-end", "dialog"]);
    assert.deepEqual(f.writes, []);
    assert.deepEqual(f.actor.system.proficiencies, pending);
    assert.equal(f.warnings.length, 1);
  });
}
