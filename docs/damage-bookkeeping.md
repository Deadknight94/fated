# Defense and physical damage bookkeeping

Target: Foundry VTT 14.367. No dice, targeting, map legality or combat automation.

Defense is derived in Actor preparation and shared by desktop/Companion presentation and damage previews. `calculateDefense` returns Body, Mind, base, individually sourced modifiers, raw total and effective total (minimum 1). Offensive contributes −1 Defense, Defensive +1; Neutral/Ranged contribute zero. No derived Defense field is stored or editable. Additional traceable modifiers can be supplied to the calculation service; only Worn Armor contributes its Armor value with Item provenance. One Armor Item may be Worn per Fated; other defensive Equipment remains deferred. Equipped state does not change owned=carried Load.

Weapon Items already store `system.damage`. Explicit melee/ranged Actions reuse this value, with optional nullable nonnegative `action.damage` overriding Damage per Success when configured. Equipment/Feature attack Actions need this explicit field. Non-attacks need no Damage. Old descriptive effect text is preserved and never parsed into numeric Damage. Companion Action cards show per-Success Damage and current stance final-damage adjustment.

`previewDamage` accepts attacker, Action/Item, Fated target, physical Successes, optional Damage override and labelled/sourced final-damage modifiers. It multiplies Successes × Damage first, then adds Offensive +1 or Defensive −1 and other supplied modifiers, clamping final Damage to zero. It returns the inputs, calculation/modifiers, target Defense breakdown, Wounds (`floor(final Damage / effective Defense)`) and projected terminal-clamped severity. Preview never mutates documents. Manual final Damage bypasses attacker stance and all attack calculation.

The target-centric ApplicationV2 GM window selects from visible Actors' attack Actions without canvas/token targeting. The explicit Preview and Apply buttons are separate. Apply recalculates current data; changes since preview require reviewing the new preview and pressing Apply again. A successful application consumes the preview to prevent accidental repeated application. The draft contains only transient physical inputs, not a duplicate Actor store.

`applyDamage` checks native target ownership, recalculates and calls `applyWounds` in the existing health service. A damage instance applies severity in one Actor update, allowing the existing TypeDataModel health transition lifecycle to handle Death's Door, second Incapacitation, stabilization and persistent death. Zero-Wound instances issue no update. Observers may preview through authorized interfaces but cannot apply. Concurrent clients can still submit overlapping updates; this milestone does not add transaction infrastructure or a damage event log.

Deferred: actual Equipment Defense, Ranged +1 Success Die, digital dice/Fate, damage targeting/range/LoS/cover, NPC health application, timed drains, healing/rests and combat automation.
