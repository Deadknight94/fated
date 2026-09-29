# Fated for Foundry VTT

Fated is a native **Foundry VTT v14** system for physical-dice play. Players use phones/tablets for character bookkeeping and turn declarations; the table resolves dice and fictional outcomes. System ID: `fated`; package version: `0.1.0`; manifest verification target: `14.367`.

The human rules master is the Google Doc **FatedTTRPG Core System Summary**. [docs/FATED_RULES_CANON.md](docs/FATED_RULES_CANON.md) is its local coding-agent snapshot, not a generated description of the implementation. Read it when changing mechanics, and follow [AGENTS.md](AGENTS.md). An implemented behavior is not itself rules authority. This guide describes the code as it currently exists, including gaps noted below.

## Installation and player entry points

Copy this directory to `Data/systems/fated` in Foundry User Data, restart Foundry, and select **Fated** when creating/editing a World. There is no build step or package installation for the system sources.

The desktop Fated sheet remains the default. **Open mobile interface**, or selecting **Fated Mobile Sheet** in sheet configuration, opens Character, Turn, Actions and Items sections. The mobile layout fills phone viewports up to 600px and remains a resizable window on larger screens. Both sheets edit the same Actor Document and use native permissions.

Companion Mode starts after client ready for non-GMs at widths up to 1024 CSS pixels, or touch/coarse-pointer devices whose smaller dimension is at most 1024. Activation persists through rotation for that session. It uses the User's linked Fated character, with a fallback for missing/unsupported/inaccessible characters. Its menu provides character return, Foundry settings, refresh and logout. Local CSS hides the canvas/core interface; shared Scene state is unchanged.

Configure multiple Actions on owned Items. Give each Action an explicit `required` or `none` roll requirement; null means unknown and blocks locking. Blank rule choices remain unspecified. The universal Success Threshold is 4; deviations belong in named modifier arrays. Non-4 legacy thresholds remain visible for review and block affected required-roll declarations rather than being converted automatically.

## Implemented scope

- Fated and simplified NPC Actors; weapon, armor, equipment, weaponProficiency and feature Items. Fated have attributes, skills, arbitrary proficiencies, bounded resources, health/care and declarations. NPCs have attributes, Resilience, editable Defense and notes; the current NPC schema has no Shadow field.
- Endurance maximum is Body + Heart, Hope limits are ±(Mind + Heart), and Power maximum is Body + Heart + Mind. Load sums owned weapons/armor/equipment under the **owned = carried** assumption. Equipped state does not change Load.
- Shared health projections, history-sensitive incapacitation/death handling, manual severity/stabilization/care controls, and GM recorded-death correction. Physical Wound events apply self-Hope loss; manual severity corrections do not.
- Defense uses Body + Mind, current stance and Worn Armor, with minimum 1. Only one Armor may be Worn. A GM damage window previews physical Successes × Damage or manual final Damage and explicitly applies simultaneous Wounds to a Fated target.
- Short/Long/Extended Rest services and a rest window support resource recovery and entered physical Healing successes. Wound-care days and pending Extended Rest healing completion are separate explicit operations. These services do not measure fictional time or roll Healing dice.
- Target-agnostic turn declarations, explicit proposed stance, ordered Main/Free/Power Actions, one Movement segment, Multi-Action, Endurance Push, persistent snapshots and completion checklists. Locking commits current stance, applicable Endurance cost and bandage changes together. Clearing starts from current stance, resets the next spend choice, and neither refunds resources nor follows combat resets.
- Desktop manual Dice/Threshold modifier editing; shared global **Roll Summary** on desktop and mobile. The summary shows a dice delta and Threshold starting at 4, without Action/stance/turn context. Action calculations and planner calculations add their respective context separately.
- Offensive/Defensive/Ranged attack modifiers in declaration evaluation. The desktop stance selector has been removed; the mobile Character selector still edits `currentStance` directly, while the planner proposes a stance and commits it on lock. No start-of-turn timing restriction is enforced by these controls.
- Explicit service APIs for physical Fate Die Hope gain, selected-witness Hope loss, and a single Death's Door drain tick. These are not automatic party, combat or time integrations.

Digital rolls, Power/Shadow dice spending, critical-success generation, a shared world Shadow pool, path/target/LOS/cover adjudication, NPC Wound application, automated health timers and character-creation point-buy enforcement are not implemented. Combat phase/acted flag utilities exist, but their hook integration has a known unresolved reference (see limitations).

## Codebase Architecture

The main dependency flow is:

```text
system.json / fated.mjs (manifest and startup)
    -> Data Models and Foundry Documents (stored schema, lifecycle, derived state)
    -> rules/services (calculations, explicit persistent mutations)
    -> presentation models (labels, localized messages, display breakdowns)
    -> sheet/controllers (form and button events, transient UI state)
    -> Handlebars templates / CSS (rendering and responsive layout)
```

This layering is a **design pattern, not a strict framework boundary**. Data Models call pure services during preparation/validation; controllers call both read helpers and mutation services; some sheet handlers directly update Documents. Dependencies also share schema constants. “Pure” means no input/Document mutation, not necessarily that importing the module requires no Foundry environment: several rule modules transitively import Data Model definitions.

A **Data Model** describes `Actor.system`, `Item.system` or an embedded value. A **Foundry Document** owns identity, permissions, embedded collections and persistence. Action and declaration Data Models are embedded data, not standalone Documents. `prepareDerivedData()` changes the prepared in-memory view; `_preCreate`/`_preUpdate` normalize pending writes. Explicit services call `Actor.update()`/`Item.update()`; UI rendering should not do so.

A **presentation model** is a display projection, not another character store. The localization boundary translates system-owned labels/messages using stable identifiers and **provenance**. Authored names, custom modifier labels, rules text and range units remain verbatim. A locked **snapshot** stores historical execution data; changing an Item, resource or modifier later must not recalculate its saved totals. Snapshot schemas retain only their declared fields, so not every transient calculation annotation survives persistence.

### Startup and core: start with the manifest

| Source | Responsibility and connections |
| --- | --- |
| [system.json](system.json) | Declares v14 compatibility, Actor/Item types and rich-text fields; loads the ES module, stylesheet and EN/IT catalogs. Default grid units are hexes. JSON contains configuration, not hook logic. |
| [fated.mjs](fated.mjs) | Registers Document classes, Data Models, type labels, token resource attributes and sheets on `init`; starts Companion on `ready`. Its static combat import registers hooks during module loading. |
| [module/data-models.mjs](module/data-models.mjs) | Best schema starting point. Actor/Item fields, resource/health lifecycle normalization, Item migration, Action ID validation and one-Worn-Armor validation. Attribute schema defaults are zero; this is not a character-creation wizard. |
| [module/documents.mjs](module/documents.mjs) | Foundry Actor/Item adapters. Exposes available Actions and computes owned-Item Load and Item-aware Defense after base preparation. |
| [module/skills.mjs](module/skills.mjs) | Stored skill keys, attribute associations, English label catalog and grouping order. Does not enforce advancement costs or caps. |
| [styles/fated.css](styles/fated.css) | Shared sheet styles, touch-sized controls, responsive mobile/planner/Item layouts and client-only Companion suppression. It contains no rules calculations. |
| [lang/en.json](lang/en.json), [lang/it.json](lang/it.json) | System-owned UI catalogs consumed by templates, Foundry registration and presentation helpers. Stored IDs and authored content are not translated. |

### Health, resources and damage: start with health.mjs

| Source | Responsibility and connections |
| --- | --- |
| [module/health.mjs](module/health.mjs) | Pure condition/transition/modifier calculations plus explicit Wound, witness, drain and correction services. `healthView()` supplies shared sheet data. `applyWounds()` distinguishes a simultaneous event from a manual correction. |
| [module/wound-care.mjs](module/wound-care.mjs) | Pure severity-compatible care normalization and manual choice list. Shared by health, lifecycle and rest code; does not advance time. |
| [module/resources.mjs](module/resources.mjs) | Pure Hope clamp, owned-Actor ±1 adjustments and explicit Fate Die Hope entry. Power and Endurance bounds differ from Hope bounds. |
| [module/defense.mjs](module/defense.mjs) | Pure sourced Defense breakdown and explicit attack Damage lookup. Rejects multiple Worn Armor; preserves raw and effective Defense. |
| [module/equipment.mjs](module/equipment.mjs) | Armor conflict check, persistent equipped/worn setter and equipment presentation projection. Does not filter Action availability by equipment state. |
| [module/damage.mjs](module/damage.mjs) | Pure preview and explicit application. Adds only caller-supplied final-Damage modifiers; does not automatically add attacker stance Damage. Recomputes before delegating to `applyWounds()`. |

[Health-state bookkeeping](docs/health-state.md) gives additional lifecycle and manual-timing detail. [Defense and physical damage](docs/damage-bookkeeping.md) is historical and contains stale claims about stance Damage and deferred recovery; use the source and this guide for current behavior.

### Actions: start with the embedded schema, then calculation

[module/actions/action-model.mjs](module/actions/action-model.mjs) defines nullable/unknown inputs, stable Action IDs, distinct Dice/Threshold modifier arrays, base Threshold 4, and read-time legacy migration. The migration mutates the supplied source object; it does not issue an Item update. Existing `actions`, including an empty array, take precedence over legacy data.

[module/actions/actions.mjs](module/actions/actions.mjs) discovers detached enabled Actions and adds current Item/Action provenance. **Available means owned and enabled**, not legal for a stance/turn. Dice resolution prefers Item proficiency, then Action skill, then the preserved attribute/fixed fallback. A missing referenced proficiency remains incomplete rather than falling back. Level-zero proficiency produces one die with an untrained annotation. Calculation returns separate base/modifiers/total/complete breakdowns; known dice totals have minimum 1, while Threshold has no floor or ceiling. Nothing rolls dice here.

### Turn declaration: start with service.mjs

| Source | Responsibility and connections |
| --- | --- |
| [module/declaration/service.mjs](module/declaration/service.mjs) | Read/mutation entry point for controllers. Reads snapshots when locked, checks rendered revisions, and commits declaration plus lock effects in one Actor update. |
| [module/declaration/evaluate.mjs](module/declaration/evaluate.mjs) | Pure draft edits, legality evaluation, stance modifiers and detached lock snapshot construction. Main count fixes Multi-Action; no-roll Actions skip numeric completeness and unknown roll requirements block locking. |
| [module/declaration/endurance-push.mjs](module/declaration/endurance-push.mjs) | Pure validation and projected post-cost conditions. Suppresses only the remaining system Wound/care penalty, preserving unrelated/manual modifiers and their provenance. |
| [module/declaration/data-model.mjs](module/declaration/data-model.mjs) | Draft/snapshot/checklist schema and structural validation. Locked status requires a snapshot; completed IDs must identify locked entries. |

Endurance Push previews the resources after spending before testing incapacitation. Locking saves the resulting calculation and charges once. For a bandaged Grievous Fated declaring Multi-Action, the snapshot retains the bandage benefit, while stored care is cleared in the lock update. Completion toggles do not resolve Actions, recalculate the original Main count or charge again. Revision checks and UI guards are local protections, not server-side serialization of simultaneous clients.

### Rest: start with RestApp for the UI, short-rest.mjs for a service

[module/apps/rest-app.mjs](module/apps/rest-app.mjs) maintains transient form strings and a per-window pending guard. It registers in `Actor.apps` for native rerenders and reuses an existing rest window. Blank Healing input is omitted; invalid numeric input is rejected by the services.

| Source | Explicit operation |
| --- | --- |
| [module/rest/short-rest.mjs](module/rest/short-rest.mjs) | Recover Endurance, optionally spend Hope for extra recovery, recover stabilized Death's Door, or bandage using supplied Healing successes. Validates before a combined Actor update. |
| [module/rest/long-rest.mjs](module/rest/long-rest.mjs) | Recover Body Endurance and one Hope, reset Power, optionally heal Light or treat Grievous Wounds. |
| [module/rest/extended-rest.mjs](module/rest/extended-rest.mjs) | Separate beginning (Power reset), completed day (recovery/Light healing/optional pending Grievous healing), and explicit pending-healing completion. |
| [module/rest/wound-care-day.mjs](module/rest/wound-care-day.mjs) | Advance one confirmed fictional day of care; expire ordinary care at zero, preserve pending Grievous care for separate completion. |

Accepted no-op rests can return `true` without a Document write. Rest services check terminal Wound severity; they do not clear a separately recorded death flag or implement resurrection. Fictional duration and eligibility remain table/caller responsibilities.

### Presentation: start with labels.mjs

| Source | Display boundary |
| --- | --- |
| [module/presentation/labels.mjs](module/presentation/labels.mjs) | Localized health, equipment, skills, Defense and declaration issue projections. Modifier translation is authorized by system provenance; authored labels survive unchanged. |
| [module/presentation/text.mjs](module/presentation/text.mjs) | English system-text/key catalog, interpolation and recognition of complete service errors. Unknown messages pass through; the optional i18n parameter supports tests. |
| [module/presentation/roll-summary.mjs](module/presentation/roll-summary.mjs) | Shared global Dice delta and Threshold summary, excluding Item and turn context. |
| [module/presentation/sheet-mixin.mjs](module/presentation/sheet-mixin.mjs) | Adapts recognized Foundry form validation errors for display, retaining the original error as cause. Does not change validation rules. |

### Sheets/controllers: start with mobile-sheet.mjs

| Source | UI responsibilities and mutation route |
| --- | --- |
| [module/sheets/mobile-sheet.mjs](module/sheets/mobile-sheet.mjs) | Four-section player controller and Companion base. Builds live Action cards and draft/locked planner rows; delegates resource, health and declaration operations. Keeps scroll/details/navigation local. |
| [module/sheets/actor-sheets.mjs](module/sheets/actor-sheets.mjs) | Desktop Fated and NPC controllers. Shared Item display/forms; Fated health/rest/damage/manual controls; NPC stats/actions/items/notes without Fated planner mechanics. |
| [module/sheets/item-sheet.mjs](module/sheets/item-sheet.mjs) | Item/Action authoring. Submits pending form values before editing a detached Action array and replacing `system.actions` through Item.update(). |
| [module/sheets/action-form.mjs](module/sheets/action-form.mjs) | Pure indexed-form merge preserving sibling Actions, legacy Threshold and unspecified values. |
| [module/sheets/health-controls.mjs](module/sheets/health-controls.mjs) | Shared bound-sheet health event handler; local pending guard and localized errors, with Actor writes delegated to health services. |
| [module/sheets/equipment-controls.mjs](module/sheets/equipment-controls.mjs) | Resolve the owned Item from a button and delegate equipped/worn changes to the equipment service. |
| [module/sheets/manual-modifier-controls.mjs](module/sheets/manual-modifier-controls.mjs) | Per-Actor promise queue for full-array replacement by stable modifier ID. Prevents local overlapping edits from overwriting siblings. |
| [module/sheets/proficiency-controls.mjs](module/sheets/proficiency-controls.mjs) | GM key rename across Actor proficiencies and matching embedded Item references, with attempted rollback. Protects keys from ordinary form submissions and preserves expanded rows. Separate writes are not a transaction. |
| [module/sheets/damage-bookkeeping.mjs](module/sheets/damage-bookkeeping.mjs) | Target-centric GM preview/apply controller. Rechecks current inputs/state, requires renewed review if changed, and consumes a successful preview to prevent repeated application. |

### Companion, combat and helpers

Start with [module/companion-state.mjs](module/companion-state.mjs) for read-only viewport/linked-character selection, then [module/companion.mjs](module/companion.mjs) for the DOM shell, menu, hook lifecycle and serialized refresh queue. OBSERVER access allows selection without granting Actor ownership. Companion is a client presentation mode, not a second Actor store.

Start combat reading at [module/combat/phase.mjs](module/combat/phase.mjs): synchronous flag getters and async commands use Combat/Combatant flags for player/adversary phase and acted state. [module/combat/hooks.mjs](module/combat/hooks.mjs) registers `updateCombat` and filters to originating-client round changes. It currently references an undefined/unimported `isManagedRoundAdvance`; do not assume the reset path works. These modules do not reset declarations, enforce initiative or schedule health effects.

[Proficiency key helpers](module/helpers/proficiency-keys.mjs) are the starting point for identifier normalization and exact duplicate checks. [Dice source labels](module/helpers/dice-source-label.mjs) format calculation provenance for cards/planner rows; they do not consult live Actor values to reconstruct missing provenance. Both leave persistence to their consumers.

### Templates and styles

Start with [templates/actor/mobile-sheet.hbs](templates/actor/mobile-sheet.hbs) and its controller's `_prepareContext()`. Handlebars templates render supplied presentation models, localize fixed catalog keys and expose `data-action`/`data-*` controls for Foundry handlers. They do not own rule calculations or Document writes. Shared partials keep desktop/mobile views aligned:

- [health-state.hbs](templates/actor/health-state.hbs): Wound/care labels, manual controls and condition/reminder text. Numeric roll modifiers are shown in Roll Summary.
- [defense.hbs](templates/actor/defense.hbs): base, sourced modifiers, raw and effective Defense.
- [turn-planner.hbs](templates/actor/turn-planner.hbs): draft choices/issues and locked physical-dice instructions/checklist, with the rendered revision attached to controls.

[Desktop Fated](templates/actor/fated-sheet.hbs) and [NPC](templates/actor/npc-sheet.hbs) are separate layouts. [Rest](templates/actor/rest-app.hbs), [damage bookkeeping](templates/actor/damage-bookkeeping.hbs) and [Companion fallback](templates/companion-fallback.hbs) serve auxiliary controllers. [Item sheet](templates/item/item-sheet.hbs) includes the [Action editor](templates/item/action-editor.hbs). [styles/fated.css](styles/fated.css) supplies responsiveness, scrolling, touch targets and local Companion visibility.

### Tests and supporting documentation

Start with [tests/actions.test.mjs](tests/actions.test.mjs) for schemas/calculations and [tests/declaration.test.mjs](tests/declaration.test.mjs) for draft/lock invariants. Node tests exercise much of the rules and presentation logic **without launching Foundry**, but many load its installed common Data Model runtime. UI-focused tests use stubs such as [tests/helpers/client-applications.mjs](tests/helpers/client-applications.mjs), not a real browser.

[Health tests](tests/health.test.mjs), [damage tests](tests/damage.test.mjs), [Endurance Push tests](tests/endurance-push.test.mjs), [character modifier tests](tests/character-roll-modifiers.test.mjs), and the rest/wound-care/resource test families cover boundary cases, update payloads and no-mutation rejection. [Localization tests](tests/localization.test.mjs) check catalogs and presentation/template behavior. [Combat phase tests](tests/combat-phase.test.mjs) have a known six-test harness baseline failure (`Actor is not defined`). Headless success does not establish live Foundry synchronization, layout or touch usability.

[docs/actions-mobile.md](docs/actions-mobile.md) records earlier Action/planner milestones and smoke-test procedures; its older deferral, language and NPC Shadow statements are historical. [docs/character-roll-modifiers.md](docs/character-roll-modifiers.md) describes global modifiers/care, while [docs/LOCALIZATION_AUDIT.md](docs/LOCALIZATION_AUDIT.md) records the earlier EN/IT audit and its test results. Those reports are not evidence of a new live browser test.

## Concrete flows

### Example: Rendering Health

`Actor.system -> healthView() -> localizedHealth() -> sheet _prepareContext() -> health-state.hbs`

The desktop/mobile controller calls `healthView()` to derive current health, care choices and editability. `localizedHealth()` creates display labels and care descriptions. `_prepareContext()` exposes that result as `healthState` for the shared partial. This entire read path leaves stored data unchanged; `rollSummary()` separately provides the numeric global modifiers.

### Example: Applying Damage

`DamageBookkeeping -> previewDamage() -> applyDamage() -> applyWounds() -> Actor.update() -> FatedDataModel lifecycle`

The GM enters physical Successes for an available attack or manual final Damage. Preview calculates current Defense, simultaneous Wounds and treatment reopening. On Apply, the controller recomputes the preview and asks for another review if it changed; the service also recalculates before applying. `applyWounds()` combines severity, applicable self-Hope loss and reopened care in one update. Before persistence, `_preUpdate()` clamps/normalizes the proposed state and checks historical incapacitation. Preparation then rebuilds the view. Zero-Wound applications do not write; witnesses are a separate explicit API.

### Example: Resolving an Action

`Item Action -> getActorActions() -> calculateActorAction() -> calculateActionFromActorData() -> calculateAction() -> presentation breakdown`

Here “resolving” means calculating **physical-dice instructions**, not rolling or applying an outcome. `getActorActions()` calls each Item's adapter to get detached enabled Actions and provenance. `calculateActorAction()` adds Actor-wide health/manual modifiers. Source resolution selects proficiency/skill/fallback; `calculateAction()` computes Dice and Threshold separately. The mobile controller uses `formatDiceSourceLabel()` and its local `breakdownView()` to render the result. Turn-specific stance/Multi-Action/Endurance Push effects enter through declaration evaluation instead of the ordinary Action-card calculation.

### Example: Locking a Turn

`mobile planner handler -> updateDeclaration() -> endurancePushContext() -> lockDeclaration()/evaluateDeclaration() -> Actor.update() -> saved snapshot`

The handler sends the revision rendered in the planner. The service checks ownership/revision and projects Endurance cost, including possible Overburdened/Exhausted/Broken state. Evaluation combines those global modifiers with proposed stance and original Main-count Multi-Action, rejecting illegal/incomplete drafts. Locking deep-copies the Action/calculation data; the service persists that declaration together with current stance, cost and applicable bandage break. The embedded schema retains its defined snapshot fields. Later reads use the saved values; checklist toggles update completion IDs without resolving Actions or changing the historical penalty.

## Suggested Reading Order

1. [system.json](system.json): what Foundry loads and which types exist.
2. [fated.mjs](fated.mjs): registration and lifecycle entry points.
3. [module/data-models.mjs](module/data-models.mjs): stored schema and validation.
4. [module/documents.mjs](module/documents.mjs): Document adapters and Item-aware derived values.
5. [module/actions/action-model.mjs](module/actions/action-model.mjs): embedded Action shape and unknown values.
6. [module/actions/actions.mjs](module/actions/actions.mjs): availability, calculation and provenance.
7. [module/health.mjs](module/health.mjs): conditions, modifiers and persistent Wound events.
8. [module/declaration/](module/declaration/): service, evaluator, Endurance Push and snapshot schema.
9. [module/presentation/](module/presentation/): localization and read-only display projections.
10. [module/sheets/](module/sheets/): event handlers and presentation assembly.
11. [templates/](templates/): trace context keys to rendered controls; consult CSS alongside them.
12. [tests/](tests/): normal, boundary and rejected-operation examples for each subsystem.

## Running checks

Use Node with Foundry installed. On the current Windows development machine:

```powershell
$env:FOUNDRY_APP_PATH = "E:\Program Files\FoundryVTT\Foundry Virtual Tabletop\resources\app"
node --test
node --check fated.mjs
Get-ChildItem module -Recurse -Filter *.mjs | ForEach-Object { node --check $_.FullName }
git diff --check
```

The known six combat harness failures should be reported rather than hidden or treated as passing. Live Foundry/browser checks are separate from syntax and Node tests.

## Known implementation/documentation differences

These observations describe the current sources; they do not resolve rules questions or authorize mechanics changes.

- The canon starts primary attributes at 2, whereas schema defaults are 0. There is no creation-budget workflow to build a finished character automatically.
- The canon says Equipment Actions do not directly use Attributes. The schema/editor and calculation fallback still support explicit attribute/fixed sources; missing referenced proficiencies remain incomplete.
- Bandage rules describe loss after Multi-Action. The service clears stored care at lock while keeping its benefit in the frozen turn. Live Actor summaries therefore change before the checklist is completed.
- Treated-care UI text says a damage instance does not increase severity. `projectWounds()` absorbs only the first Wound and applies remaining simultaneous Wounds, consistent with its tests; this wording difference is not corrected here.
- General exhausted-Endurance-loss conversion is not implemented by manual `adjustResource()`. The explicit Death's Door tick does select Hope when already Exhausted; other callers must not assume that behavior is universal.
- Snapshot calculation schema stores bases/totals/modifiers but omits transient `sourceProvenance` and `untrained` annotations. Source labels can therefore be unspecified in persisted locked rows even though numeric instructions remain frozen.
- The older damage guide describes automatic stance Damage adjustments and defers features that now exist. Current code/tests apply stance to Defense and declaration dice/Threshold, not automatically to Damage. Older Action docs also predate the one-die minimum, stance implementation and localization; the NPC schema no longer supplies the Shadow field they mention.
- Both Add Proficiency handlers still reference an undefined `dialog` after updating the Actor. Combat round synchronization still references undefined/unimported `isManagedRoundAdvance`. These existing runtime issues are distinct from the six combat test harness failures and remain unfixed in this documentation pass.
