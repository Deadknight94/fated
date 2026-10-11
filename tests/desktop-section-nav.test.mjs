// Static assertions about the tabbed desktop sheet: template structure, styling, and
// localization. Handlebars is not available locally, so the template is inspected as
// source rather than rendered.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const template = readFileSync(new URL("../templates/actor/fated-sheet.hbs", import.meta.url), "utf8");
const healthState = readFileSync(new URL("../templates/actor/health-state.hbs", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles/fated.css", import.meta.url), "utf8");
const mobileTemplate = readFileSync(new URL("../templates/actor/mobile-sheet.hbs", import.meta.url), "utf8");
const npcTemplate = readFileSync(new URL("../templates/actor/npc-sheet.hbs", import.meta.url), "utf8");
const catalogs = Object.fromEntries(["en", "it"].map(lang => [lang, JSON.parse(readFileSync(new URL(`../lang/${lang}.json`, import.meta.url), "utf8"))]));

// Branch markers split the file into the sections they render.
const navStart = template.indexOf("fated-section-nav");
const navEnd = template.indexOf("</nav>") + "</nav>".length;
const itemsStart = template.indexOf("{{#if itemsSection}}", navEnd);
const notesStart = template.indexOf("{{else if notesSection}}", itemsStart);
const actionsStart = template.indexOf("{{else if actionsSection}}", notesStart);
const characterStart = template.lastIndexOf("{{else}}", template.indexOf('<header class="fated-sheet-header">'));
const branchEnd = template.lastIndexOf("{{/if}}");
const between = (from, to) => template.slice(from, to);

test("the desktop sheet declares one navigation bar with one button per tab", () => {
  assert.match(template, /<nav class="fated-section-nav" aria-label="\{\{localize "FATED\.Sheet\.Sections"\}\}">/);
  const nav = between(navStart, navEnd);
  for (const section of ["character", "actions", "items", "notes"])
    assert.equal((nav.match(new RegExp(`<button[^>]*data-action="selectSection"[^>]*data-section="${section}"`, "g")) ?? []).length, 1, section);
  assert.equal((nav.match(/data-action="selectSection"/g) ?? []).length, 4);
});

test("every tab button names itself and marks only itself as active", () => {
  const active = {
    character: /\{\{#if \(or actionsSection itemsSection notesSection\)\}\}\{\{else\}\} aria-current="page"\{\{\/if\}\}/,
    actions: /\{\{#if actionsSection\}\} aria-current="page"\{\{\/if\}\}/,
    items: /\{\{#if itemsSection\}\} aria-current="page"\{\{\/if\}\}/,
    notes: /\{\{#if notesSection\}\} aria-current="page"\{\{\/if\}\}/
  };
  const label = { actions: "FATED.Common.Actions", character: "FATED.Common.Character", items: "FATED.Sheet.Items", notes: "FATED.Sheet.Biography" };
  for (const section of Object.keys(active)) {
    // The opening tag ends at the ">" that precedes the button's localized label.
    const [button] = template.match(new RegExp(`<button[^>]*data-section="${section}"[\\s\\S]*?(?=>\\{\\{localize)`));
    assert.ok(button, section);
    assert.match(button, new RegExp(`aria-label="\\{\\{localize "${label[section]}"\\}\\}"`));
    assert.match(button, active[section]);
  }
  assert.equal((template.match(/aria-current="page"/g) ?? []).length, 4);
  // Only the selected section is rendered, so the ARIA tablist roles would be wrong here.
  assert.doesNotMatch(template, /role="tab(list)?"/);
});

test("the sections are mutually exclusive and exactly one is rendered", () => {
  assert.ok(0 < navStart && navStart < navEnd && navEnd < itemsStart);
  assert.ok(itemsStart < notesStart && notesStart < actionsStart && actionsStart < characterStart && characterStart < branchEnd);
  assert.match(between(branchEnd, template.length), /^\s*\{\{\/if\}\}\s*<\/div>\s*$/);
});

test("mobile is absent from the body and Rest follows Health only in Character", () => {
  assert.doesNotMatch(template, /data-action="openMobile"|fated-sheet-actions/);
  assert.doesNotMatch(between(0, characterStart), /data-action="openRest"/);
  assert.equal((template.match(/data-action="openRest"/g) ?? []).length, 1);
  assert.match(between(characterStart, branchEnd), /\{\{> "systems\/fated\/templates\/actor\/health-state\.hbs"\}\}\s*<button type="button" class="fated-character-rest" data-action="openRest">\{\{localize "FATED\.Sheet\.Rest"\}\}<\/button>/);
  assert.doesNotMatch(css, /fated-sheet-actions/);
  assert.match(css, /\.fated-actor \.fated-character-rest\s*\{[^}]*justify-self: start;[^}]*min-height: 2\.75rem;[^}]*background: transparent;/);
  for (const lang of ["en", "it"]) {
    assert.ok(catalogs[lang].FATED.Sheet.OpenMobile);
    assert.ok(catalogs[lang].FATED.Sheet.Rest);
  }
});

test("the Items tab holds only the inventory controls", () => {
  const items = between(itemsStart, notesStart);
  assert.match(items, /<section class="panel inventory">/);
  for (const control of ["toggleEquipment", "removeItem"]) assert.match(items, new RegExp(`data-action="${control}"`));
  for (const absent of ['data-action="addProficiency"', 'data-action="openDamage"', 'name="system.biography"', 'name="name"'])
    assert.doesNotMatch(items, new RegExp(absent));
});

test("the Notes tab holds only the biography field", () => {
  const notes = between(notesStart, actionsStart);
  assert.match(notes, /<section class="panel biography">/);
  assert.match(notes, /name="system\.biography"/);
  for (const absent of ['data-action="toggleEquipment"', 'data-action="removeItem"', 'name="system.skills'])
    assert.doesNotMatch(notes, new RegExp(absent));
});

test("the Character tab keeps every pre-existing desktop control", () => {
  const character = between(characterStart, branchEnd);
  for (const control of ['data-action="editImage"', 'data-action="addProficiency"', 'data-action="removeProficiency"',
    'data-action="manualModifier"', 'data-action="openDamage"', 'data-modifier-field="label"',
    'data-modifier-field="type"', 'data-modifier-field="value"'])
    assert.ok(character.includes(control), control);
  for (const field of ['name="name"', 'name="system.attributes.heart"', 'name="system.attributes.body"',
    'name="system.attributes.mind"', 'name="system.resources.endurance.value"', 'name="system.resources.hope.value"',
    'name="system.resources.power"', 'name="system.proficiencies'])
    assert.ok(character.includes(field), field);
  assert.match(character, /\{\{> "systems\/fated\/templates\/actor\/health-state\.hbs"\}\}/);
  assert.match(character, /\{\{> "systems\/fated\/templates\/actor\/defense\.hbs"\}\}/);
  assert.match(character, /\{\{#if isGM\}\}/);
  // Health/wound care lives in the shared include, which the Character tab still pulls in.
  for (const control of ['data-action="health"', 'data-health-operation="care"', 'data-health-operation="wound"',
    'data-health-operation="stabilize"', 'data-health-operation="correct-death"', 'data-care="{{value}}"',
    'aria-pressed="{{selected}}"'])
    assert.ok(healthState.includes(control), control);
  // Current stance uses the ordinary Actor form field.
  assert.match(character, /name="system\.currentStance"/);
});

test("the styling distinguishes the active tab and shows keyboard focus", () => {
  for (const rule of [".fated .fated-section-nav {", '.fated .fated-section-nav button[aria-current="page"] {',
    ".fated .fated-section-nav button:focus-visible {"])
    assert.ok(css.includes(rule), rule);
  const nav = css.slice(css.indexOf(".fated .fated-section-nav {"));
  assert.match(nav, /position:\s*sticky;\s*top:\s*0;/);
  assert.match(nav, /flex-wrap:\s*wrap;/);
  assert.match(nav, /button\[aria-current="page"\][^{]*\{[^}]*background:/);
  assert.match(nav, /button:focus-visible[^{]*\{[^}]*outline:/);
});

test("the new navigation label exists in both language catalogs", () => {
  for (const lang of ["en", "it"]) {
    const value = catalogs[lang].FATED.Sheet?.Sections;
    assert.equal(typeof value, "string", lang);
    assert.ok(value.length > 0, lang);
  }
  assert.notEqual(catalogs.en.FATED.Sheet.Sections, catalogs.it.FATED.Sheet.Sections);
});

test("no stored field or control is rendered by more than one tab", () => {
  const sections = {
    items: between(itemsStart, notesStart),
    notes: between(notesStart, actionsStart),
    character: between(characterStart, branchEnd)
  };
  const owned = {
    items: ['data-action="toggleEquipment"', 'data-action="removeItem"', 'data-item-id'],
    notes: ['name="system.biography"'],
    character: ['name="name"', 'name="system.attributes', 'name="system.skills', 'name="system.proficiencies',
      'name="system.resources', 'data-action="addProficiency"', 'data-action="manualModifier"',
      'data-action="openDamage"', 'data-action="editImage"']
  };
  for (const [owner, markers] of Object.entries(owned)) {
    for (const marker of markers) {
      assert.ok(sections[owner].includes(marker), `${owner}: ${marker}`);
      for (const other of Object.keys(sections))
        if (other !== owner) assert.equal(sections[other].includes(marker), false, `${other}: ${marker}`);
    }
  }
});

test("the mobile and NPC sheets are untouched by the desktop tab work", () => {
  for (const other of [mobileTemplate, npcTemplate]) assert.doesNotMatch(other, /selectSection|fated-section-nav/);
  assert.match(mobileTemplate, /data-action="showSection"/);
  assert.match(npcTemplate, /data-action="selectNpcSection"/);
});

test("desktop resources retain inputs and limits with six localized, permission-aware buttons", () => {
  const character = between(characterStart, branchEnd);
  const buttons = [...character.matchAll(/<button[^>]*data-action="adjustResource"[^>]*>/g)].map(match => match[0]);
  assert.equal(buttons.length, 6);
  for (const resource of ["endurance", "hope", "power"]) for (const delta of [-1, 1]) {
    const button = buttons.find(button => button.includes(`data-resource="${resource}"`) && button.includes(`data-delta="${delta}"`));
    assert.ok(button);
    assert.match(button, /type="button"/);
    assert.match(button, /\{\{disabled \(not editable\)\}\}/);
    assert.match(button, /aria-label="\{\{localize "FATED\.Mobile\.(Decrease|Increase)/);
  }
  assert.match(character, /value="\{\{system.load\}\}" readonly/);
  assert.doesNotMatch(character, /data-resource="load"/);
  assert.match(character, /<strong>\/ \{\{system.resources.endurance.max\}\}<\/strong>/);
  assert.match(character, /<strong>± \{\{system.resources.hope.max\}\}<\/strong>/);
  assert.match(character, /<strong>\/ \{\{powerMax\}\}<\/strong>/);
  assert.match(character, /<select name="system.currentStance" \{\{disabled \(not editable\)\}\}>\{\{#each currentStances\}\}<option value="\{\{value\}\}"/);
});

test("Item Open is a separate named button from equipment and removal", () => {
  const items = between(itemsStart, notesStart);
  assert.match(items, /<button type="button" class="fated-item-open" data-action="openItem" data-item-id="\{\{item.id\}\}">\{\{localize "FATED.Common.Open"\}\}: \{\{item.name\}\}<\/button>/);
  for (const action of ["openItem", "toggleEquipment", "removeItem"])
    assert.equal((items.match(new RegExp(`data-action="${action}"`, "g")) ?? []).length, 1);
});

test("desktop additions have scoped responsive and keyboard focus styles", () => {
  for (const name of ["fated-resource", "fated-resource-controls", "fated-current-stance", "fated-item-open"])
    assert.match(css, new RegExp(`\\.fated-actor \\.${name}`));
  assert.match(css, /\.fated-actor \.fated-resource \{[^}]*flex-wrap: wrap;/);
  for (const selector of [".fated-resource-controls button", ".fated-current-stance select", ".fated-item-open"])
    assert.ok(css.includes(`.fated-actor ${selector}:focus-visible`));
});

test("EN/IT catalogs align and every desktop localization key exists in both", () => {
  const flatten = (object, prefix = "") => Object.entries(object).flatMap(([key, value]) =>
    typeof value === "object" ? flatten(value, `${prefix}${key}.`) : [prefix + key]);
  assert.deepEqual(flatten(catalogs.en).sort(), flatten(catalogs.it).sort());
  for (const { 1: key } of template.matchAll(/localize "([^"]+)"/g)) for (const lang of ["en", "it"])
    assert.equal(typeof key.split(".").reduce((value, part) => value?.[part], catalogs[lang]), "string", `${lang}: ${key}`);
});

test("Actions navigation order, card information, details and empty state are accessible without editing", () => {
  const nav = between(navStart, navEnd);
  assert.deepEqual([...nav.matchAll(/data-section="([^"]+)"/g)].map(m => m[1]), ["character", "actions", "items", "notes"]);
  const actions = between(actionsStart, characterStart);
  for (const field of ["name", "source.itemName", "classificationLabel", "rollRequirementLabel", "dice.total",
    "threshold.total", "damagePerSuccess", "attackLabel", "rangeLabel", "stanceLabel", "eligibilityLabel",
    "effect", "rules", "thresholdReviewIssue", "diceSourceLabel", "dice.base", "threshold.base"])
    assert.ok(actions.includes(`{{action.${field}}}`), field);
  for (const type of ["dice", "threshold"])
    assert.ok(actions.includes(`{{#each action.${type}.modifiers}}<div><dt>{{label}}</dt><dd>{{value}}</dd></div>{{/each}}`));
  assert.match(actions, /<details class="fated-action-breakdown">\s*<summary>/);
  assert.match(actions, /data-action="openItem" data-item-id="\{\{action.source.itemId\}\}"/);
  assert.match(actions, /FATED.Mobile.NoActions/);
  assert.match(actions, /FATED.Mobile.AddActionHint/);
  assert.match(actions, /FATED.Common.Unspecified/);
  assert.doesNotMatch(actions, /disabled|@root.editable|data-action="planner"|name="system\.|\{\{\{action\./);
  assert.match(css, /\.fated-actor \.fated-action-breakdown summary:focus-visible/);
  assert.match(css, /\.fated-actor \.fated-action-card button:focus-visible/);
  assert.match(css, /\.fated-actor \.fated-action-rules \{ white-space: pre-wrap; line-height: 1.5; \}/);
  assert.match(css, /minmax\(min\(100%, 14rem\), 1fr\)/);
});
