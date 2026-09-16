# Fated health bookkeeping

Target: Foundry VTT 14.367. This milestone does not calculate attack damage or automate recovery/timed effects.

## Actor schema and derived conditions

`system.health` stores `woundSeverity` (integer 0–4, default 0), `stabilized` (boolean, default false), and `dead` (boolean, default false). Severity 4 is the terminal representation of 4+ Wounds. Recorded death remains after Wounds/resources change. The GM-only administrative correction control is bookkeeping, not resurrection; severity 4 still means Dead regardless of the flag.

`module/health.mjs` derives Healthy/Light/Grievous/Death's Door/Dead, Overburdened, Exhausted, Inspired, Despondent, Broken and Incapacitated from the Actor's actual attributes/resources/Load/health. It accepts prepared or stored source data and uses current resource bounds when comparing transition states. Conditions are not stored toggles. Load retains the owned=carried assumption.

## Modifier and planner integration

The Actor-state modifier provider returns separate labelled Threshold entries with Actor and condition provenance: Light +1, Grievous +2, Overburdened +1, Exhausted +1, Inspired −1, Despondent +1. There is no wound modifier for severity 3/4. Actor Action cards and editable declarations use this provider, while the existing universal base 4, Action modifiers and Multi-Action remain separate. Locking freezes the full calculation/modifier breakdown as before.

An Incapacitated or Dead Actor cannot lock a normal declaration. Editing and existing snapshots are preserved; clearing remains allowed. Both the declaration service/evaluator and TypeDataModel pre-update lifecycle check locking. Existing locked snapshots are not recalculated after health changes.

## Transition history and stabilization

TypeDataModel pre-update compares current source conditions with the proposed update after Hope correction. A newly reached Death's Door or Broken requirement while already Incapacitated records death in the same Actor update. Remaining continuously in the same condition is not a new entry. Death is not derived just because both causes are currently true. No updates are issued from preparation, and no recursive document updates are used.

Simultaneous first entry into both causes from a previously non-incapacitated state causes Incapacitation from both without death. If either cause resolves and is subsequently met again while the other still keeps the Fated Incapacitated, death is recorded. Client lifecycle comparisons cannot establish a reliable ordering for stale/concurrent client updates; no ordering is invented.

Entering severity 3 starts unstabilized, including creation. Subsequent manual stabilization persists at 3, leaves Incapacitation intact, and changes no resources. Leaving severity 3 clears stabilization; reentry starts unstabilized.

Inspired and Despondent require Hope Limit greater than zero. At Hope Limit zero, Hope 0 causes neither condition; Endurance 0 still causes Exhausted but not Broken.

## UI, permissions and deferred rules

Companion and desktop share the health partial and handler. Wound −1/+1 and stabilization use real Actor updates and native editing permissions; observer controls are disabled and the service rejects non-owners. GM administrative death correction is additionally restricted in the update lifecycle. NPC sheets receive no health UI or mechanics.

Broken reminders: Incapacitated until either component ends; no Death's Door drain from Broken itself; lose 1 Power at round end, minimum 0; Body days continuously Broken causes death. Death's Door reminders: unstabilized loses 1 Endurance and 1 Hope per combat round/hour outside combat, with exhausted Endurance loss becoming an additional Hope loss (total −2 Hope). Stabilization stops this drain, without changing severity or Incapacitation.

All drains/timers/duration death are manual reminders. Damage/Defense comparison, automatic wounds, bandaging/treatment, Healing rolls, rest recovery, temporary acting exceptions, digital dice, combat automation and resurrection remain deferred.

## Verification

Automated tests use Foundry's actual common DataModels and exercise severity mapping, conditions, cumulative/provenance-preserving modifiers, stabilization, both second-incapacitation directions, persistent death/GM corrections, simultaneous first entry, snapshot preservation and permissions. Existing Action, declaration, Companion and resource tests remain included.

Live smoke-world checks exercise wound controls, labelled modifiers/Multi-Action, all derived resource conditions, Broken resolution, stabilization/refresh, both sequential death directions, planner blocking/snapshot preservation, native document synchronization and representative phone/tablet viewports. Physical-device Safari and live observer permission testing remain separate device/account checks.
