import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

// Module-definition bootstrap only; no live Foundry application.
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
const { plannerView } = await import("../module/presentation/planner.mjs");
const { displayLabel, rangeLabel, declarationIssuesView } = await import("../module/presentation/labels.mjs");
const { uiText } = await import("../module/presentation/text.mjs");
const { breakdownView } = await import("../module/presentation/actions.mjs");
const { formatDiceSourceLabel } = await import("../module/helpers/dice-source-label.mjs");
const { DECLARATION_STANCES } = await import("../module/declaration/evaluate.mjs");
const { enduranceSpendOptions } = await import("../module/declaration/endurance-push.mjs");
const { freshDeclaration, lockDeclaration } = await import("../module/declaration/evaluate.mjs");
const { getDeclarationEvaluation } = await import("../module/declaration/service.mjs");
const { FatedMobileSheet } = await import("../module/sheets/mobile-sheet.mjs");

function fixture(count = 0, stance = "neutral") {
  const declaration = freshDeclaration(stance, 7);
  declaration.entries = Array.from({ length: count }, (_, i) => ({ id: `e${i}`, kind: "action", itemId: "weapon", actionId: "strike" }));
  const action = { id: "strike", name: "Hope", classification: "main", rollRequirement: "required",
    source: { itemId: "weapon", itemName: "Body", itemType: "weapon", proficiency: "blade" },
    successDice: { source: "fixed", base: 4 }, successThreshold: 4,
    modifiers: { successDice: [], successThreshold: [] }, attackType: "melee",
    allowedStances: ["neutral", "offensive", "defensive", "ranged"], multiActionEligible: true,
    range: { min: 0, max: 2, units: "Body" }, effect: "Hope", rules: "Offensive" };
  const items = new Map(); items.contents = [];
  const actor = { type: "fated", id: "a", items, isOwner: true,
    system: { attributes: { body: 3, mind: 2, heart: 2 }, skills: {}, load: 0,
      proficiencies: [{ key: "blade", displayName: "Heart", level: 3 }], currentStance: "neutral",
      health: { woundSeverity: 0, woundCare: { care: "none" } }, manualRollModifiers: [],
      resources: { endurance: { value: 5 }, hope: { value: 0 }, power: 0 },
      declaration: { toObject: () => structuredClone(declaration) } },
    getAvailableActions: () => [action], update: () => assert.fail("presentation wrote Actor") };
  return { actor, action, declaration };
}
const view = (f, options = {}) => plannerView(f.actor, { declaration: f.declaration,
  evaluation: getDeclarationEvaluation(f.actor), actionPickerId: "test-picker", ...options });
function freeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

test("empty editable declaration preserves revision, stance gating and picker identity", () => {
  const f = fixture(0, ""); const p = view(f, { actionPickerOpen: true });
  assert.equal(p.revision, 7); assert.equal(p.locked, false);
  assert.equal(p.stanceChosen, false); assert.equal(p.canAddMovement, false);
  assert.equal(p.actionPickerOpen, false); assert.equal(p.actionPickerId, "test-picker");
  assert.deepEqual(p.entries, []); assert.equal(p.mainCount, 0);
  assert.equal(p.canLock, false); assert.equal(p.issues[0].incomplete, true);
});

for (const lang of ["en", "it"]) test(`${lang}: stance choices, authored labels and declaration issues`, () => {
  const i18n = translator(lang); const f = fixture(1, "offensive");
  const p = view(f, { i18n });
  assert.equal(p.stanceLabel, lang === "en" ? "Offensive" : "Offensiva");
  assert.deepEqual(p.stances.filter(s => s.selected).map(s => s.value), ["offensive"]);
  assert.equal(p.stances.length, 4);
  assert.equal(p.entries[0].classificationLabel, lang === "en" ? "Main Action" : "Azione Principale");
  assert.equal(p.entries[0].name, "Hope"); assert.equal(p.entries[0].diceSourceLabel, "Heart 3");
  assert.equal(p.entries[0].rangeLabel, "0–2 Body");
  f.declaration.stance = "";
  assert.equal(view(f, { i18n }).issues[0].message, lang === "en"
    ? "Choose a stance before declaring Actions." : "Scegli una Posizione prima di dichiarare le Azioni.");
});

test("Endurance options retain selection and service-owned affordability", () => {
  const f = fixture(); f.actor.system.health.woundSeverity = 2; f.declaration.enduranceSpend = 2;
  assert.deepEqual(view(f).enduranceOptions, [
    { value: 0, selected: false, disabled: false }, { value: 1, selected: false, disabled: false },
    { value: 2, selected: true, disabled: false }]);
  f.actor.system.resources.endurance.value = 1;
  assert.deepEqual(view(f).enduranceOptions.map(o => o.disabled), [false, false, true]);
  assert.equal(view(f).enduranceSpend, 2);
});

for (const count of [1, 2, 3]) test(`${count} Main Actions retain separate sourced dice and Threshold breakdowns`, () => {
  const f = fixture(count); f.action.modifiers.successDice = [{ label: "Hope", value: 1, source: { type: "item" } }];
  const p = view(f);
  assert.equal(p.mainCount, count); assert.equal(p.multiActionPenalty, count - 1);
  for (const e of p.entries) {
    assert.equal(e.requiresRoll, true); assert.equal(e.noRoll, false);
    assert.equal(e.dice.base, "3"); assert.equal(e.dice.total, "4");
    assert.equal(e.dice.modifiers[0].value, "+1");
    assert.equal(e.threshold.base, "4"); assert.equal(e.threshold.total, String(4 + count - 1));
    assert.equal(e.threshold.modifiers[0].source.mainCount, count);
    assert.equal(e.threshold.modifiers[0].value, `+${count - 1}`);
  }
});

test("movement and ordered entries expose boundary reorder controls", () => {
  const f = fixture(2); assert.equal(view(f).canAddMovement, true);
  f.declaration.entries.splice(1, 0, { id: "move", kind: "movement" });
  const p = view(f); assert.equal(p.canAddMovement, false);
  assert.deepEqual(p.entries.map(e => [e.id, e.number, e.canMoveUp, e.canMoveDown]),
    [["e0", 1, false, true], ["move", 2, true, true], ["e1", 3, true, false]]);
  assert.equal(p.entries[1].movement, true); assert.equal(p.entries[1].dice, null);
});

test("no-roll, unknown, missing and incomplete Actions retain distinct presentation", () => {
  const f = fixture(1); f.action.rollRequirement = "none";
  let e = view(f).entries[0]; assert.equal(e.noRoll, true); assert.equal(e.dice, null);
  f.action.rollRequirement = null;
  e = view(f).entries[0]; assert.equal(e.noRoll, false); assert.equal(e.requiresRoll, false);
  assert.ok(view(f).issues.some(i => i.code === "roll-unknown"));
  f.action.rollRequirement = "required"; f.action.source.proficiency = "missing";
  e = view(f).entries[0]; assert.equal(e.dice.total, "Unspecified");
  assert.equal(e.diceSourceLabel, "Missing Proficiency: missing");
  f.action.modifiers.successThreshold = [{ label: "Custom", value: null }];
  assert.equal(view(f).entries[0].threshold.total, "Unspecified");
  f.actor.getAvailableActions = () => [];
  assert.equal(view(f).entries[0].name, "Missing or unnamed Action");
});

test("locked snapshots and completed entries ignore later Actor and Action changes", () => {
  const f = fixture(2);
  Object.assign(f.declaration, lockDeclaration(f.declaration, [f.action], f.actor.system, { now: "fixed" }));
  f.declaration.completed = ["e0"];
  const before = view(f);
  f.action.name = "Changed"; f.actor.system.proficiencies[0].level = 99;
  f.actor.getAvailableActions = () => assert.fail("locked read queried current Actions");
  const p = view(f, { actionPickerOpen: true });
  assert.deepEqual(p.entries, before.entries); assert.equal(p.entries[0].name, "Hope");
  assert.equal(p.entries[0].dice.total, "3"); assert.equal(p.entries[0].diceSourceLabel, "Heart 3");
  assert.equal(p.entries[0].completed, true); assert.equal(p.entries[1].completed, false);
  assert.equal(p.multiActionPenalty, 1); assert.equal(p.actionPickerOpen, false);
  assert.equal(p.canAddMovement, false); assert.equal(p.canLock, false);
});

test("presentation does not mutate frozen Actor, declaration or evaluation inputs", () => {
  const f = fixture(2); const evaluation = getDeclarationEvaluation(f.actor);
  freeze(f.actor); freeze(f.action); freeze(f.declaration); freeze(evaluation);
  assert.doesNotThrow(() => plannerView(f.actor, { declaration: f.declaration, evaluation, i18n: translator("it") }));
});

test("mobile integration and every legacy context field match for draft and locked EN/IT fixtures", async () => {
  for (const lang of ["en", "it"]) for (const locked of [false, true]) for (const count of [0, 1, 2, 3]) {
    game.i18n = translator(lang);
    const f = fixture(count);
    if (locked) Object.assign(f.declaration, lockDeclaration(f.declaration, [f.action], f.actor.system));
    const sheet = new FatedMobileSheet({ document: f.actor }); sheet.actionPickerOpen = true;
    const evaluation = getDeclarationEvaluation(f.actor);
    const expected = legacyPlannerView.call(sheet, f.declaration, evaluation);
    assert.deepEqual((await sheet._prepareContext({})).planner, expected);
    assert.equal(sheet.actionPickerOpen, true);
    assert.equal(expected.actionPickerOpen, !locked);
  }
  game.i18n = translator("en");
});

// Pass 3 mapping retained verbatim as a regression oracle.
function legacyPlannerView(declaration, evaluation) {
    const planner = { ...evaluation, revision: declaration.revision, stanceLabel: displayLabel("stance", declaration.stance),
      enduranceSpend: evaluation.locked ? evaluation.enduranceSpend : declaration.enduranceSpend,
      enduranceOptions: enduranceSpendOptions(this.document, declaration.enduranceSpend),
      issues: declarationIssuesView(evaluation),
      stanceChosen: Boolean(declaration.stance),
      actionPickerOpen: this.actionPickerOpen && Boolean(declaration.stance) && !evaluation.locked,
      actionPickerId: `${this.id}-action-picker`,
      stances: DECLARATION_STANCES.map(value => ({ value, label: displayLabel("stance", value), selected: value === declaration.stance })),
      canAddMovement: !evaluation.locked && evaluation.movementCount === 0 && Boolean(declaration.stance),
      entries: evaluation.entries.map((entry, index, all) => ({ ...entry, number: index + 1,
        movement: entry.kind === "movement", name: entry.action?.name || uiText("Missing or unnamed Action"),
        classificationLabel: displayLabel("classification", entry.action?.classification),
        requiresRoll: entry.action?.rollRequirement === "required", noRoll: entry.action?.rollRequirement === "none",
        dice: entry.calculation ? breakdownView(entry.calculation.successDice) : null,
        threshold: entry.calculation ? breakdownView(entry.calculation.successThreshold) : null,
        diceSourceLabel: formatDiceSourceLabel(entry.action, entry.calculation, this.document),
        rangeLabel: entry.action ? rangeLabel(entry.action.range) : "",
        canMoveUp: index > 0, canMoveDown: index < all.length - 1, completed: declaration.completed.includes(entry.id)
      })) };
return planner;
}
