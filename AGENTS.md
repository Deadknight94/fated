# Fated Agent Guide

Operational guide for coding agents in this repository. It is tool-independent: use whatever
file, search, and shell primitives your harness provides. Nothing here assumes a specific agent,
operating system, editor, or chat product.

### Project

Fated is a custom tabletop RPG implemented as a native **Foundry VTT v14 game system**
(`system.json` id `fated`, `compatibility.minimum: 14`, verified `14.367`). The purpose is a
faithful implementation of an existing design, **not** a redesign of it.

Physical dice are the primary play method. The Foundry layer provides bookkeeping, derived state,
legality checks, dice instructions, and a mobile-first player interface (Companion Mode). It is not
a digital-dice engine; do not build one unless a task explicitly asks.

`README.md` is the current source map, implemented-scope guide, known-quirks list, and check
instructions. `docs/FATED_RULES_CANON.md` is the rules snapshot. Read both; do not restate them
here.

### Sources of truth

Authority order, highest first:

1. The current task prompt and explicit owner instructions.
2. `docs/FATED_RULES_CANON.md`.
3. `README.md` (current implementation state and documented deviations).
4. Code and tests: evidence about what the code does, never authority for what a rule should be.

Rules of engagement:

- Never invent, reinterpret, or silently complete a rule. Rules marked TBD or absent are not
  implementation requirements unless the task says otherwise.
- A task prompt may intentionally restate, narrow, or change a rule for the current change. That is
  legitimate work: implement what was asked and name the canon text it conflicts with. Do not
  auto-reject a task because it deviates from canon.
- If the task and canon genuinely conflict in a way the task does not resolve, report the conflict
  and stop the affected part. Do not choose a side silently.
- If a needed rule is missing or ambiguous, say what is blocked and ask for a rules decision.
- Never substitute D&D, Pathfinder, Savage Worlds, or other systems' conventions for Fated
  mechanics (Success Dice pools, the Fate Die, Hope, Endurance, Load, Power, Shadow, turn
  declaration, locked Multi-Action penalties, stances, binary cover, simplified adversaries).
- No inaccessible authority: no chat transcripts, no external documents as working sources. The
  human master rules document lives outside the repo; `docs/FATED_RULES_CANON.md` is the snapshot
  agents may read.
- Minor technical choices that cannot change gameplay may be made normally; state them.

### Read before changing

| Area | Files |
| --- | --- |
| Entry point, registration | `fated.mjs`, `system.json` |
| Stored schema, derived values | `module/data-models.mjs`, `module/documents.mjs` |
| Action schema and dice/Threshold math | `module/actions/action-model.mjs`, `module/actions/actions.mjs` |
| Turn declaration, stance, Multi-Action, Endurance push | `module/declaration/data-model.mjs`, `module/declaration/evaluate.mjs`, `module/declaration/service.mjs`, `module/declaration/endurance-push.mjs` |
| Health, wounds, wound care, defense, damage, resources, Load | `module/health.mjs`, `module/wound-care.mjs`, `module/defense.mjs`, `module/damage.mjs`, `module/resources.mjs`, `module/equipment.mjs` |
| Rest services and rest UI | `module/rest/short-rest.mjs`, `module/rest/long-rest.mjs`, `module/rest/extended-rest.mjs`, `module/rest/wound-care-day.mjs`, `module/apps/rest-app.mjs` |
| Skills, proficiency keys, dice source labels | `module/skills.mjs`, `module/helpers/proficiency-keys.mjs`, `module/helpers/dice-source-label.mjs` |
| Presentation and localization | `module/presentation/text.mjs`, `module/presentation/labels.mjs`, `module/presentation/roll-summary.mjs`, `module/presentation/sheet-mixin.mjs`, `lang/en.json`, `lang/it.json` |
| Sheets and controls | `module/sheets/actor-sheets.mjs`, `module/sheets/mobile-sheet.mjs`, `module/sheets/item-sheet.mjs`, `module/sheets/action-form.mjs`, `module/sheets/health-controls.mjs`, `module/sheets/equipment-controls.mjs`, `module/sheets/manual-modifier-controls.mjs`, `module/sheets/proficiency-controls.mjs`, `module/sheets/damage-bookkeeping.mjs` |
| Companion Mode | `module/companion.mjs`, `module/companion-state.mjs` |
| Combat phase state | `module/combat/phase.mjs`, `module/combat/hooks.mjs` |
| Templates and styling | `templates/**/*.hbs`, `styles/fated.css` |
| Tests (mirror the subsystems above) | `tests/*.test.mjs`, `tests/fixtures/planner-actor.json`, `tests/helpers/client-applications.mjs` |

### Architecture

Clear layering; keep new code in the right layer:

- **Data**: System DataModels declare stored fields. Derived values are computed during Actor
  preparation, not stored or independently edited.
- **Rules/services**: pure, inspectable functions under `module/`. No DOM, no UI, no rendering.
  Call them afresh with all applicable modifiers; never accumulate prior totals.
- **Presentation**: labels, roll summaries, and text adaptation translate service output for
  display only. They never change stored data or rules.
- **Sheets/controllers**: form handling and explicit user actions. A service commits at most one
  `Actor.update()`; multi-document edits are separate operations with attempted rollback, not
  transactions.
- **Templates**: presentation only. Do not put significant game logic in Handlebars.

Avoid premature abstraction. This is a playtest system: prefer clear, inspectable implementations
over generalized frameworks.

### Important implementation invariants

Preserve these unless the task explicitly changes them:

- The universal Success Threshold base is **4** (`BASE_SUCCESS_THRESHOLD`). There is no generic
  Threshold floor or ceiling: a natural 6 must stay meaningful when the final Threshold is above 6.
  `calculateValue` never clamps. The only documented clamps are the one-die minimum on a **known**
  Success Dice total and Defense's effective-total minimum.
- Success Dice modifiers and Success Threshold modifiers are distinct arrays, distinct totals, and
  must remain separately traceable to their source rule.
- Known Success Dice totals are at least 1.
- Every modifier carries traceable provenance (source, label, value). Do not flatten provenance
  into a bare number.
- Actor-wide state modifiers, contextual Action/turn modifiers, and manual Actor modifiers
  (`system.manualRollModifiers`) are three different things. Never merge them.
- A locked Turn Declaration is a frozen historical snapshot. Reading it never recalculates from
  current Items or Actor state; recalculation happens only while the declaration is editable.
  Multi-Action penalties are based on the original declared Main Action count and survive abandoned
  or lost actions.
- `getActorActions()` and `getAvailableActions()` currently mean **owned + enabled** only. Do not
  redefine them as equipped, stance-legal, or usable. Legality is evaluated in declaration
  evaluation, not availability.
- `rollRequirement` is three-state: `required`, `none`, or null/unspecified. Never infer a
  requirement from missing dice data or legacy numeric defaults. A stored non-4 legacy Threshold is
  flagged for review (`legacyThresholdIssue`), never auto-converted.
- Timing is explicit and manual: rest, wound-care countdowns, Endurance push, stance changes, and
  damage application are driven by explicit calls/services. Do not add automatic timers, elapsed
  time, care advancement, combat flow, map legality, targeting, or scene behavior where a manual
  service is deliberate.
- User-authored text (Actor/Item names, Action names, modifier labels, rules text, free-form range
  units) is never treated as system text.

### Foundry v14

- Use current v14 APIs: ApplicationV2 with `HandlebarsApplicationMixin`, System DataModels,
  `_processFormData`/`_onChangeForm`, `updateEmbeddedDocuments`, `testUserPermission`, document
  flags (combat phase state lives in flags, not schema).
- Do not introduce compatibility shims for older Foundry versions.
- Keep schema changes deliberate and documented; migrations are added once stored schemas begin
  changing between released versions.
- Respect `system.json`: declared `documentTypes`/`htmlFields`, hex grid at distance 1, the single
  `fated.mjs` esmodule entry point.

### UI and UX

- Mobile/tablet play is a core requirement, not a later feature. Large touch targets, concise flows,
  minimal modal nesting, clear resources, actions reachable without excessive scrolling, layouts
  that adapt to narrow screens.
- No essential interaction may depend on hover, Foundry sidebars, or canvas/token controls.
- Keep interaction explicit: separate Preview and Apply actions, visible menus instead of hidden
  core dialogs, per-window pending guards.
- DOM expansion/collapse state is client-local and must never become Document data.
- Companion Mode is client-only: it reuses the mobile sheet and Foundry's `User.character`; it does
  not persist settings, replace Actor storage, or mutate shared Scenes.
- Sheets compose through mixins (`ActorSheetV2` → Handlebars mixin → localized mixin → proficiency
  mixin); keep that composition rather than duplicating sheet behavior.

### Localization

- System-owned English UI strings are localized through the explicit catalog in
  `module/presentation/text.mjs` (`uiText`), with `FATED.*` keys present in **both** `lang/en.json`
  and `lang/it.json`. Add the string, the key, and both language entries in the same change.
- Service errors stay English and are adapted only at the presentation boundary
  (`systemMessage`, `isSystemMessage`). Recognition depends on the catalog, never on whether
  translation changed the wording.
- Unknown, unrecognized, or authored text passes through untranslated. Never localize stored data,
  rules text, Actor/Item names, Action names, modifier labels, or proficiency keys.
- Keep `en` and `it` key sets aligned; the localization test asserts this.

### Mechanics changes

Before changing rules or math:

1. Identify the rule in `docs/FATED_RULES_CANON.md` (or the task prompt) and quote it.
2. Read the existing service and its matching test.
3. Keep calculations pure, additive, and reusable; do not duplicate rules across sheets.
4. Test the normal case, a boundary/minimum case, and a relevant invalid case; assert no unintended
   Document or resource changes occur.
5. Represent item-specific behavior as Item/Action data, not hard-coded branches in the dice engine.
6. If the rule is missing or ambiguous, stop and report; do not guess.

### Change discipline

- Inspect the existing implementation before refactoring; explain why a refactor is necessary.
- Prefer small, reviewable changes. Do not combine unrelated mechanics and UI work in one change.
- Preserve current behavior unless the task changes it. Do not "fix" a documented deviation from
  canon, a stale doc, or a known runtime quirk unless the task asks; report it instead.
- Do not implement new gameplay mechanics just to make the system more complete. If a missing rule
  does not block the current task, leave it and note it.
- Do not rewrite historical docs (`docs/actions-mobile.md`, `docs/damage-bookkeeping.md`,
  `docs/character-roll-modifiers.md`, `docs/LOCALIZATION_AUDIT.md`) unless asked; report staleness.

### Test Environment Constraint

This agent environment is a Docker container with **no live Foundry VTT instance and no browser**.

Do NOT: install or launch Foundry, connect to an external Foundry server, run browser automation,
create additional containers or simulators for live testing, block completion because live testing
is unavailable, or claim live verification was performed.

Validate with repository-local tools only:

- `node --check` on `.mjs` sources.
- JSON parsing of `system.json`, `lang/*.json`, and test fixtures.
- Static template/CSS inspection and accessibility/state assertions.
- Focused Node tests: `node --test tests/<name>.test.mjs`; the full `node --test tests/*.test.mjs`
  run where supported.
- Localization/rendering tests that do not require the Foundry runtime.
- `git diff --check`.

Most tests import the Foundry runtime and cannot execute here; a small subset runs locally. Check
whether a test imports that runtime before running it. Establish the baseline **before** your change
and compare **after** it: report which tests newly fail and why. Do not hardcode a pass/fail count,
and do not hide or "fix" the known `Actor is not defined` combat-harness failures by rewriting tests
— treat them as a baseline to report.

Any UI or live-behavior claim must be reported as "not verified here; verify on a real Foundry
installation".

### Git safety

- Run `git status --short` and `git diff` before editing; treat existing changes as the user's work
  and never overwrite, revert, or discard them.
- Do not use `git reset --hard`, `git clean`, `git stash`, or a branch switch that would discard
  work.
- Do not commit, push, force-push, or create branches unless the task explicitly asks.
- Touch only the files the task authorizes.

### Completion report

After all tool calls finish, always send a final response containing:

- What was changed or found, and which files were modified.
- Which rule was implemented or touched, with the canon reference (or the task prompt).
- Validation actually performed and its results, including the test baseline comparison.
- What was not verified — explicitly state that live Foundry/browser verification was not performed.
- Remaining ambiguities, risks, or rules questions.
