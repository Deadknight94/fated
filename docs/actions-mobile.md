# Item Actions and mobile foundation

Target: Foundry VTT 14.367. Physical dice remain the primary play method.

## Data and services

Every current Item type stores an array of embedded `ActionDataModel` values at `system.actions`. Each Action has a stable ID, name, enabled flag, optional classification, Success Dice source/base, threshold, melee/ranged classification, range with explicit units, effect summary, plain rules text, allowed stances, optional Multi-Action eligibility, and two independent modifier arrays.

Blank choices, null numbers and null eligibility mean **unspecified**. An empty stance list also means unspecified, not unrestricted. Selecting all stances explicitly records permission for all four. No example weapon rules or numeric rule defaults are installed. Attribute-based dice sources only resolve when explicitly selected; they do not prescribe which attribute an Action uses.

`item.getAvailableActions()` returns detached enabled Action data with current Item ID, UUID, name and type. `actor.getAvailableActions()` combines those results from owned Items. Availability here means enabled and owned, not an automated stance, equipment, condition or turn legality check. Copying an Item derives fresh source provenance; it cannot retain another owner's source UUID.

The previous single `system.action` is migrated to the array when read, including disabled configurations so their authoring data is not lost. Its recorded name, classification, stance and range are preserved where representable. Missing values remain unspecified; recorded scaffold defaults cannot be distinguished from deliberate selections and are preserved as recorded. Passive classification is retained as a review note, not converted into a guessed Main or Free Action. Saving Actions persists the new representation. An existing array, including an empty array, is authoritative and will never recreate a removed legacy Action. Items with no old or new Action data start with an empty array.

## Modifiers

`calculateAction(action, attributes, additionalModifiers)` recalculates from the base every time. Each of `successDice` and `successThreshold` receives its own list of `{id, label, value, source}` entries. Item configuration stores the ID, label and optional value; the service derives Item/Action provenance. Additional future modifier providers can supply their own provenance.

Results expose the base, individual modifiers, total and completeness. An unknown base or modifier produces an unknown total. There is no guessed minimum, maximum, stance modifier, Multi-Action penalty, equipment bonus or Power effect. Removing a supplied modifier and recalculating removes its contribution without accumulating an earlier total.

## Interface

The desktop Fated sheet offers **Open mobile interface**. The mobile sheet is also registered as an optional Fated sheet in Foundry's sheet configuration. It is separate from the existing desktop and NPC layouts, while sharing documents and services.

Character edits existing resources and attributes. Actions shows enabled Item Actions and expandable, separate dice/threshold breakdowns. Items opens owned Item sheets for authoring. Turn is only a placeholder. No targets, rolls, locking, movement tracking or combat resolution are implemented.

Cards adapt to the width of their sheet, including narrow resizable windows on a desktop. Controls in the player shell, including its window buttons, are at least 48px high. Phone viewports up to 600px use a full-screen sheet. Above that, the sheet remains a resizable window; Foundry may retain a narrowed window size after rotation, so resize or reopen it if desired.

## Future planner compatibility (not implemented)

A future turn document can hold stance plus an ordered list of entries referencing Action keys, with its own entry IDs so the same Action can occur more than once. Main/Free/Power classification and allowed stance metadata already exist. One optional Movement entry belongs to that future turn structure, not to an Item Action or a target. No target fields exist here.

Rebuilding both modifier lists and recalculating from the bases supports adding/removing planned Actions without reusing previous totals. Future stance, Multi-Action and condition providers must supply separately labelled sources; none are applied now. On locking, the future planner must deep-copy the Action data, calculation breakdowns and physical instructions into a saved snapshot, rather than continuing to read live Item values. The detached service results support this boundary, but snapshot persistence, instruction formatting, locking and legality checks are deliberately absent.

## Verification performed for this milestone

- Live Foundry 14.367, isolated `fated-smoke-test` world: two owned Actions saved and reloaded with exact field/ID equality; editing one preserved its sibling; deleting one preserved the surviving record and stayed deleted after reload.
- Actor-service-backed mobile cards reflected both Actions, separate configured totals and labelled breakdowns. Disabling an Action removed it from the list. Test Actions were removed afterward.
- Fated desktop Heart editing changed Endurance/Hope limits correctly; NPC Shadow editing persisted on reopening. Original test resource values were restored. Existing Load remained unchanged.
- Browser viewports: phone portrait 390×844, tablet portrait 768×1024, tablet landscape 1024×768, desktop 1440×900. Checked readable cards, navigation, scrolling, required character values and no horizontal overflow. Also checked a narrow desktop sheet after rotation. Phone controls measured at least 48px high.
- No Fated console errors or Roll buttons were observed. Foundry itself emits its minimum-1024×768 viewport warning at phone/tablet portrait widths; it is logged at error level and remains dismissible. The core interface is not made mobile-compatible by this sheet.
- Remaining device checks: physical phone/iPad Safari, on-screen keyboard behavior and an Actor-owner player account. Automated browser viewport testing does not substitute for those checks.
- Existing scaffold type-name localization keys can appear verbatim in window titles (`TYPES.Actor.fated`, for example). This pre-existing issue is outside this milestone. New interface labels are currently English.

## Repeatable checks

Run `node --test --test-isolation=none tests/actions.test.mjs` with Foundry installed. Set `FOUNDRY_APP_PATH` to its `resources/app` directory if needed. These tests use installed Foundry DataModels and cover schema serialization, legacy conversion, invalid data, modifier recalculation, source provenance, form conversion and baseline resource derivation.

## Manual Foundry smoke test

1. Launch isolated Foundry 14.367, refresh the browser, and enter the smoke-test world with modules disabled.
2. Open existing Fated and NPC desktop sheets. Edit attributes/resources; confirm Endurance and Hope limits and owned equipment Load still update. Confirm NPC Resilience/Shadow editing still works.
3. Open an owned weapon or equipment Item. Add two Actions with distinct names. Leave one rule configuration unspecified. Give the other explicitly chosen test values, a labelled dice modifier and a separate threshold modifier. Use test-only values, not new game rules.
4. Change a value, clear it, enter zero, toggle a stance, and select each eligibility state. Reopen the sheet and refresh the browser. Verify both Actions and all choices survived. Remove a modifier/Action and verify it stays removed after refresh.
5. Open the mobile interface. Confirm Character, Turn, Actions and Items navigation; both Action cards; source Item links; separate modifier explanations; no Roll controls. Disable an Action on its Item and confirm it disappears from the list.
6. At 390×844 and 360×800, check portrait fit, vertical scrolling, persistent bottom navigation and touch controls. At 768×1024 and desktop size, check layout, scrolling and window resizing. Open an Item through the mobile interface and return by closing it.
7. Repeat on a physical phone and iPad, including Safari, the on-screen keyboard and an Actor-owner player account. Confirm editing permissions and no reliance on hover, sidebars or canvas controls after opening the interface.
8. Inspect browser console and Network for Fated errors or missing templates/modules/styles during all steps. Foundry's own minimum-resolution warning may still appear below its supported core viewport size; it is separate from the mobile sheet layout.

Unspecified Action bases, thresholds, range units, permitted stances, effects and eligibility require explicit rule/configuration decisions before those particular Actions can provide complete physical-dice instructions. They do not block this foundation milestone.
