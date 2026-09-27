# Fated health bookkeeping

Target: Foundry VTT 14.367. Health bookkeeping integrates with physical damage entry and recovery services; elapsed-time effects require explicit calls.

## Actor schema and derived conditions

`system.health` stores `woundSeverity` (integer 0–4, default 0), `stabilized` (boolean, default false), and `dead` (boolean, default false). Severity 4 is the terminal representation of 4+ Wounds. Recorded death remains after Wounds/resources change. The GM-only administrative correction control is bookkeeping, not resurrection; severity 4 still means Dead regardless of the flag.

`module/health.mjs` derives Healthy/Light/Grievous/Death's Door/Dead, Overburdened, Exhausted, Inspired, Despondent, Broken and Incapacitated from the Actor's actual attributes/resources/Load/health. It accepts prepared or stored source data and uses current resource bounds when comparing transition states. Conditions are not stored toggles. Load retains the owned=carried assumption.

## Modifier and planner integration

The Turn Planner persists integer `system.declaration.enduranceSpend` (0–2, default 0) and copies it into the locked snapshot. The choice is turn-wide. Availability is capped by current Endurance and the remaining Wound penalty after wound care; it cannot cancel unrelated modifiers. The traceable “Endurance Push” contribution offsets only that bounded Wound contribution.

Editing and rendering are free. The declaration evaluator checks the choice against current resources and wounds; the service previews post-spend Overburdened, Exhausted and incapacitation conditions. Locking validates all entries before writing the cost and snapshot in one Actor update, alongside existing stance/bandage changes. If spending would make the Actor Broken, locking is rejected without spending. Bandage benefits remain in the snapshot and break afterward as before. Completing entries never charges again. End/Clear resets the next choice to 0 without refunding Endurance. Later Actor changes do not recalculate locked turns.

The mobile planner provides localized 0/1/2 buttons and a read-only locked amount. No persistent Actor suppression condition, combat tracker, drain scheduler or witness automation is added. Like existing declaration revisions, this service prevents stale rendered controls but does not add server-side serialization of simultaneous clients.

The Actor-state modifier provider returns separate labelled Threshold entries with Actor and condition provenance: Light +1, Grievous +2, Overburdened +1, Exhausted +1, one Hope entry (positive Hope −1, Inspired −2, Despondent +1). There is no wound modifier for severity 3/4. Actor Action cards and editable declarations use this provider, while the existing universal base 4, Action modifiers and Multi-Action remain separate. Locking freezes the full calculation/modifier breakdown as before.

An Incapacitated or Dead Actor cannot lock a normal declaration. Editing and existing snapshots are preserved; clearing remains allowed. Both the declaration service/evaluator and TypeDataModel pre-update lifecycle check locking. Existing locked snapshots are not recalculated after health changes.

## Transition history and stabilization

TypeDataModel pre-update compares current source conditions with the proposed update after Hope correction. A newly reached Death's Door or Broken requirement while already Incapacitated records death in the same Actor update. Remaining continuously in the same condition is not a new entry. Death is not derived just because both causes are currently true. No updates are issued from preparation, and no recursive document updates are used.

Simultaneous first entry into both causes from a previously non-incapacitated state causes Incapacitation from both without death. If either cause resolves and is subsequently met again while the other still keeps the Fated Incapacitated, death is recorded. Client lifecycle comparisons cannot establish a reliable ordering for stale/concurrent client updates; no ordering is invented.

Entering severity 3 starts unstabilized, including creation. Subsequent manual stabilization persists at 3, leaves Incapacitation intact, and changes no resources. Leaving severity 3 clears stabilization; reentry starts unstabilized.

Inspired and Despondent require Hope Limit greater than zero. At Hope Limit zero, Hope 0 causes neither condition; Endurance 0 still causes Exhausted but not Broken.

## UI, permissions and deferred rules

Companion and desktop share the health partial and handler. Wound −1/+1 and stabilization use real Actor updates and native editing permissions; observer controls are disabled and the service rejects non-owners. GM administrative death correction is additionally restricted in the update lifecycle. NPC sheets receive no health UI or mechanics.

Broken reminders: Incapacitated until either component ends; no Death's Door drain from Broken itself; lose 1 Power at round end, minimum 0; Body days continuously Broken causes death. Death's Door drains 1 Endurance per combat round or hour outside combat. Only when already Exhausted does that tick instead lose 1 Hope. Stabilization stops both forms of drain.

`applyWounds(actor, wounds)` is the authoritative simultaneous Wound event, also used by `applyDamage`. Its single Actor update includes self-Hope loss based only on final severity: Light loses half positive current Hope rounded up (minimum 1); Grievous loses half Hope Limit rounded up. Reopening treated Grievous Wounds is also a Wound event. No self-loss is specified for final severity 3/4. Manual wound corrections and direct document edits do not apply narrative Hope loss.

`applyWitnessedWoundHopeLoss(actor, resultingSeverity)` takes an explicitly selected witnessing Fated and loses 1/2/3 Hope for severity 1/2/3. Call once per witness per event, using `applyDamage`'s final severity; there is no scene scan, witness UI or automatic invocation.

`applyDeathsDoorDrain(actor)` applies one elapsed round/hour tick. The caller is responsible for timing and calling exactly once; no combat or world-time scheduler is installed. It uses existing resource bounds and document transitions, so becoming Broken while already on Death's Door records death normally. Dead and stabilized actors do not drain.

`applyFateDieHope(actor, face)` records only the Hope component of a physical Fate Die result (17–19: +1; 20: +2), on its explicitly supplied roller only. There was no existing Fate Die resolution service. No dice are rolled and no party collection is accessed. Caller/UI integration remains explicit. All three APIs require ownership of a Fated Actor and reuse existing clamping.

Death's Door drain has an explicit single-tick API; timers and duration death remain manual. Physical Damage/Defense comparison, simultaneous wounds, wound care and rest recovery use their existing services. Healing rolls, temporary acting exceptions, digital dice, automatic drain scheduling and resurrection remain deferred.

## Verification

Automated tests use Foundry's actual common DataModels and exercise severity mapping, conditions, cumulative/provenance-preserving modifiers, stabilization, both second-incapacitation directions, persistent death/GM corrections, simultaneous first entry, snapshot preservation and permissions. Existing Action, declaration, Companion and resource tests remain included.

Live smoke-world checks exercise wound controls, labelled modifiers/Multi-Action, all derived resource conditions, Broken resolution, stabilization/refresh, both sequential death directions, planner blocking/snapshot preservation, native document synchronization and representative phone/tablet viewports. Physical-device Safari and live observer permission testing remain separate device/account checks.
