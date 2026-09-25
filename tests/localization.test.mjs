import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { displayLabel, skillGroupsView, localizedHealth, localizedEquipment, modifierLabel, defenseView, rangeLabel, declarationIssuesView } from "../module/presentation/labels.mjs";
import { uiText, systemMessage, isSystemMessage } from "../module/presentation/text.mjs";
import { LocalizedSheetMixin, localizedError } from "../module/presentation/sheet-mixin.mjs";
import { formatDiceSourceLabel } from "../module/helpers/dice-source-label.mjs";
import { buildSkillGroups, SKILL_KEYS } from "../module/skills.mjs";
import { equipmentView } from "../module/equipment.mjs";

const catalogs = Object.fromEntries(["en", "it"].map(lang => [lang, JSON.parse(readFileSync(new URL(`../lang/${lang}.json`, import.meta.url), "utf8"))]));
const translator = lang => ({ localize: key => {
  const value = key.split(".").reduce((object, part) => object?.[part], catalogs[lang]);
  assert.equal(typeof value, "string", `Missing ${lang} key: ${key}`);
  return value;
} });
const en = translator("en"), it = translator("it");
const flatten = (object, prefix = "") => Object.fromEntries(Object.entries(object).flatMap(([key, value]) =>
  typeof value === "object" ? Object.entries(flatten(value, `${prefix}${key}.`)) : [[prefix + key, value]]));

test("EN/IT catalogs have identical recursive paths and format placeholders", () => {
  const english = flatten(catalogs.en), italian = flatten(catalogs.it);
  assert.deepEqual(Object.keys(english).sort(), Object.keys(italian).sort());
  for (const key of Object.keys(english)) {
    assert.ok(key.startsWith("FATED."));
    assert.deepEqual(english[key].match(/\{\w+\}/g)?.sort(), italian[key].match(/\{\w+\}/g)?.sort(), key);
    assert.doesNotMatch(italian[key], /Ã|âˆ|�/);
  }
});

test("stable labels and all Skill groups translate without changing values", () => {
  const groups = buildSkillGroups(Object.fromEntries(SKILL_KEYS.map(key => [key, 2])));
  const before = structuredClone(groups);
  const translated = skillGroupsView(groups, it);
  assert.deepEqual(translated.map(group => group.label), ["Corpo", "Mente", "Cuore"]);
  assert.equal(translated[0].skills[0].label, "Maestosità");
  for (const group of translated) for (const skill of group.skills) assert.equal(skill.value, 2);
  for (const key of SKILL_KEYS) assert.notEqual(displayLabel("skill", key, it), displayLabel("skill", key, en));
  assert.equal(displayLabel("stance", "ranged", it), "Distanza");
  assert.equal(displayLabel("classification", "power", it), "Azione di Potere");
  assert.equal(displayLabel("classification", "movement", en), "Movement");
  assert.equal(displayLabel("classification", "movement", it), "Movimento");
  assert.equal(displayLabel("care", "grievousHealingPending", it), "Guarigione della Ferita Grave in attesa");
  assert.equal(displayLabel("stance", "", it), "Non specificato");
  assert.equal(displayLabel("skill", "customSkill", it), "customSkill");
  assert.deepEqual(groups, before);
});

test("health and equipment projections preserve input and authored names", () => {
  const health = { severity: 2, woundLabel: "Grievous Wound", exhausted: true, broken: true, conditions: ["Broken"] };
  const before = structuredClone(health);
  assert.deepEqual(localizedHealth(health, it).conditions, ["Esausto (+1)", "Spezzato"]);
  assert.equal(localizedHealth(health, it).woundLabel, "Ferita Grave");
  assert.equal(localizedHealth(null, it), null);
  assert.deepEqual(health, before);
  const item = equipmentView({ id: "a", name: "Heart", type: "armor", system: { equipped: true }, isOwner: true });
  assert.deepEqual(localizedEquipment(item, it), { ...item, typeLabel: "Armatura", stateLabel: "Indossata" });
});

test("only system-provenance modifier labels translate, including frozen snapshots", () => {
  const modifiers = [
    { label: "Offensive stance", value: -1, source: { type: "stance", stance: "offensive" } },
    { id: "multi-action", label: "Multi-Action", value: 2, source: { type: "declaration", mainCount: 3 } },
    { label: "Grievous Wound", value: 2, source: { type: "actor-state", condition: "wounds" } },
    { label: "Heart (Worn Armor)", value: 2, source: { type: "item", itemName: "Heart" } },
    { label: "Offensive stance", value: -3, source: { itemId: "custom", actionId: "custom" } },
    { label: "Body", value: 1 }
  ];
  const before = structuredClone(modifiers);
  const defense = { total: 8, modifiers };
  assert.deepEqual(defenseView(defense, it).modifiers.map(modifier => modifier.label),
    ["Posizione Offensiva", "Azioni Multiple", "Ferita Grave", "Heart (Armatura indossata)", "Offensive stance", "Body"]);
  assert.equal(defenseView(defense, it).total, 8);
  assert.deepEqual(modifiers, before);
  assert.equal(modifierLabel({ label: "" }, it), "Modificatore senza nome");
});

test("roll-source provenance wins over current Actor data; proficiency names remain verbatim", () => {
  const calculation = { sourceProvenance: { kind: "proficiency", key: "longSwords", displayName: "Body", level: 0, untrained: true } };
  const before = structuredClone(calculation);
  assert.equal(formatDiceSourceLabel({ skill: "healing" }, calculation, { system: { proficiencies: [] } }, it), "Body 0 (Non addestrato)");
  assert.deepEqual(calculation, before);
  assert.equal(formatDiceSourceLabel({}, { source: { kind: "skill", key: "stealth", level: 4 } }, {}, it), "Furtività 4");
  assert.equal(formatDiceSourceLabel({}, { sourceProvenance: { kind: "missing", type: "proficiency", key: "longSwords" } }, {}, it), "Perizia mancante: longSwords");
  assert.equal(formatDiceSourceLabel({}, { sourceProvenance: { kind: "missing", type: "skill", key: "stealth" } }, {}, it), "Abilità mancante: Furtività");
});

test("legacy and incomplete sources are presentation-only, without fallback resolution", () => {
  const source = { kind: "legacy", key: "body", value: 5 };
  assert.equal(formatDiceSourceLabel({}, { source }, {}, en), "Body 5");
  assert.equal(formatDiceSourceLabel({}, { source }, {}, it), "Corpo 5");
  assert.equal(formatDiceSourceLabel({ skill: "healing" }, null, { system: { skills: { healing: 8 } } }, it), "Non specificato");
  assert.equal(formatDiceSourceLabel({}, { source: { kind: "legacy", value: null } }, {}, it), "Non specificato ?");
});

test("free-form range units and interpolation values remain authored text", () => {
  assert.equal(rangeLabel({ min: 1, max: 3, units: "hexes" }, it), "1–3 hexes");
  assert.equal(rangeLabel({ min: 1, max: null, units: "" }, it), "1–? (unità non specificate)");
  assert.equal(rangeLabel({ min: null, max: null, units: "" }, it), "Non specificato");
  assert.equal(uiText("Missing Proficiency: {key}", { key: "{stance} $& Body" }, it), "Perizia mancante: {stance} $& Body");
});

test("service messages localize only surrounding labels, preserving opaque names", () => {
  assert.equal(systemMessage("Heart: not allowed in ranged stance.", it), "Heart: non consentita in Posizione Distanza.");
  assert.equal(systemMessage("Heart is already Worn. Unwear it before wearing Body.", it), "Heart è già indossata. Rimuovila prima di indossare Body.");
  assert.match(systemMessage("This Fated is Incapacitated (Death's Door and Broken) and cannot lock a normal Turn Declaration.", it), /Soglia della Morte e Spezzato/);
  assert.equal(systemMessage("Final Damage must be a nonnegative number.", it), "Danno finale deve essere un numero non negativo.");
  assert.match(systemMessage("Body: Stored legacy Success Threshold 6 requires review. The universal base is 4; represent confirmed deviations as named Threshold modifiers and reset the legacy value to 4.", it), /^Body: La Soglia di Successo precedente, salvata come 6/);
  assert.equal(systemMessage("Unknown extension message", it), "Unknown extension message");
});

test("combined declaration errors localize each line", () => {
  const message = "Heart: Action classification is unspecified.\nBody: allowed stances are unspecified.";
  assert.equal(systemMessage(message, it), "Heart: la categoria dell’Azione non è specificata.\nBody: le Posizioni consentite non sono specificate.");
});

test("unnamed-Action fallback is localized without translating an authored name with the same text", () => {
  const evaluation = { entries: [{ id: "blank", action: { name: "" } }, { id: "named", action: { name: "Unnamed Action" } }],
    issues: ["blank", "named"].map(entryId => ({ entryId, message: "Unnamed Action: Action classification is unspecified." })) };
  const issues = declarationIssuesView(evaluation, it);
  assert.match(issues[0].message, /^Azione senza nome:/);
  assert.match(issues[1].message, /^Unnamed Action:/);
  assert.equal(evaluation.issues[0].message, "Unnamed Action: Action classification is unspecified.");
});

test("system-message recognition uses known mappings and patterns without a translator", () => {
  assert.equal(isSystemMessage("Minimum range cannot exceed maximum range."), true);
  assert.equal(isSystemMessage("Proficiency Body already exists."), true);
  assert.equal(isSystemMessage("Unknown extension message"), false);
  assert.equal(isSystemMessage(""), false);
});

for (const [lang, i18n, expected] of [
  ["en", en, "Minimum range cannot exceed maximum range."],
  ["it", it, "La gittata minima non può superare quella massima."]
]) test(`${lang}: sheet validation cleans wrappers, rejects, and retains the original error as cause`, async () => {
  const original = new Error("Minimum range cannot exceed maximum range.");
  const translated = localizedError(original, i18n);
  assert.equal(translated.message, expected);
  assert.equal(translated.cause, original);
  assert.equal(original.message, "Minimum range cannot exceed maximum range.");
  const wrapped = new Error("[WeaponDataModel] validation errors: SchemaField#_validateRecursive\n  actions: ArrayField#_validateRecursive\n    0: Minimum range cannot exceed maximum range.");
  const cleaned = localizedError(wrapped, i18n);
  assert.equal(cleaned.message, expected);
  assert.equal(cleaned.cause, wrapped);
  assert.match(wrapped.message, /\[WeaponDataModel\] validation errors:/);
  const named = new Error("Heart: Action classification is unspecified.");
  assert.equal(localizedError(named, i18n).message, lang === "en"
    ? named.message : "Heart: la categoria dell’Azione non è specificata.");
  const keyed = new Error("Proficiency longSwords already exists.");
  assert.equal(localizedError(keyed, i18n).message, lang === "en"
    ? keyed.message : "La Perizia longSwords esiste già.");
  const unknown = new Error("Unknown extension message");
  assert.equal(localizedError(unknown, i18n), unknown);
  class Base { _prepareSubmitData() { throw wrapped; } async _processSubmitData() { throw wrapped; } }
  const sheet = new (LocalizedSheetMixin(Base))();
  const previousGame = globalThis.game;
  globalThis.game = { i18n };
  try {
    const rejected = error => error.message === expected && error.cause === wrapped;
    assert.throws(() => sheet._prepareSubmitData(), rejected);
    await assert.rejects(sheet._processSubmitData(), rejected);
  } finally {
    if (previousGame === undefined) delete globalThis.game;
    else globalThis.game = previousGame;
  }
});

// Integration checks use Foundry's installed DataModels and Handlebars, without a browser.
const appPath = process.env.FOUNDRY_APP_PATH ?? resolve(process.env.LOCALAPPDATA ?? ".", "Programs/Foundry Virtual Tabletop/resources/app");
await import(pathToFileURL(resolve(appPath, "common/server.mjs")));
await import("./helpers/client-applications.mjs");
foundry.applications.sheets.ActorSheetV2.prototype._prepareContext = async () => ({});
foundry.applications.sheets.ItemSheetV2 = foundry.applications.sheets.ActorSheetV2;
const { FatedDataModel, WeaponDataModel } = await import("../module/data-models.mjs");
const { getItemActions } = await import("../module/actions/actions.mjs");
const { FatedActorSheet, NpcActorSheet } = await import("../module/sheets/actor-sheets.mjs");
const { FatedMobileSheet } = await import("../module/sheets/mobile-sheet.mjs");
const { FatedItemSheet } = await import("../module/sheets/item-sheet.mjs");
const { RestApp } = await import("../module/apps/rest-app.mjs");
const { DamageBookkeeping } = await import("../module/sheets/damage-bookkeeping.mjs");
const Handlebars = createRequire(resolve(appPath, "package.json"))("handlebars").create();
Handlebars.registerHelper("localize", (key, options) => game.i18n.localize(key).replace(/\{(\w+)\}/g, (match, name) => options.hash[name] ?? match));
Handlebars.registerHelper("eq", (a, b) => a === b);
Handlebars.registerHelper("not", value => !value);
Handlebars.registerHelper("or", (...values) => values.slice(0, -1).some(Boolean));
Handlebars.registerHelper("disabled", value => value ? "disabled" : "");
Handlebars.registerHelper("checked", value => value ? "checked" : "");
Handlebars.registerHelper("selectOptions", (choices, options) => new Handlebars.SafeString(Object.entries(choices).map(([value, label]) =>
  `<option value="${Handlebars.escapeExpression(value)}"${value === options.hash.selected ? " selected" : ""}>${Handlebars.escapeExpression(label)}</option>`).join("")));
const templates = new Map();
for (const folder of ["templates", "templates/actor", "templates/item"]) {
  for (const name of readdirSync(folder).filter(name => name.endsWith(".hbs"))) {
    const path = `${folder}/${name}`, source = readFileSync(path, "utf8");
    templates.set(path, Handlebars.compile(source));
    Handlebars.registerPartial(`systems/fated/${path}`, source);
  }
}
function actorFixture() {
  const item = { id: "item", uuid: "Item.item", type: "weapon", name: "Body", isOwner: true,
    system: new WeaponDataModel({ damage: 2, actions: [{ id: "action", name: "Heart", classification: "main", rollRequirement: "required",
      skill: "stealth", allowedStances: ["neutral"], attackType: "melee", effect: "Success Dice", rules: "Offensive stance",
      multiActionEligible: true, modifiers: { successDice: [{ id: "custom", label: "Body", value: 1 }] } }] }) };
  const items = [item]; items.contents = items; items.get = id => items.find(item => item.id === id);
  const system = new FatedDataModel({ attributes: { body: 3, mind: 2, heart: 2 }, skills: { stealth: 4 },
    resources: { endurance: { value: 4 }, hope: { value: 0 } }, health: { woundSeverity: 2, woundCare: { care: "treated", daysRemaining: 1 } } });
  system.prepareDerivedData();
  return { id: "actor", uuid: "Actor.actor", type: "fated", name: "Mind", isOwner: true, items, system, apps: {},
    getAvailableActions: () => getItemActions(item) };
}

for (const [lang, i18n] of [["en", en], ["it", it]]) test(`${lang}: desktop/mobile/Item/rest/NPC contexts render without mutating documents`, async () => {
  globalThis.game = { i18n, user: { isGM: true } };
  const actor = actorFixture();
  const before = actor.system.toObject(), itemBefore = actor.items[0].system.toObject();
  const desktop = await new FatedActorSheet({ document: actor })._prepareContext({});
  const mobile = await new FatedMobileSheet({ document: actor })._prepareContext({});
  const item = await new FatedItemSheet({ document: actor.items[0] })._prepareContext({});
  const rest = await new RestApp({ document: actor })._prepareContext({});
  const npc = await new NpcActorSheet({ document: { ...actor, type: "npc", system: { resilience: { value: 3, max: 4 }, shadow: 0 } } })._prepareContext({});
  const damage = new DamageBookkeeping(actor); damage.availableAttacks = () => [];
  const contexts = {
    "templates/actor/fated-sheet.hbs": desktop, "templates/actor/mobile-sheet.hbs": { ...mobile, turn: true, actionsView: true, itemsView: true },
    "templates/item/item-sheet.hbs": item, "templates/actor/rest-app.hbs": rest, "templates/actor/npc-sheet.hbs": npc,
    "templates/actor/damage-bookkeeping.hbs": await damage._prepareContext(), "templates/companion-fallback.hbs": { message: "" }
  };
  for (const [path, context] of Object.entries(contexts)) {
    const html = templates.get(path)(context);
    assert.doesNotMatch(html, /FATED\./, path);
    assert.ok(html.length > 100, path);
  }
  assert.equal(mobile.actions[0].name, "Heart");
  assert.equal(mobile.actions[0].effect, "Success Dice");
  assert.equal(mobile.actions[0].rules, "Offensive stance");
  assert.equal(mobile.actions[0].diceSourceLabel, lang === "it" ? "Furtività 4" : "Stealth 4");
  assert.equal(mobile.items[0].typeLabel, lang === "it" ? "Arma" : "Weapon");
  assert.equal(rest.careLabel, lang === "it" ? "Trattato" : "Treated");
  assert.deepEqual(actor.system.toObject(), before);
  assert.deepEqual(actor.items[0].system.toObject(), itemBefore);
  delete globalThis.game;
});

test("locked planner presentation reads frozen numbers and does not recalculate from live data", async () => {
  globalThis.game = { i18n: it, user: { isGM: false } };
  const actor = actorFixture();
  const declaration = { revision: 2, status: "locked", stance: "offensive", completed: [], snapshot: {
    stance: "offensive", mainCount: 2, multiActionPenalty: 1, entries: [{ id: "entry", kind: "action", action: actor.getAvailableActions()[0],
      calculation: { sourceProvenance: { kind: "skill", key: "stealth", level: 2 },
        successDice: { base: 2, total: 2, complete: true, modifiers: [] },
        successThreshold: { base: 4, total: 5, complete: true, modifiers: [{ id: "multi-action", label: "Multi-Action", value: 1, source: { type: "declaration" } }] } } }] } };
  const before = structuredClone(declaration);
  actor.system.declaration = { toObject: () => declaration };
  const context = await new FatedMobileSheet({ document: actor })._prepareContext({});
  assert.equal(context.planner.entries[0].dice.total, "2");
  assert.equal(context.planner.entries[0].diceSourceLabel, "Furtività 2");
  assert.equal(context.planner.entries[0].threshold.modifiers[0].label, "Azioni Multiple");
  assert.match(templates.get("templates/actor/turn-planner.hbs")(context), /Tira 2 Dadi Successo/);
  assert.deepEqual(declaration, before);
  delete globalThis.game;
});
