# Fated — Codex Instructions

## Windows Tooling Rules

This repository is developed on Windows and paths may contain spaces.

- Quote file and directory paths correctly.
- Use `fd` only with directory search roots.
- Never pass a file path as the search root to `fd`.
- To search inside a known file, use `rg <pattern> <file>`.
- To read a known file, use `Get-Content <file>` or the available file-read tool.
- If a command fails because of an invalid path/tool invocation, correct the command rather than repeating it.
- Prefer repository-relative paths when practical.

### Known Pi Web tooling issue

Pi Web may incorrectly invoke `fd` with a known file path as the search root.

- If the exact file path is already known, do not use `fd` at all.
- Read the file directly.
- Use `rg <pattern> <file>` when searching within a known file.
- If `fd` reports that the search path is not a directory, do not retry `fd` for that file; continue with a direct read.

## Completion response

After completing any task that uses tools, you MUST send a final assistant response to the user.

A task is not complete when the last tool call finishes. After all tool calls and verification are complete, produce a normal chat response.

The final response must contain:
- what was changed or found;
- files modified, if any;
- verification actually performed and its result;
- anything not verified or still uncertain.

Do not end the turn immediately after a tool call.
Do not use a shell command, file, or tool output as a substitute for the final assistant response.
If the user specifies a report format, follow that format in the final assistant response.

## Local Foundry Test Environment

On the current Windows development machine:

`FOUNDRY_APP_PATH=E:\Program Files\FoundryVTT\Foundry Virtual Tabletop\resources\app`

Foundry-dependent Node tests require this environment variable.

PowerShell example:

```powershell
$env:FOUNDRY_APP_PATH = "E:\Program Files\FoundryVTT\Foundry Virtual Tabletop\resources\app"
node --test
```

## Project

Fated is a custom tabletop RPG system implemented as a native **Foundry VTT v14 game system**.

This repository contains the implementation of the Fated ruleset for Foundry VTT.

The purpose of this repository is to implement the existing game design faithfully, not to redesign the game.

\---

## Rules Authority

The human-authoritative Fated rules are maintained in the Google Doc
“FatedTTRPG Core System Summary”.

A repository snapshot is stored at:

docs/FATED_RULES_CANON.md

For implementation and code review:

- Read `docs/FATED_RULES_CANON.md` when game rules are relevant.
- Do not invent, reinterpret, or silently complete rules.
- Rules marked TBD are not implementation requirements unless the task explicitly says otherwise.
- A task prompt may restate a narrow subset of the rules for the current change.
- If the task prompt conflicts with `docs/FATED_RULES_CANON.md`, stop and report the conflict.
- If required behavior is absent or genuinely ambiguous, report the ambiguity instead of choosing a rule.
- The Google Doc remains the human master copy; `docs/FATED_RULES_CANON.md` is the coding-agent snapshot.

## Source of Truth

Game rules are defined outside the codebase.

The authoritative sources are:

1. The Fated rules documents.
2. Decisions made in the **Fated — Rules \& Playtesting** ChatGPT conversation.
3. Explicit implementation decisions provided by the project owner.

Code is not authoritative for game rules.

If the current implementation conflicts with an authoritative rule, the implementation should be corrected.

If a rule required for implementation is ambiguous or missing:

* do not invent a new mechanic;
* do not silently choose a conventional RPG solution;
* clearly identify the ambiguity;
* describe what implementation decision is blocked;
* request a rules/design decision.

Minor technical implementation choices that do not alter gameplay may be made normally.

\---

## Platform

Target platform:

* Foundry Virtual Tabletop v14
* Native Foundry game system
* System ID: `fated`

Use current Foundry v14 APIs and patterns.

Prefer modern Foundry APIs, including ApplicationV2-based sheets and System DataModels, rather than legacy APIs where a supported v14 replacement exists.

Do not introduce compatibility code for old Foundry versions unless explicitly requested.

\---

## Design Priorities

When making implementation decisions, use this priority order:

1. Faithful rules implementation
2. Reliable and predictable behavior
3. Maintainable architecture
4. Low bookkeeping for players and GM
5. Tablet and mobile usability
6. Visual polish

Avoid unnecessary abstractions and premature complexity.

This is initially a playtest system. Prefer clear, inspectable implementations over highly generalized frameworks.

\---

## Rules Philosophy

Fated intentionally has a number of unusual mechanics.

Do not replace them with standard D\&D, Pathfinder, SWADE, or other RPG conventions merely because those conventions are easier to implement.

Examples include:

* Fated-specific dice pools
* the Fate Die
* Hope
* Endurance
* Load
* Power
* Shadow
* turn declaration
* locked Multi-Action penalties
* stance restrictions
* binary cover
* simplified GM-side adversaries

Implement the Fated rules as written.

\---

## Actor Types

The initial Actor types are:

### `fated`

Used for player Fated and Fated adversaries.

A Fated adversary remains mechanically a Fated Actor. Do not create a duplicate adversary Actor type merely because the GM controls it.

Core Fated fields include:

* Heart
* Body
* Mind
* Endurance
* Hope
* Hope Limit
* Load
* Power
* wounds / incapacitation state as later implemented
* stance as later implemented

Derived values should generally be calculated rather than redundantly stored where practical.

Current core derived rules include:

* Maximum Endurance = Body + Heart
* Hope Limit = Mind + Heart
* Current Hope is bounded from -Hope Limit to +Hope Limit.
* Load is derived from carried equipment/items where applicable

### `npc`

Used for non-Fated adversaries and other simplified NPCs.

NPC mechanics should remain deliberately simpler than Fated mechanics.

Core NPC resources include:

* Resilience
* Shadow

Anything that would normally affect a Fated's Hope, Endurance, or Load may instead interact with NPC Resilience according to the established rules.

Do not automatically give NPCs Fated mechanics such as stances, Fate Dice, or the standard Fated action economy unless an explicit rule says they receive them.

\---

## Item Types

Initial Item types include:

* `weapon`
* `armor`
* `equipment`
* `weaponProficiency`
* `feature`

Additional Item types may be introduced only when they solve a real rules or UX requirement.

Avoid creating separate Item types solely for organizational convenience when a field or subtype is sufficient.

\---

## Actions

Objects may provide actions.

Actions should eventually support enough structured data for Foundry to determine things such as:

* action type
* Success Dice source
* melee or ranged use
* range
* damage
* stance restrictions
* target requirements
* special rules
* Power interaction
* whether the action may participate in Multi-Action

Do not hard-code individual weapon behavior into the central dice engine if it can reasonably be represented by Item data.

\---

## Fated Combat

Important currently locked rules include the following.

### Turn sequence

A Fated turn follows this broad structure:

1. stance decision/change;
2. declaration;
3. resolution.

At the start of the actor's turn, the actor declares:

* movement;
* exact movement path where relevant;
* Main Actions;
* Free Actions;
* action order;
* targets where applicable;
* Power Actions where applicable.

Declared choices are normally locked for that turn.

### Movement

Default Fated movement is 3 hexes unless modified by a rule.

Movement is one continuous segment.

It may occur:

* before all Main Actions;
* between Main Actions;
* after all Main Actions.

It may not be split into multiple movement segments.

The declared path is locked.

If a declared path becomes impossible during resolution:

* move along the declared path as far as legally possible;
* stop at the last legal hex;
* lose the remaining movement;
* do not reroute.

A Fated may move through allied creatures.

A Fated may not move through enemy creatures.

A Fated may never end movement in an occupied hex.

For the initial ruleset, terrain is binary:

* passable at normal movement cost; or
* impassable.

Do not implement universal difficult-terrain movement costs unless later added to the rules.

### Multi-Action

A Fated may declare up to 3 Main Actions.

Current Multi-Action penalties:

* 1 Main Action: no penalty
* 2 Main Actions: +1 Success Threshold to both
* 3 Main Actions: +2 Success Threshold to all three

The Multi-Action penalty is determined when actions are declared.

It remains based on the original number of declared Main Actions even if an action is later lost or voluntarily abandoned.

A declared action may be voluntarily abandoned, but:

* it is lost;
* it cannot be replaced;
* it cannot be retargeted;
* the original Multi-Action penalty remains.

If a declared action becomes impossible because an earlier declared action changes the situation, that action is lost.

Example:

If the same target is attacked three times and dies after the second attack, the third attack is lost.

### Power Actions

A Power Action must be declared at the beginning of the Fated's turn.

A Fated may perform at most one Power Action per turn.

If a Power Action is declared, it is the Fated's only Main Action for that turn.

The Fated may still use declared movement and Free Actions.

Spending Power to add Power Dice to an ordinary roll is not itself a Power Action.

The amount of Power spent to add Power Dice to an ordinary action is chosen immediately before that roll.

\---

## Fate Die

Only Fated roll the Fate Die.

Whenever a Fated makes a Dice Roll containing Success Dice, the Fate Die is rolled alongside them according to the established rules.

Non-Fated NPCs do not roll the Fate Die unless a later explicit rule creates an exception.

Do not merge the Fate Die into the ordinary Success Dice pool internally if doing so would make its distinct results or resource effects difficult to track.

\---

## Cover and Line of Sight

Cover is binary in the initial ruleset.

A target either:

* has Total Cover and cannot be targeted; or
* has no cover.

There are no universal partial-cover modifiers.

Creatures do not currently provide cover and do not block line of sight.

A possible future rule may allow an adjacent creature of the same or larger size to provide cover, but this is not currently active and must not be implemented yet.

\---

## Stances

Fated use stances.

Initial stances are:

* Neutral
* Offensive
* Defensive
* Ranged

Every Fated begins combat in Neutral unless a specific rule says otherwise.

Stance changes occur only at the start of the Fated's own turn and are free.

Stance restrictions affect available Item Actions.

Do not guess exact modifiers or restrictions from this file if they are not recorded here. Consult the rules source before implementing or changing stance math.

Non-Fated NPCs do not automatically use stances.

\---

## Power and Shadow

Fated use Power.

Power begins at 0.

Power generation is governed by the established critical-success/Fate rules.

Power resets according to the established rest rules.

NPC/adversary equivalent resource:

* Shadow

Shadow has no cap and does not reset unless a future rule states otherwise.

Do not make Power and Shadow mechanically identical simply for code reuse if their rules differ.

Shared implementation utilities are encouraged, but the gameplay behavior must remain distinct.

\---

## Incapacitation

The rules distinguish multiple incapacitated states, including:

* Death's Door
* Broken

These are related but not interchangeable.

A Fated that meets an incapacitation condition while already incapacitated dies according to the established rules.

Do not collapse all incapacitation into a single boolean if doing so prevents the rules from distinguishing causes, recovery, or consequences.

\---

## Sheets and UX

The system is intended to work well on:

* desktop;
* tablet;
* phone.

Mobile/tablet play is a core requirement, not an optional later feature.

Prefer:

* large touch targets;
* concise interaction flows;
* minimal modal nesting;
* clear resource displays;
* actions reachable without excessive scrolling;
* layouts that adapt gracefully to narrow screens.

Avoid desktop-only hover interactions for essential functionality.

The overall usability target is similar to a clean mobile-focused Foundry interface such as Swipe, without copying its implementation.

\---

## Automation Philosophy

Automate bookkeeping where the rule is unambiguous.

Examples of good automation include:

* derived values;
* dice pool construction;
* Fate Die inclusion;
* threshold modifiers;
* resource changes;
* stance validation;
* action availability;
* damage accumulation;
* wounds;
* turn declaration state.

Do not automate ambiguous judgment calls that belong to the GM.

Power Actions in particular may involve creative GM adjudication and should not be forced into an overly rigid rules engine.

\---

## Coding Standards

Use readable, modular JavaScript.

Prefer ES modules.

Use descriptive names matching game terminology.

Avoid abbreviations unless they are well-established project terms.

Keep rules calculations in dedicated reusable functions or services rather than duplicating them across sheets and chat handlers.

Separate:

* stored data;
* derived data;
* dice/rules logic;
* sheet/UI behavior;
* chat rendering;
* combat automation.

Do not place significant game logic directly inside Handlebars templates.

Avoid global state where Foundry documents or scoped services can represent the state safely.

\---

## Data Model Rules

Use Foundry System DataModels for structured Actor and Item system data.

Validate fields where practical.

Derived values should not be independently editable unless the rules specifically require them to be.

Migration support should be added once stored schemas begin changing between released versions.

Until then, keep schema changes deliberate and documented.

\---

## Testing

For every substantive mechanics implementation:

1. identify the relevant rule;
2. test the normal case;
3. test the minimum/boundary case;
4. test a relevant invalid case;
5. ensure no unintended resource or document changes occur.

Where possible, isolate pure rules calculations into functions that can be tested outside Foundry UI code.

Do not rely solely on manually clicking through sheets for rules validation.

\---

## Development Workflow

Prefer small, reviewable changes.

Before making broad refactors:

* inspect the existing implementation;
* explain why the refactor is necessary;
* preserve current behavior unless explicitly changing it.

For significant changes, summarize:

* what changed;
* which files changed;
* which rule it implements;
* what was tested;
* any unresolved rules questions.

Do not combine unrelated mechanics and UI redesign work into one large change without a clear reason.

\---

## First In-Person Playtest Priorities

Physical dice are the primary play method. Do not build digital dice rolling unless specifically requested later. The TV displays the battlemap with physical miniatures; players use phones, tablets, and iPads.

The player interface must be mobile-first and touch-friendly. No essential interaction may depend on hover, Foundry sidebars, or canvas/token controls.

The future Turn Declaration Planner is target-agnostic. It will declare stance and an ordered sequence of Main Actions, one optional continuous Movement segment, and Free Actions. Targets are not selected or stored by the planner. This overrides earlier target/path requirements for the planner's implementation scope, without changing the tabletop rules.

As Actions are added or removed, final Success Dice and Success Threshold values must be recalculable from all applicable modifiers. Dice-pool modifiers and Success-Threshold modifiers are distinct and must remain separately traceable. Once a turn is locked, the eventual planner will show the ordered Actions and exact physical dice instructions for each Action.

The Action/mobile foundation is accepted. The current milestone adds the first target-agnostic Turn Declaration Planner: explicit stance selection, ordered Main/Free/Power Actions and one optional Movement segment, the established Multi-Action Threshold modifier, determinable legality, persistent locking and an execution checklist. Locked values must remain independent of subsequent Item/Actor changes. Clearing preserves the selected stance and current resources; there is no combat-triggered reset.

Actions explicitly declare `rollRequirement`: `required`, `none`, or unspecified/null. Required rolls need complete Success Dice and Threshold values before locking; no-roll Actions do not. Unspecified requirements block locking. Never infer a requirement from missing dice data or legacy numeric defaults.

Do not add targets, paths, positions, digital dice, Power Dice spending, resolution, damage/wounds, situational map legality, combat automation or an NPC planner. Only existing configured modifiers and the established Multi-Action Threshold modifier apply. Unknown required legality data must be shown as incomplete, not guessed.

The following historical sequence is superseded by these playtest priorities; deferred systems require explicit authorization:

1. Foundry v14 scaffold and DataModels
2. Basic Fated and NPC sheets
3. Success Dice and Fate Die roll engine
4. Item Actions
5. Power and Fate resource handling
6. Stances
7. Turn declaration and Multi-Action
8. Damage and Wounds
9. Incapacitation
10. NPC/Resilience/Shadow automation
11. Combat workflow integration
12. Mobile/tablet UX refinement
13. Playtest-driven improvements

This order may change when implementation dependencies require it.

\---

## Current Development Rule

Do not implement new gameplay mechanics merely because they would make the Foundry system more complete.

When a missing rule does not block the current milestone, leave it unimplemented and note it for later.

When a missing rule does block implementation, flag it for rules review.

Playtesting is expected to reveal rules that require revision.

The Foundry implementation should make those revisions reasonably easy to apply.
