import assert from "node:assert/strict";
import test from "node:test";
import { shouldActivateCompanion, companionCharacterState } from "../module/companion-state.mjs";

test("Companion activation includes phones and iPad orientations but excludes GMs and large desktops", () => {
  for (const [width, height, touch] of [[390, 844, false], [768, 1024, true], [1024, 768, true], [1024, 1366, true], [1366, 1024, true]]) {
    assert.equal(shouldActivateCompanion({ width, height, touch, isGM: false }), true);
    assert.equal(shouldActivateCompanion({ width, height, touch, isGM: true }), false);
  }
  assert.equal(shouldActivateCompanion({ width: 1440, height: 900, isGM: false }), false);
  assert.equal(shouldActivateCompanion({ width: 1366, height: 1024, coarse: true, isGM: false }), true);
});

test("Companion uses only the native linked character and handles missing, unsupported and inaccessible Actors", () => {
  assert.equal(companionCharacterState({ character: null }).actor, null);
  assert.match(companionCharacterState({ character: { type: "npc", name: "NPC" } }).message, /not a Fated/);
  const actor = { type: "fated", testUserPermission: () => true };
  assert.equal(companionCharacterState({ character: actor }).actor, actor);
  assert.equal(companionCharacterState({ character: { ...actor, testUserPermission: () => false } }).actor, null);
});
