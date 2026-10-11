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
const { adjustResource } = await import("../module/resources.mjs");
const { toggleEquipment } = await import("../module/sheets/equipment-controls.mjs");

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

function resourceSheet() {
  const document = { ...actor, system: structuredClone(actor.system), updates: [],
    async update(data) {
      this.updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split(".");
        const key = parts.pop();
        parts.reduce((object, part) => object[part], this)[key] = value;
      }
    } };
  const desktop = new FatedActorSheet({ document });
  desktop.submit = async () => {};
  return desktop;
}
const adjust = (desktop, resource = "hope", delta = 1) =>
  FatedActorSheet.DEFAULT_OPTIONS.actions.adjustResource.call(desktop, {}, { dataset: { resource, delta: String(delta) } });

test("desktop resource actions match the shared service for normal, bounded and invalid inputs", async () => {
  for (const resource of ["endurance", "hope", "power", "load", "unknown"]) {
    for (const delta of [-1, 1, 2, NaN]) for (const value of [0, 3, 7, -3]) {
      const desktop = resourceSheet();
      if (resource === "power") desktop.document.system.resources.power = value;
      else if (["endurance", "hope"].includes(resource)) desktop.document.system.resources[resource].value = value;
      const expected = resourceSheet().document;
      expected.system = structuredClone(desktop.document.system);
      await adjustResource(expected, resource, delta);
      await adjust(desktop, resource, delta);
      assert.deepEqual(desktop.document.updates, expected.updates);
      assert.deepEqual(desktop.document.system, expected.system);
      assert.equal(desktop.resourcePending, false);
    }
  }
});

test("pending edits persist before adjustment and duplicate clicks are blocked throughout both writes", async () => {
  const desktop = resourceSheet();
  let finishSubmit, finishUpdate;
  desktop.submit = async () => {
    await new Promise(resolve => { finishSubmit = resolve; });
    desktop.document.system.resources.hope.value = 1;
    desktop.document.system.biography = "pending notes";
  };
  const update = desktop.document.update.bind(desktop.document);
  desktop.document.update = async data => {
    await new Promise(resolve => { finishUpdate = resolve; });
    await update(data);
  };
  const first = adjust(desktop);
  await adjust(desktop);
  assert.equal(desktop.document.updates.length, 0);
  finishSubmit();
  while (!finishUpdate) await Promise.resolve();
  await adjust(desktop);
  finishUpdate();
  await first;
  assert.deepEqual(desktop.document.updates, [{ "system.resources.hope.value": 2 }]);
  assert.equal(desktop.document.system.biography, "pending notes");
  assert.equal(desktop.resourcePending, false);
});

test("resource permission checks prevent writes and read-only sheets never submit", async () => {
  const desktop = resourceSheet();
  desktop.isEditable = false;
  desktop.submit = async () => assert.fail("read-only submit");
  await adjust(desktop);
  assert.deepEqual(desktop.document.updates, []);
  desktop.isEditable = true;
  desktop.submit = async () => {};
  desktop.document.isOwner = false;
  await adjust(desktop);
  assert.deepEqual(desktop.document.updates, []);
});

test("failed submission or update warns, releases the guard and does not retry the write", async (t) => {
  const warnings = [];
  t.mock.method(ui.notifications, "warn", message => warnings.push(message));
  for (const stage of ["submit", "update"]) {
    const desktop = resourceSheet();
    const target = stage === "submit" ? desktop : desktop.document;
    target[stage] = async () => { throw new Error("Rejected edit"); };
    await adjust(desktop);
    assert.equal(desktop.resourcePending, false);
    assert.deepEqual(desktop.document.updates, []);
  }
  assert.deepEqual(warnings, ["Rejected edit", "Rejected edit"]);
});

test("current stance choices reflect Actor state and normal form events delegate unchanged", async (t) => {
  const desktop = resourceSheet();
  const inherited = foundry.applications.sheets.ActorSheetV2.prototype;
  inherited._onChangeForm ??= async () => {};
  inherited._processFormData ??= (event, form, formData) => formData.object;
  t.mock.method(inherited, "_onChangeForm", async function (config, event) {
    assert.equal(config, FatedActorSheet.DEFAULT_OPTIONS.form);
    if (this.isEditable) await this.document.update({ [event.target.name]: event.target.value });
  });
  const beforeDeclaration = desktop.document.system.declaration;
  for (const stance of ["neutral", "offensive", "defensive", "ranged"]) {
    const event = { target: { name: "system.currentStance", value: stance, matches: () => false } };
    const data = { system: { currentStance: stance } };
    assert.deepEqual(desktop._processFormData(event, {}, { object: data }), data);
    await desktop._onChangeForm(FatedActorSheet.DEFAULT_OPTIONS.form, event);
    const context = await desktop._prepareContext({});
    assert.deepEqual(context.currentStances.map(choice => choice.value), ["neutral", "offensive", "defensive", "ranged"]);
    assert.deepEqual(context.currentStances.filter(choice => choice.selected).map(choice => choice.value), [stance]);
  }
  assert.equal(desktop.document.system.declaration, beforeDeclaration);
  assert.equal(FatedActorSheet.DEFAULT_OPTIONS.form.submitOnChange, true);
  assert.equal(Object.hasOwn(NpcActorSheet.DEFAULT_OPTIONS.actions, "adjustResource"), false);
  assert.notEqual(FatedMobileSheet.DEFAULT_OPTIONS.actions.adjustResource, FatedActorSheet.DEFAULT_OPTIONS.actions.adjustResource);
});

test("Item opening uses only the embedded sheet, including read-only viewing and missing Items", () => {
  const calls = [];
  const desktop = resourceSheet();
  desktop.document.items = new Map([["owned", { sheet: { render: options => calls.push(options) } }]]);
  for (const editable of [true, false]) {
    desktop.isEditable = editable;
    for (const itemId of ["owned", "missing"])
      FatedActorSheet.DEFAULT_OPTIONS.actions.openItem.call(desktop, {}, { dataset: { itemId } });
  }
  assert.deepEqual(calls, [{ force: true }, { force: true }]);
  assert.deepEqual(desktop.document.updates, []);
});

test("equipment keeps its shared handler and removal still submits and honors edit permission", async () => {
  assert.equal(FatedActorSheet.DEFAULT_OPTIONS.actions.toggleEquipment, toggleEquipment);
  const desktop = resourceSheet();
  const calls = [];
  const item = { id: "owned", type: "weapon", isOwner: true, system: { equipped: false },
    async update(data) { calls.push(data); this.system.equipped = data["system.equipped"]; } };
  desktop.document.items = new Map([[item.id, item]]);
  const before = structuredClone(desktop.document.system);
  for (const expected of [true, false]) {
    await FatedActorSheet.DEFAULT_OPTIONS.actions.toggleEquipment.call(desktop, {}, { dataset: { itemId: item.id } });
    assert.equal(item.system.equipped, expected);
  }
  assert.deepEqual(calls, [{ "system.equipped": true }, { "system.equipped": false }]);
  assert.deepEqual(desktop.document.system, before);
  calls.length = 0;
  desktop.submit = async () => calls.push("submit");
  desktop.document.deleteEmbeddedDocuments = async (type, ids) => calls.push([type, ids]);
  await FatedActorSheet.DEFAULT_OPTIONS.actions.removeItem.call(desktop, {}, { dataset: { itemId: "owned" } });
  desktop.isEditable = false;
  await FatedActorSheet.DEFAULT_OPTIONS.actions.removeItem.call(desktop, {}, { dataset: { itemId: "owned" } });
  assert.deepEqual(calls, ["submit", ["Item", ["owned"]]]);
});
