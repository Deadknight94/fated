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

// The three branch markers split the file into the sections they render.
const navStart = template.indexOf("fated-section-nav");
const actionsStart = template.indexOf("fated-sheet-actions");
const itemsStart = template.indexOf("{{#if itemsSection}}", actionsStart);
const notesStart = template.indexOf("{{else if notesSection}}", itemsStart);
const characterStart = template.indexOf("{{else}}", notesStart);
const branchEnd = template.lastIndexOf("{{/if}}");
const between = (from, to) => template.slice(from, to);

test("the desktop sheet declares one navigation bar with one button per tab", () => {
  assert.match(template, /<nav class="fated-section-nav" aria-label="\{\{localize "FATED\.Sheet\.Sections"\}\}">/);
  const nav = between(navStart, actionsStart);
  for (const section of ["character", "items", "notes"])
    assert.equal((nav.match(new RegExp(`<button[^>]*data-action="selectSection"[^>]*data-section="${section}"`, "g")) ?? []).length, 1, section);
  assert.equal((nav.match(/data-action="selectSection"/g) ?? []).length, 3);
});

test("every tab button names itself and marks only itself as active", () => {
  const active = {
    character: /\{\{#if \(or itemsSection notesSection\)\}\}\{\{else\}\} aria-current="page"\{\{\/if\}\}/,
    items: /\{\{#if itemsSection\}\} aria-current="page"\{\{\/if\}\}/,
    notes: /\{\{#if notesSection\}\} aria-current="page"\{\{\/if\}\}/
  };
  const label = { character: "FATED.Common.Character", items: "FATED.Sheet.Items", notes: "FATED.Sheet.Biography" };
  for (const section of Object.keys(active)) {
    // The opening tag ends at the ">" that precedes the button's localized label.
    const [button] = template.match(new RegExp(`<button[^>]*data-section="${section}"[\\s\\S]*?(?=>\\{\\{localize)`));
    assert.ok(button, section);
    assert.match(button, new RegExp(`aria-label="\\{\\{localize "${label[section]}"\\}\\}"`));
    assert.match(button, active[section]);
  }
  assert.equal((template.match(/aria-current="page"/g) ?? []).length, 3);
  // Only the selected section is rendered, so the ARIA tablist roles would be wrong here.
  assert.doesNotMatch(template, /role="tab(list)?"/);
});

test("the sections are mutually exclusive and exactly one is rendered", () => {
  assert.ok(0 < navStart && navStart < actionsStart && actionsStart < itemsStart);
  assert.ok(itemsStart < notesStart && notesStart < characterStart && characterStart < branchEnd);
  assert.match(between(branchEnd, template.length), /^\s*\{\{\/if\}\}\s*<\/div>\s*$/);
});

test("the always-available sheet actions stay outside every section", () => {
  const always = between(actionsStart, itemsStart);
  for (const action of ["openMobile", "openRest"]) assert.match(always, new RegExp(`data-action="${action}"`));
  assert.doesNotMatch(always, /data-action="(health|manualModifier|toggleEquipment|removeItem|openDamage)"/);
});

test("the Items tab holds only the inventory controls", () => {
  const items = between(itemsStart, notesStart);
  assert.match(items, /<section class="panel inventory">/);
  for (const control of ["toggleEquipment", "removeItem"]) assert.match(items, new RegExp(`data-action="${control}"`));
  for (const absent of ['data-action="addProficiency"', 'data-action="openDamage"', 'name="system.biography"', 'name="name"'])
    assert.doesNotMatch(items, new RegExp(absent));
});

test("the Notes tab holds only the biography field", () => {
  const notes = between(notesStart, characterStart);
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
  // The desktop sheet never offered a stance selector.
  assert.doesNotMatch(character, /name="system\.currentStance"/);
});

test("the styling distinguishes the active tab and shows keyboard focus", () => {
  for (const rule of [".fated .fated-section-nav {", '.fated .fated-section-nav button[aria-current="page"] {',
    ".fated .fated-section-nav button:focus-visible {", ".fated .fated-sheet-actions {"])
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
    notes: between(notesStart, characterStart),
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
