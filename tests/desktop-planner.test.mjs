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
const { FatedActorSheet } = await import("../module/sheets/actor-sheets.mjs");
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
const warnings = [];
globalThis.ui = { notifications: { warn: message => warnings.push(message) } };
foundry.applications.api.ApplicationV2.prototype._preRender = async () => {};
foundry.applications.api.ApplicationV2.prototype._onRender = async () => {};
globalThis.requestAnimationFrame = callback => callback();
let nextEntry = 0;
foundry.utils.randomID = () => `entry-${++nextEntry}`;
function setup() {
  const f = fixture(); const writes = [];
  f.actor.update = async data => {
    writes.push(data);
    Object.assign(f.declaration, data['system.declaration']);
    if ('system.currentStance' in data) f.actor.system.currentStance = data['system.currentStance'];
    if ('system.resources.endurance.value' in data) f.actor.system.resources.endurance.value = data['system.resources.endurance.value'];
  };
  const sheet = new FatedActorSheet({ document: f.actor }); sheet._fatedSection = 'turn';
  const operate = (dataset, revision = f.declaration.revision) => FatedActorSheet.DEFAULT_OPTIONS.actions.planner.call(sheet, {}, {
    dataset, closest: () => ({ dataset: { declarationRevision: String(revision) } })
  });
  return { ...f, sheet, writes, operate };
}
test('desktop Turn registers the shared partial and presentation; Actions remain independent', async () => {
  const f = setup();
  assert.ok(FatedActorSheet.PARTS.main.templates.includes('systems/fated/templates/actor/turn-planner.hbs'));
  const template = readFileSync(new URL('../templates/actor/fated-sheet.hbs', import.meta.url), 'utf8');
  assert.match(template, /else if turnSection\}\}\s*\{\{> "systems\/fated\/templates\/actor\/turn-planner.hbs"/);
  assert.deepEqual((await f.sheet._prepareContext({})).planner, plannerView(f.actor, {
    declaration: f.declaration, evaluation: getDeclarationEvaluation(f.actor), actionPickerId: `${f.sheet.id}-desktop-action-picker`
  }));
  f.declaration.entries = [{ id: 'power', kind: 'action', itemId: 'weapon', actionId: 'strike' }];
  f.action.classification = 'power';
  assert.ok((await f.sheet._prepareContext({})).actions[0].additionIssue);
  f.sheet._fatedSection = 'actions';
  assert.equal((await f.sheet._prepareContext({})).actions[0].additionIssue, undefined);
});
test('desktop operations and mobile read the same declaration in EN/IT, including frozen snapshots', async () => {
  for (const lang of ['en', 'it']) {
    game.i18n = translator(lang);
    const f = setup(); f.actor.system.health.woundSeverity = 1; const mobile = new FatedMobileSheet({ document: f.actor });
    await f.operate({ operation: 'stance', stance: 'offensive' });
    await f.operate({ operation: 'endurance-spend', enduranceSpend: '1' });
    await f.operate({ operation: 'add', kind: 'action', itemId: 'weapon', actionId: 'strike' });
    await f.operate({ operation: 'add', kind: 'movement' });
    const actionEntry = f.declaration.entries[0].id;
    await f.operate({ operation: 'move', entryId: actionEntry, direction: '1' });
    assert.equal(f.declaration.entries[1].id, actionEntry);
    await f.operate({ operation: 'remove', entryId: f.declaration.entries[0].id });
    assert.equal(f.declaration.entries.length, 1);
    const compare = async () => {
      const desktop = (await f.sheet._prepareContext({})).planner;
      const companion = (await mobile._prepareContext({})).planner;
      assert.deepEqual({ ...desktop, actionPickerId: null }, { ...companion, actionPickerId: null });
      assert.notEqual(desktop.actionPickerId, companion.actionPickerId);
      return desktop;
    };
    assert.equal((await compare()).stances.find(s => s.selected).value, 'offensive');
    assert.equal((await compare()).enduranceOptions.find(s => s.selected).value, 1);
    await f.operate({ operation: 'lock' });
    const saved = (await compare()).entries;
    f.action.successDice.base = 99; f.action.name = 'Changed'; f.actor.system.attributes.body = 99;
    assert.deepEqual((await compare()).entries, saved);
    await f.operate({ operation: 'complete', entryId: actionEntry });
    assert.equal((await compare()).entries[0].completed, true);
    await f.operate({ operation: 'complete', entryId: actionEntry });
    assert.equal((await compare()).entries[0].completed, false);
    const endurance = f.actor.system.resources.endurance.value;
    await f.operate({ operation: 'clear' });
    assert.equal(f.declaration.status, 'editing'); assert.deepEqual(f.declaration.entries, []);
    assert.equal(f.declaration.stance, 'offensive'); assert.equal(f.actor.system.resources.endurance.value, endurance);
    assert.equal(f.sheet._fatedSection, 'turn');
  }
  game.i18n = translator('en');
});
test('picker toggles locally, survives rerenders and closes visually on lock; details and scroll persist', async () => {
  const f = setup(); const picker = { hidden: true }; const attributes = {};
  const scroll = { scrollTop: 143 }; const detail = { dataset: { plannerDetail: 'detail' }, open: true };
  f.sheet.element = {
    querySelector: selector => selector === '.turn-picker' ? picker : selector === '.window-content' ? scroll : selector === '.turn-planner' ? {} : null,
    querySelectorAll: selector => selector.includes('data-planner-detail') ? [detail] : []
  };
  const button = { setAttribute: (key, value) => attributes[key] = value };
  FatedActorSheet.toggleActionPicker.call(f.sheet, {}, button);
  assert.equal(picker.hidden, false); assert.equal(attributes['aria-expanded'], 'true');
  assert.equal(f.writes.length, 0); assert.equal(f.sheet.renderCount, 0);
  await f.sheet._preRender({}, {}); detail.open = false; scroll.scrollTop = 0;
  await f.sheet._onRender({}, {});
  assert.equal(detail.open, true); assert.equal(scroll.scrollTop, 143);
  await f.operate({ operation: 'add', kind: 'action', itemId: 'weapon', actionId: 'strike' });
  assert.equal(f.sheet.context.planner.actionPickerOpen, true);
  await f.operate({ operation: 'lock' });
  assert.equal(f.sheet.context.planner.actionPickerOpen, false);
  const css = readFileSync(new URL('../styles/fated.css', import.meta.url), 'utf8');
  assert.match(css, /\.fated-actor \.turn-picker\[hidden\] \{ display: none; \}/);
});
test('pending guard blocks duplicate operations and stale rendered revisions warn without writes', async () => {
  const f = setup(); let release;
  const update = f.actor.update;
  f.actor.update = async data => { await new Promise(resolve => release = resolve); await update(data); };
  const pending = f.operate({ operation: 'stance', stance: 'ranged' });
  assert.equal(f.sheet.plannerPending, true);
  await f.operate({ operation: 'stance', stance: 'defensive' });
  release(); await pending;
  assert.equal(f.writes.length, 1); assert.equal(f.declaration.stance, 'ranged');
  warnings.length = 0;
  await f.operate({ operation: 'stance', stance: 'defensive' }, 7);
  assert.equal(f.writes.length, 1); assert.equal(warnings.length, 1);
  assert.equal(f.sheet.plannerPending, false); assert.equal(f.sheet.renderCount, 2);
});
test('read-only desktop permits viewing but no planner or picker mutation', async () => {
  const f = setup(); f.sheet.isEditable = false;
  await f.operate({ operation: 'stance', stance: 'ranged' });
  FatedActorSheet.toggleActionPicker.call(f.sheet, {}, {});
  assert.equal(f.writes.length, 0); assert.equal(f.sheet.actionPickerOpen, false);
  assert.equal((await f.sheet._prepareContext({})).editable, false);
});

test('desktop planner multiline buttons grow without changing mobile styling', () => {
  const css = readFileSync(new URL('../styles/fated.css', import.meta.url), 'utf8');
  const desktopButtons = css.match(/\.fated-actor \.turn-planner button \{([^}]+)\}/)?.[1];
  assert.ok(desktopButtons);
  assert.match(desktopButtons, /min-height: 2\.75rem;/);
  assert.match(desktopButtons, /height: auto;/);
  assert.match(desktopButtons, /white-space: normal;/);
  assert.match(desktopButtons, /overflow-wrap: anywhere;/);
  assert.match(css, /\.fated-mobile button \{[^}]*height: auto;/);
});
