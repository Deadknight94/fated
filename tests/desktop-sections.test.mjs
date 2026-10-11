import assert from "node:assert/strict";
import test from "node:test";

// The desktop sheet keeps its selected tab on the sheet instance, so these tests drive the real
// module with the same light stubs used by the other local sheet tests.
globalThis.foundry = {};
globalThis.game = { user: { isGM: false }, i18n: { localize: (key) => key, format: (key) => key } };
globalThis.ui = { notifications: { warn: () => {} } };
globalThis.Actor = class {};
globalThis.Item = class {};
await import("./helpers/client-applications.mjs");
foundry.data = { fields: new Proxy({}, { get: (_, key) => class { constructor(...args) {} } }) };
foundry.abstract = { DataModel: class {}, Type: class {} };
foundry.utils = { randomID: () => "id", clone: (value) => value };
foundry.common = { documentTypes: new Proxy({}, { get: (_, key) => class {} }) };
foundry.applications.sheets.ActorSheetV2.prototype._prepareContext = async () => ({});
foundry.applications.sheets.ActorSheetV2.prototype._getHeaderControls = () => [];

const submits = [];
foundry.applications.api.ApplicationV2.prototype.submit = () => submits.push("submit");
foundry.applications.api.ApplicationV2.prototype._onRender = async () => {};
foundry.applications.api.ApplicationV2.prototype._preRender = async () => {};
globalThis.requestAnimationFrame = (callback) => callback();

const { FatedActorSheet, NpcActorSheet } = await import("../module/sheets/actor-sheets.mjs");
const { FatedMobileSheet } = await import("../module/sheets/mobile-sheet.mjs");
const { RestApp } = await import("../module/apps/rest-app.mjs");

const SECTIONS = ["character", "items", "notes"];

const actor = {
  id: "a1", _id: "a1", name: "Yara", type: "fated", img: "", isOwner: true,
  system: {
    attributes: { heart: 2, body: 3, mind: 1 },
    skills: { maestosita: 2, stealth: 1 },
    resources: { endurance: { value: 5, max: 7 }, hope: { value: 0, max: 3 }, power: 0 },
    load: 2, proficiencies: [], manualRollModifiers: [], biography: "notes",
    health: { wounds: [], soak: 0, resilience: { value: 7, max: 7 } },
    declaration: null, currentStance: "neutral"
  },
  items: (() => { const contents = []; return { contents, [Symbol.iterator]: () => contents[Symbol.iterator]() }; })()
};

const sheet = new FatedActorSheet({ document: actor });
const flags = (context) => [context.itemsSection, context.notesSection];
const click = (section) => FatedActorSheet.selectSection.call(sheet, { type: "button" }, { type: "button", dataset: { section } });

// Minimal stand-in for the rendered sheet DOM: the scroll container plus the proficiency
// details the sheet's capture/restore pass walks.
const sheetElement = (scroll) => ({
  querySelector: (selector) => selector === ".window-content" ? scroll : null,
  querySelectorAll: () => []
});

test("desktop sheet defaults to the Character tab", async () => {
  assert.equal(sheet._fatedSection, "character");
  assert.deepEqual(await flags(await sheet._prepareContext({})), [false, false]);
});

test("each tab exposes exactly one section flag and persists across rerenders", async () => {
  for (const section of SECTIONS) {
    sheet._fatedSection = section;
    for (const rerender of [1, 2]) {
      assert.deepEqual(await flags(await sheet._prepareContext({})), [section === "items", section === "notes"]);
      assert.equal(sheet._fatedSection, section);
    }
  }
  sheet._fatedSection = "character";
});

test("unknown or missing tab data falls back to the Character tab", async () => {
  for (const value of ["turn", "actions", "", null, undefined, 0, {}]) {
    sheet._fatedSection = value;
    assert.deepEqual(await flags(await sheet._prepareContext({})), [false, false]);
  }
  sheet._fatedSection = "character";
});

test("switching tabs submits pending form changes before rerendering", async () => {
  submits.length = 0;
  await click("items");
  assert.deepEqual(submits, ["submit"]);
  assert.equal(sheet._fatedSection, "items");
});

test("switching tabs on a read-only sheet changes the tab without submitting", async () => {
  sheet.isEditable = false;
  submits.length = 0;
  await click("notes");
  assert.deepEqual(submits, []);
  assert.equal(sheet._fatedSection, "notes");
  sheet.isEditable = true;
  sheet._fatedSection = "character";
});

test("the selected tab never reaches the Actor document", () => {
  for (const forbidden of ["section", "selectedSection", "sheetSection"]) {
    assert.equal(Object.hasOwn(actor, forbidden), false, forbidden);
    assert.equal(Object.hasOwn(actor.system, forbidden), false, forbidden);
  }
});

test("switching tabs restarts the sheet at the top of the new section", async () => {
  const scroll = { scrollTop: 240 };
  sheet.element = sheetElement(scroll);
  await click("items");
  assert.equal(sheet._fatedSection, "items");
  await sheet._onRender({}, {});
  assert.equal(scroll.scrollTop, 0);
  sheet._scrollPosition = 240;
  await sheet._onRender({}, {});
  assert.equal(scroll.scrollTop, 240);
  sheet.element = undefined;
  sheet._scrollPosition = 0;
  sheet._fatedSection = "character";
});

test("reselecting the current tab leaves the scroll position alone", async () => {
  const scroll = { scrollTop: 240 };
  sheet._fatedSection = "items";
  sheet.element = sheetElement(scroll);
  sheet._scrollPosition = 240;
  await click("items");
  await sheet._onRender({}, {});
  assert.equal(scroll.scrollTop, 240);
  assert.equal(Boolean(sheet._sectionChanged), false);
  sheet.element = undefined;
  sheet._scrollPosition = 0;
  sheet._fatedSection = "character";
});

test("invalid tab data is ignored and leaves the selected tab unchanged", async () => {
  submits.length = 0;
  await click(undefined);
  await click("turn");
  assert.equal(sheet._fatedSection, "character");
  assert.deepEqual(submits, []);
});

test("the desktop tab action is desktop-only and every existing desktop control is still offered", () => {
  const actions = FatedActorSheet.DEFAULT_OPTIONS.actions;
  for (const action of ["toggleEquipment", "openRest", "openMobile", "health", "manualModifier", "openDamage",
    "selectSection", "addProficiency", "removeProficiency", "removeItem"])
      assert.ok(actions[action], action);
  for (const forbidden of ["selectNpcSection", "showSection", "planner", "moveTurn", "addAction", "clearTurn", "pushTurn"])
    assert.equal(Object.hasOwn(actions, forbidden), false, forbidden);
});

test("the native mobile header entry preserves inherited controls on every desktop tab", (t) => {
  const inherited = Object.freeze([
    Object.freeze({ action: "configureSheet", label: "Sheet", visible: false }),
    Object.freeze({ action: "showPortraitArtwork", label: "Portrait" })
  ]);
  t.mock.method(foundry.applications.sheets.ActorSheetV2.prototype, "_getHeaderControls",
    function () { return inherited; });
  const desktop = new FatedActorSheet({ document: actor });
  for (const editable of [true, false]) for (const section of SECTIONS) {
    desktop.isEditable = editable;
    desktop._fatedSection = section;
    const controls = desktop._getHeaderControls();
    assert.deepEqual(controls.slice(0, -1), inherited);
    assert.equal(controls[0], inherited[0]);
    assert.deepEqual(controls.at(-1), {
      action: "openMobile", label: "FATED.Sheet.OpenMobile", icon: "fa-solid fa-mobile-screen-button"
    });
    assert.equal(controls.length, inherited.length + 1);
  }
  assert.deepEqual(new NpcActorSheet({ document: actor })._getHeaderControls(), inherited);
  assert.equal(Object.hasOwn(FatedMobileSheet.prototype, "_getHeaderControls"), false);
  assert.equal(Object.hasOwn(NpcActorSheet.DEFAULT_OPTIONS.actions, "openMobile"), false);
});

test("desktop menu and Rest actions reuse the existing apps without writes or tab changes", async (t) => {
  const document = { ...actor, apps: {}, update() { assert.fail("opening an app must not update the Actor"); } };
  const before = structuredClone(document.system);
  const desktop = new FatedActorSheet({ document });
  t.mock.method(FatedMobileSheet.prototype, "render", async function (options) {
    assert.deepEqual(options, { force: true });
    assert.equal(this.document, document);
    return this;
  });
  t.mock.method(RestApp.prototype, "render", async function (options) {
    assert.deepEqual(options, { force: true });
    assert.equal(this.document, document);
    return this;
  });
  submits.length = 0;
  for (const section of SECTIONS) {
    desktop._fatedSection = section;
    const mobile = await FatedActorSheet.DEFAULT_OPTIONS.actions.openMobile.call(desktop);
    assert.ok(mobile instanceof FatedMobileSheet);
    document.apps.mobile = mobile;
    assert.equal(await FatedActorSheet.DEFAULT_OPTIONS.actions.openMobile.call(desktop), mobile);
    const rest = await FatedActorSheet.DEFAULT_OPTIONS.actions.openRest.call(desktop);
    assert.ok(rest instanceof RestApp);
    assert.equal(await FatedActorSheet.DEFAULT_OPTIONS.actions.openRest.call(desktop), rest);
    assert.equal(desktop._fatedSection, section);
  }
  assert.deepEqual(document.system, before);
  assert.deepEqual(submits, []);
});
