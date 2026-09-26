import test from "node:test";
import assert from "node:assert/strict";
import { renameProficiency, ProficiencySheetMixin, captureProficiencyDetails,
  restoreProficiencyDetails } from "../module/sheets/proficiency-controls.mjs";

globalThis.game = { user: { isGM: true }, i18n: {
  localize: key => key, format: (key, data) => `${key}: ${data.key}`
} };
const warnings = [];
globalThis.ui = { notifications: { warn: message => warnings.push(message) } };

function fixture() {
  game.user.isGM = true;
  warnings.length = 0;
  const writes = [];
  const actor = {
    system: { proficiencies: [
      { key: "longSwords", displayName: "Swords", attribute: "body", level: 2 },
      { key: "bows", displayName: "Bows", attribute: "mind", level: 1 }
    ] },
    items: { contents: [
      { id: "sword", system: { proficiency: "longSwords", damage: 3 } },
      { id: "secondSword", system: { proficiency: "longSwords" } },
      { id: "bow", system: { proficiency: "bows" } },
      { id: "other", system: { description: "untouched" } }
    ] },
    async update(data, options) {
      writes.push({ type: "Actor", data: structuredClone(data), options });
      this.system.proficiencies = structuredClone(data["system.proficiencies"]);
    },
    async updateEmbeddedDocuments(type, updates, options) {
      assert.equal(type, "Item");
      writes.push({ type, data: structuredClone(updates), options });
      for (const update of updates) {
        this.items.contents.find(item => item.id === update._id).system.proficiency = update["system.proficiency"];
      }
    }
  };
  return { sheet: { document: actor, isEditable: true }, actor, writes };
}

test("non-GM and non-editable sheets cannot rename proficiency keys", async () => {
  for (const [isGM, isEditable] of [[false, true], [true, false], [false, false]]) {
    const { sheet, actor, writes } = fixture();
    const before = structuredClone(actor.system);
    game.user.isGM = isGM;
    sheet.isEditable = isEditable;
    await assert.rejects(renameProficiency(sheet, "longSwords", "Blades"), /ProficiencyKeyPermission/);
    assert.deepEqual(actor.system, before);
    assert.deepEqual(writes, []);
  }
});

test("GM rename normalizes keys, updates all matching owned Items and preserves other fields", async () => {
  const { sheet, actor, writes } = fixture();
  const before = structuredClone(actor.system.proficiencies);
  const unrelated = structuredClone(actor.items.contents.slice(2));
  assert.equal(await renameProficiency(sheet, "longSwords", "  Heavy Blades! "), "heavyBlades");
  assert.deepEqual(actor.system.proficiencies, [{ ...before[0], key: "heavyBlades" }, before[1]]);
  assert.deepEqual(actor.items.contents.slice(0, 2).map(item => item.system.proficiency), ["heavyBlades", "heavyBlades"]);
  assert.equal(actor.items.contents[0].system.damage, 3);
  assert.deepEqual(actor.items.contents.slice(2), unrelated);
  assert.deepEqual(writes[1].data.map(item => item._id), ["sword", "secondSword"]);
});

test("invalid, duplicate and stale keys reject without writes", async () => {
  for (const value of ["", "   ", "!!!", null, "Bows!"]) {
    const { sheet, writes } = fixture();
    await assert.rejects(renameProficiency(sheet, "longSwords", value), /InvalidProficiencyKey|DuplicateProficiency/);
    assert.deepEqual(writes, []);
  }
  const { sheet, writes } = fixture();
  await assert.rejects(renameProficiency(sheet, "missing", "Blades"), /ProficiencyKeyMissing/);
  assert.deepEqual(writes, []);
});

test("unchanged camelCase key is not renormalized", async () => {
  const { sheet, writes } = fixture();
  assert.equal(await renameProficiency(sheet, "longSwords", "longSwords"), "longSwords");
  assert.deepEqual(writes, []);
});

test("Item update failure restores proficiency and references, including partial writes", async () => {
  const { sheet, actor } = fixture();
  const before = structuredClone({ system: actor.system, items: actor.items });
  const updateItems = actor.updateEmbeddedDocuments;
  let fail = true;
  actor.updateEmbeddedDocuments = async function (...args) {
    await updateItems.apply(this, args);
    if (fail) { fail = false; throw new Error("Item write failed"); }
  };
  await assert.rejects(renameProficiency(sheet, "longSwords", "Blades"), /Item write failed/);
  assert.deepEqual({ system: actor.system, items: actor.items }, before);
});

class BaseSheet {
  _processFormData(event, form, formData) { return structuredClone(formData.object); }
  _onChangeForm() { this.normalChanges = (this.normalChanges ?? 0) + 1; }
  async render() {
    captureProficiencyDetails(this);
    this.details = this.document.system.proficiencies.map(prof => ({ dataset: { proficiencyKey: prof.key }, open: false }));
    restoreProficiencyDetails(this);
  }
}

function sheetFixture() {
  const { sheet: data, actor, writes } = fixture();
  const sheet = Object.assign(new (ProficiencySheetMixin(BaseSheet))(), data);
  sheet.details = [{ dataset: { proficiencyKey: "longSwords" }, open: true },
    { dataset: { proficiencyKey: "bows" }, open: false }];
  sheet.element = { querySelectorAll: () => sheet.details };
  return { sheet, actor, writes };
}

const keyEvent = value => ({ target: { value, dataset: { proficiencyKeyInput: "longSwords" }, matches: () => true } });

test("supported change handler rejects non-GM and preserves old key/open state", async () => {
  const { sheet, writes } = sheetFixture();
  game.user.isGM = false;
  await sheet._onChangeForm({}, keyEvent("Blades"));
  assert.deepEqual(writes, []);
  assert.match(warnings[0], /ProficiencyKeyPermission/);
  assert.equal(sheet.details[0].dataset.proficiencyKey, "longSwords");
  assert.equal(sheet.details[0].open, true);
});

test("supported GM handler preserves renamed open row and closed siblings across render", async () => {
  const { sheet, actor } = sheetFixture();
  await sheet._onChangeForm({}, keyEvent("Heavy Blades"));
  assert.equal(actor.system.proficiencies[0].key, "heavyBlades");
  assert.equal(sheet.details[0].open, true);
  assert.equal(sheet.details[1].open, false);
  assert.equal(sheet.normalChanges, undefined);
});

test("ordinary form submissions preserve keys and still accept unrelated field edits", () => {
  const { sheet } = sheetFixture();
  const data = sheet._processFormData(null, null, { object: { system: { proficiencies: {
    0: { key: "tampered", displayName: "New name", attribute: "heart", level: 4 }
  } } } });
  assert.deepEqual(data.system.proficiencies[0], {
    key: "longSwords", displayName: "New name", attribute: "heart", level: 4
  });
});

test("other field changes retain normal submitOnChange routing", async () => {
  const { sheet } = sheetFixture();
  await sheet._onChangeForm({}, { target: { matches: () => false } });
  assert.equal(sheet.normalChanges, 1);
});

test("proficiency detail state survives mobile navigation away and back", () => {
  const { sheet } = sheetFixture();
  captureProficiencyDetails(sheet);
  sheet.details = [];
  captureProficiencyDetails(sheet);
  sheet.details = [{ dataset: { proficiencyKey: "longSwords" }, open: false }];
  restoreProficiencyDetails(sheet);
  assert.equal(sheet.details[0].open, true);
  sheet.details[0].open = false;
  captureProficiencyDetails(sheet);
  restoreProficiencyDetails(sheet);
  assert.equal(sheet.details[0].open, false);
});
