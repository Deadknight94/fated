import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

// Only bootstrap module definitions, not DataModel validation or a live Foundry app.
globalThis.foundry = {
  data: { fields: new Proxy({}, { get: () => class {} }) },
  abstract: { DataModel: class {}, Type: class {} },
  utils: { randomID: () => "id" },
  common: { documentTypes: new Proxy({}, { get: () => class {} }) }
};
globalThis.Actor = class {};
globalThis.Item = class {};
const catalogs = Object.fromEntries(["en", "it"].map(lang => [lang,
  JSON.parse(readFileSync(new URL(`../lang/${lang}.json`, import.meta.url), "utf8"))]));
const translator = lang => ({ localize: key => key.split(".").reduce((v, k) => v?.[k], catalogs[lang]) ?? key });
globalThis.game = { user: { isGM: false }, i18n: translator("en") };
await import("./helpers/client-applications.mjs");
foundry.applications.sheets.ActorSheetV2.prototype._prepareContext = async () => ({});
const { availableActionsView } = await import("../module/presentation/actions.mjs");
const { calculateActorAction } = await import("../module/health.mjs");
const { freshDeclaration } = await import("../module/declaration/evaluate.mjs");
const { FatedActorSheet } = await import("../module/sheets/actor-sheets.mjs");
const { FatedMobileSheet } = await import("../module/sheets/mobile-sheet.mjs");

function fixture() {
  const source = { itemId: "weapon", itemUuid: "Actor.a.Item.weapon", itemName: "Hope", itemType: "weapon", proficiency: "" };
  const action = { id: "swing", key: "Actor.a.Item.weapon#swing", source, name: "Offensive", enabled: true,
    classification: "main", rollRequirement: "required", attackType: "melee", damage: null,
    successDice: { source: "body", base: null }, successThreshold: 4,
    modifiers: { successDice: [{ id: "dice", label: "Hope", value: 2, source }],
      successThreshold: [{ id: "threshold", label: "Exhausted", value: -1, source }] },
    allowedStances: ["defensive"], multiActionEligible: false,
    range: { min: 0, max: 2, units: "Body" }, effect: "Hope", rules: "Offensive\n<custom rules>" };
  const item = { id: "weapon", name: "Hope", type: "weapon", isOwner: false,
    system: { damage: 3, equipped: false, load: 0 } };
  const items = new Map([[item.id, item]]); items.contents = [item];
  // Foundry collections iterate over documents, not Map entries.
  items[Symbol.iterator] = function () { return this.values(); };
  const actor = { type: "fated", id: "a", uuid: "Actor.a", isOwner: false, items,
    system: { attributes: { body: 3, heart: 2, mind: 2 }, skills: {}, proficiencies: [], load: 0,
      currentStance: "offensive", health: { woundSeverity: 1, woundCare: { care: "none" } },
      resources: { endurance: { value: 5 }, hope: { value: 0 }, power: 0 },
      manualRollModifiers: [{ id: "manual", type: "successDice", label: "Bandaged", value: -1 }],
      declaration: null }, getAvailableActions() { return [action]; } };
  return { actor, action, item };
}

test("available Action projection uses the Actor API without equipment, stance or declaration filtering", () => {
  const { actor, action, item } = fixture();
  let calls = 0;
  actor.getAvailableActions = () => { calls++; return [action]; };
  const before = JSON.stringify({ system: actor.system, action, item });
  const [view] = availableActionsView(actor);
  assert.equal(calls, 1);
  assert.equal(view.name, action.name);
  assert.deepEqual(view.source, action.source);
  assert.equal(view.additionIssue, undefined);
  assert.equal(JSON.stringify({ system: actor.system, action, item }), before);
});

test("dice and Threshold match the service with separate sourced Action, manual and health modifiers", () => {
  const { actor, action } = fixture();
  const [view] = availableActionsView(actor);
  const calculation = calculateActorAction(actor, action);
  assert.equal(view.dice.base, "3");
  assert.equal(view.dice.total, "4");
  assert.equal(view.threshold.base, "4");
  assert.equal(view.threshold.total, "4");
  for (const [display, raw] of [[view.dice, calculation.successDice], [view.threshold, calculation.successThreshold]]) {
    assert.equal(display.total, String(raw.total));
    assert.deepEqual(display.modifiers.map(m => m.source), raw.modifiers.map(m => m.source));
    assert.deepEqual(display.modifiers.map(m => Number(m.value)), raw.modifiers.map(m => m.value));
    assert.ok(display.modifiers.every(m => !["stance", "declaration"].includes(m.source.type)));
  }
  assert.deepEqual(view.dice.modifiers.map(m => m.label), ["Hope", "Bandaged"]);
  assert.deepEqual(view.threshold.modifiers.map(m => m.label), ["Exhausted", "Light Wound"]);
});

test("unknown inputs remain Unspecified, including incomplete Threshold modifiers and roll requirement", () => {
  const { actor, action } = fixture();
  action.source.proficiency = "missing";
  action.modifiers.successThreshold[0].value = null;
  action.rollRequirement = null;
  action.multiActionEligible = null;
  action.allowedStances = [];
  const [view] = availableActionsView(actor);
  assert.equal(view.dice.base, "Unspecified");
  assert.equal(view.dice.total, "Unspecified");
  assert.equal(view.threshold.total, "Unspecified");
  assert.equal(view.threshold.modifiers[0].value, "Unspecified");
  assert.equal(view.dice.complete, false);
  assert.equal(view.threshold.complete, false);
  assert.equal(view.rollRequirementLabel, "Roll requirement unspecified");
  assert.equal(view.eligibilityLabel, "Unspecified");
  assert.equal(view.stanceLabel, "Unspecified");
  assert.match(view.diceSourceLabel, /Missing Proficiency: missing/);
});

test("known dice minimum, untrained proficiency and legacy review remain service-owned", () => {
  const { actor, action } = fixture();
  actor.system.proficiencies = [{ key: "blade", displayName: "Body", level: 0 }];
  action.source.proficiency = "blade";
  action.modifiers.successDice[0].value = -10;
  action.successThreshold = 7;
  const [view] = availableActionsView(actor);
  assert.equal(view.dice.total, "1");
  assert.equal(view.diceSourceLabel, "Body 0 (Untrained)");
  assert.equal(view.threshold.total, "4");
  assert.match(view.thresholdReviewIssue, /legacy Success Threshold 7 requires review/);
  assert.equal(action.successThreshold, 7);
});

test("damage fallback, explicit zero, partial range and authored rules survive EN/IT presentation", () => {
  const { actor, action } = fixture();
  for (const lang of ["en", "it"]) {
    const [view] = availableActionsView(actor, translator(lang));
    assert.equal(view.damagePerSuccess, 3);
    assert.equal(view.rangeLabel, "0–2 Body");
    for (const key of ["name", "effect", "rules"]) assert.equal(view[key], action[key]);
    assert.equal(view.source.itemName, "Hope");
    assert.equal(view.dice.modifiers[0].label, "Hope");
    assert.equal(view.dice.modifiers[1].label, "Bandaged");
  }
  action.damage = 0; action.range.max = null;
  const [zero] = availableActionsView(actor);
  assert.equal(zero.damagePerSuccess, 0); assert.equal(zero.hasDamage, true);
  assert.equal(zero.rangeLabel, "0–? Body");
  action.attackType = ""; action.range.min = null;
  const [unknown] = availableActionsView(actor);
  assert.equal(unknown.damagePerSuccess, null); assert.equal(unknown.hasDamage, false);
  assert.equal(unknown.rangeLabel, "Unspecified");
});

test("read-only desktop Actions survive navigation/rerenders and open the embedded source Item", async () => {
  const { actor, item } = fixture();
  const sheet = new FatedActorSheet({ document: actor });
  sheet.submit = () => assert.fail("read-only view submitted");
  actor.update = () => assert.fail("view mutated Actor");
  await FatedActorSheet.selectSection.call(sheet, {}, { dataset: { section: "actions" } });
  for (let i = 0; i < 2; i++) {
    await sheet.render();
    assert.equal(sheet.context.actionsSection, true);
    assert.equal(sheet.context.itemsSection, false);
    assert.equal(sheet.context.notesSection, false);
    assert.deepEqual(sheet.context.actions, availableActionsView(actor));
  }
  const calls = []; item.sheet = { render: options => calls.push(options) };
  FatedActorSheet.DEFAULT_OPTIONS.actions.openItem.call(sheet, {}, { dataset: { itemId: sheet.context.actions[0].source.itemId } });
  assert.deepEqual(calls, [{ force: true }]);
});

test("desktop and mobile share Action output while mobile alone adds planner issues", async () => {
  const { actor, action } = fixture();
  const declaration = freshDeclaration("neutral");
  declaration.entries = [{ id: "entry", kind: "action", itemId: "weapon", actionId: "swing" }];
  action.classification = "power";
  actor.system.declaration = { toObject: () => structuredClone(declaration) };
  const desktop = new FatedActorSheet({ document: actor });
  const mobile = new FatedMobileSheet({ document: actor });
  const desktopContext = await desktop._prepareContext({});
  const mobileContext = await mobile._prepareContext({});
  const { additionIssue, ...mobileAction } = mobileContext.actions[0];
  assert.match(additionIssue, /Power Action is already declared/);
  assert.deepEqual(mobileAction, desktopContext.actions[0]);
  assert.equal(desktopContext.actions[0].additionIssue, undefined);
  assert.equal(mobileContext.planner.entries.length, 1);
});

test("no available Actions yields an empty presentation on desktop", async () => {
  const { actor } = fixture(); actor.getAvailableActions = () => [];
  assert.deepEqual(availableActionsView(actor), []);
  const sheet = new FatedActorSheet({ document: actor }); sheet._fatedSection = "actions";
  assert.deepEqual((await sheet._prepareContext({})).actions, []);
});
