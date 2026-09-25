# Fated English / Italian localization audit

The repository-wide presentation migration is implemented. The 128 committed localization values in each language and the existing desktop template are preserved. Rules, schemas, stable identifiers, Actor/Item data, migrations, document flags, calculations, and combat services are unchanged. No commit was created. FINAL_REPORT.md and REPORT.md were not touched.

## 1. Exact files changed

- `docs/LOCALIZATION_AUDIT.md`
- `fated.mjs`
- `lang/en.json`
- `lang/it.json`
- `module/apps/rest-app.mjs`
- `module/companion.mjs`
- `module/equipment.mjs`
- `module/helpers/dice-source-label.mjs`
- `module/presentation/labels.mjs`
- `module/presentation/sheet-mixin.mjs`
- `module/presentation/text.mjs`
- `module/sheets/actor-sheets.mjs`
- `module/sheets/damage-bookkeeping.mjs`
- `module/sheets/equipment-controls.mjs`
- `module/sheets/health-controls.mjs`
- `module/sheets/item-sheet.mjs`
- `module/sheets/mobile-sheet.mjs`
- `templates/actor/damage-bookkeeping.hbs`
- `templates/actor/mobile-sheet.hbs`
- `templates/actor/npc-sheet.hbs`
- `templates/actor/rest-app.hbs`
- `templates/actor/turn-planner.hbs`
- `templates/companion-fallback.hbs`
- `templates/item/action-editor.hbs`
- `templates/item/item-sheet.hbs`
- `tests/localization.test.mjs`

## 2. New helpers

- `module/presentation/labels.mjs`: shared display projections for stable attributes, skills/groups, stances, Item types, health, equipment, wound care, Action metadata, ranges, declaration issues, and modifiers. Modifier translation uses system provenance; custom modifier labels remain unchanged.
- `module/presentation/text.mjs`: UI-only text/key catalog, interpolation, and presentation adapters for messages from pure services. It accepts an injected localization service for direct tests, with an English fallback outside Foundry. Captured Actor/Item/Action names and technical keys remain opaque.
- `module/presentation/sheet-mixin.mjs`: localizes rejected sheet-submission messages at the Foundry v14 presentation boundary while retaining the original error as its cause.
- `module/sheets/equipment-controls.mjs`: the existing equipment click handler moved out of the pure equipment service; the same mutation/permission calls now display localized errors.

The existing `module/helpers/dice-source-label.mjs` remains a presentation formatter. It still trusts calculation provenance before fallback source data and does not resolve proficiencies, skills, or current Actor values. Legacy attribute labels now show “Body 5” / “Corpo 5”.

## 3. Localization keys added

231 new leaf keys in each language; 359 total matching leaf keys. All keys are under `FATED.*`.

- `FATED.Action.AllowedStances`
- `FATED.Action.BaseDice`
- `FATED.Action.BaseSuccessThreshold`
- `FATED.Action.BaseThreshold`
- `FATED.Action.Classification`
- `FATED.Action.ConfiguredDice`
- `FATED.Action.DamageEffect`
- `FATED.Action.DiceModifiers`
- `FATED.Action.FinalDice`
- `FATED.Action.FinalThreshold`
- `FATED.Action.FixedBase`
- `FATED.Action.Hexes`
- `FATED.Action.Melee`
- `FATED.Action.MissingName`
- `FATED.Action.MissingProficiency`
- `FATED.Action.MissingSkill`
- `FATED.Action.MultiAction`
- `FATED.Action.MultiEligible`
- `FATED.Action.NoRoll`
- `FATED.Action.NoRollRequired`
- `FATED.Action.Range`
- `FATED.Action.RangeUnits`
- `FATED.Action.RequiresRoll`
- `FATED.Action.RollRequirement`
- `FATED.Action.RollUnspecified`
- `FATED.Action.StanceModifier`
- `FATED.Action.ThresholdModifiers`
- `FATED.Action.UnitsUnspecified`
- `FATED.Action.UnlabelledModifier`
- `FATED.Action.Unnamed`
- `FATED.Action.Use`
- `FATED.ActorType.Fated`
- `FATED.Common.Actions`
- `FATED.Common.And`
- `FATED.Common.Character`
- `FATED.Common.Description`
- `FATED.Common.DisplayName`
- `FATED.Common.Enabled`
- `FATED.Common.None`
- `FATED.Common.Open`
- `FATED.Common.Proficiency`
- `FATED.Common.Skill`
- `FATED.Common.Stance`
- `FATED.Common.Turn`
- `FATED.Common.Unspecified`
- `FATED.Companion.Error`
- `FATED.Companion.Hint`
- `FATED.Companion.Logout`
- `FATED.Companion.Menu`
- `FATED.Companion.Mode`
- `FATED.Companion.NoCharacter`
- `FATED.Companion.NoPermission`
- `FATED.Companion.Open`
- `FATED.Companion.Refresh`
- `FATED.Companion.Unavailable`
- `FATED.Companion.WrongType`
- `FATED.Damage.Against`
- `FATED.Damage.Applied`
- `FATED.Damage.Apply`
- `FATED.Damage.AttackSource`
- `FATED.Damage.DefenseBase`
- `FATED.Damage.DefenseMinimum`
- `FATED.Damage.Final`
- `FATED.Damage.FinalMinimum`
- `FATED.Damage.InputHint`
- `FATED.Damage.Manual`
- `FATED.Damage.ManualHint`
- `FATED.Damage.ManualInput`
- `FATED.Damage.PerSuccess`
- `FATED.Damage.PhysicalSuccesses`
- `FATED.Damage.Preview`
- `FATED.Damage.PreviewChanged`
- `FATED.Damage.Product`
- `FATED.Damage.ResultSeverity`
- `FATED.Damage.Successes`
- `FATED.Damage.WoundsInflicted`
- `FATED.Defense.WornArmor`
- `FATED.Item.ActionHint`
- `FATED.Item.ActionName`
- `FATED.Item.AddAction`
- `FATED.Item.AddModifier`
- `FATED.Item.Adjustment`
- `FATED.Item.AttackDamage`
- `FATED.Item.AttackType`
- `FATED.Item.DamagePlaceholder`
- `FATED.Item.DiceSource`
- `FATED.Item.EffectSummary`
- `FATED.Item.EquipmentProficiency`
- `FATED.Item.FixedDice`
- `FATED.Item.MaximumRange`
- `FATED.Item.MinimumRange`
- `FATED.Item.ModifierSource`
- `FATED.Item.NoActions`
- `FATED.Item.ProficiencyExample`
- `FATED.Item.ProficiencyHint`
- `FATED.Item.ProficiencyKey`
- `FATED.Item.ProficiencyPrecedence`
- `FATED.Item.RemoveAction`
- `FATED.Item.RemoveModifier`
- `FATED.Item.RulesText`
- `FATED.Item.StancesHint`
- `FATED.Item.ThresholdHint`
- `FATED.ItemType.Feature`
- `FATED.ItemType.WeaponProficiency`
- `FATED.Mobile.ActionHint`
- `FATED.Mobile.AddActionHint`
- `FATED.Mobile.AtTable`
- `FATED.Mobile.DamageHint`
- `FATED.Mobile.DecreaseEndurance`
- `FATED.Mobile.DecreaseHope`
- `FATED.Mobile.DecreasePower`
- `FATED.Mobile.DiceDetails`
- `FATED.Mobile.IncreaseEndurance`
- `FATED.Mobile.IncreaseHope`
- `FATED.Mobile.IncreasePower`
- `FATED.Mobile.ItemsHint`
- `FATED.Mobile.LoadHint`
- `FATED.Mobile.NoActions`
- `FATED.Mobile.NoItems`
- `FATED.Mobile.PhysicalDice`
- `FATED.Mobile.Sections`
- `FATED.Npc.ItemsActions`
- `FATED.Npc.Notes`
- `FATED.Npc.Resources`
- `FATED.Npc.Type`
- `FATED.Planner.ActionUnavailable`
- `FATED.Planner.AddMovement`
- `FATED.Planner.AlreadyLocked`
- `FATED.Planner.CannotLock`
- `FATED.Planner.CannotMove`
- `FATED.Planner.ChooseFirst`
- `FATED.Planner.ChooseStance`
- `FATED.Planner.ClassificationUnknown`
- `FATED.Planner.ContinuousMovement`
- `FATED.Planner.Dead`
- `FATED.Planner.DeclareSequence`
- `FATED.Planner.Details`
- `FATED.Planner.Down`
- `FATED.Planner.Editing`
- `FATED.Planner.End`
- `FATED.Planner.EndBeforeEditing`
- `FATED.Planner.EntryIds`
- `FATED.Planner.EntryNotFound`
- `FATED.Planner.FrozenHint`
- `FATED.Planner.Incapacitated`
- `FATED.Planner.Incomplete`
- `FATED.Planner.InvalidEntry`
- `FATED.Planner.Lock`
- `FATED.Planner.Locked`
- `FATED.Planner.MainActions`
- `FATED.Planner.MainAlreadyDeclared`
- `FATED.Planner.MainLimit`
- `FATED.Planner.MarkDone`
- `FATED.Planner.MissingAction`
- `FATED.Planner.Move`
- `FATED.Planner.MoveDown`
- `FATED.Planner.MoveUp`
- `FATED.Planner.MovementAlreadyDeclared`
- `FATED.Planner.MovementLimit`
- `FATED.Planner.MultiIneligible`
- `FATED.Planner.MultiThreshold`
- `FATED.Planner.MultiUnknown`
- `FATED.Planner.NoActions`
- `FATED.Planner.NoEntries`
- `FATED.Planner.Permission`
- `FATED.Planner.PickerHint`
- `FATED.Planner.PowerAlreadyDeclared`
- `FATED.Planner.PowerExclusive`
- `FATED.Planner.RemoveEntry`
- `FATED.Planner.RollIncomplete`
- `FATED.Planner.RollUnknown`
- `FATED.Planner.Stale`
- `FATED.Planner.StanceDisallowed`
- `FATED.Planner.StanceRequired`
- `FATED.Planner.StancesUnknown`
- `FATED.Planner.UndoDone`
- `FATED.Planner.UnknownEdit`
- `FATED.Planner.UnknownStance`
- `FATED.Planner.Up`
- `FATED.Planner.UpTo`
- `FATED.Planner.Version`
- `FATED.Resource.Resilience`
- `FATED.Resource.Shadow`
- `FATED.Rest.AdvanceCare`
- `FATED.Rest.Begin`
- `FATED.Rest.BeginHint`
- `FATED.Rest.Care`
- `FATED.Rest.CareDayHint`
- `FATED.Rest.CompleteDay`
- `FATED.Rest.CompleteHealing`
- `FATED.Rest.DayHint`
- `FATED.Rest.DaysRemaining`
- `FATED.Rest.ExecuteLong`
- `FATED.Rest.ExecuteShort`
- `FATED.Rest.Extended`
- `FATED.Rest.ExtendedHealing`
- `FATED.Rest.ExtendedHint`
- `FATED.Rest.ExtraEndurance`
- `FATED.Rest.Long`
- `FATED.Rest.LongHealing`
- `FATED.Rest.LongHint`
- `FATED.Rest.PendingCare`
- `FATED.Rest.PendingHint`
- `FATED.Rest.Short`
- `FATED.Rest.ShortHealing`
- `FATED.Rest.ShortHint`
- `FATED.Rest.SpendHope`
- `FATED.Validation.ActionIds`
- `FATED.Validation.ActorPermission`
- `FATED.Validation.ArmorAlreadyWorn`
- `FATED.Validation.AttackUnavailable`
- `FATED.Validation.DamageFinite`
- `FATED.Validation.DamageModifiers`
- `FATED.Validation.DeathCorrection`
- `FATED.Validation.DefenseIncomplete`
- `FATED.Validation.DefenseModifier`
- `FATED.Validation.DuplicateProficiency`
- `FATED.Validation.FatedPermission`
- `FATED.Validation.FatedTarget`
- `FATED.Validation.InvalidProficiency`
- `FATED.Validation.ItemPermission`
- `FATED.Validation.LegacyThreshold`
- `FATED.Validation.MultipleArmor`
- `FATED.Validation.NoEquipmentState`
- `FATED.Validation.Nonnegative`
- `FATED.Validation.RangeOrder`
- `FATED.Validation.RestRejected`
- `FATED.Validation.SuccessesInteger`
- `FATED.Validation.TargetPermission`
- `FATED.Validation.WoundsInteger`
- `FATED.Validation.WoundsTooLarge`

## 4. Existing localization keys reused

123 existing keys are referenced by the presentation code/templates. All 128 original keys and values are preserved in both catalogs.

- `FATED.Action.Free`
- `FATED.Action.Main`
- `FATED.Action.Movement`
- `FATED.Action.Power`
- `FATED.Attribute.Body`
- `FATED.Attribute.Heart`
- `FATED.Attribute.Mind`
- `FATED.Combat.Damage`
- `FATED.Combat.Defense`
- `FATED.Combat.DefenseBreakdown`
- `FATED.Combat.Effective`
- `FATED.Combat.Minimum`
- `FATED.Combat.Raw`
- `FATED.Common.Add`
- `FATED.Common.AddProficiency`
- `FATED.Common.Equip`
- `FATED.Common.Equipped`
- `FATED.Common.No`
- `FATED.Common.PhysicalDamage`
- `FATED.Common.Remove`
- `FATED.Common.Rest`
- `FATED.Common.Roll`
- `FATED.Common.Worn`
- `FATED.Common.Yes`
- `FATED.Health.ApplyRulesManually`
- `FATED.Health.Bandaged`
- `FATED.Health.Broken`
- `FATED.Health.BrokenCausesNo`
- `FATED.Health.ClearRecordedDeath`
- `FATED.Health.ContinuouslyBroken`
- `FATED.Health.CorrectRecordedDeath`
- `FATED.Health.Dead`
- `FATED.Health.DeathsDoor`
- `FATED.Health.Decrease`
- `FATED.Health.DecreaseWoundSeverity`
- `FATED.Health.Despondent`
- `FATED.Health.Exhausted`
- `FATED.Health.GMAdministrativeCorrection`
- `FATED.Health.Grievous`
- `FATED.Health.GrievousWound`
- `FATED.Health.Health`
- `FATED.Health.HealthAndConditions`
- `FATED.Health.Healthy`
- `FATED.Health.Incapacitated`
- `FATED.Health.IncapacitatedUntil`
- `FATED.Health.Increase`
- `FATED.Health.IncreaseWoundSeverity`
- `FATED.Health.Inspired`
- `FATED.Health.Light`
- `FATED.Health.LightWound`
- `FATED.Health.LosePower`
- `FATED.Health.LowerSeverityBeforeClearing`
- `FATED.Health.MarkStabilized`
- `FATED.Health.MarkUnstabilized`
- `FATED.Health.NoResourceConditions`
- `FATED.Health.NotHealingOrResurrection`
- `FATED.Health.Overburdened`
- `FATED.Health.RecordDeath`
- `FATED.Health.ReducingWounds`
- `FATED.Health.Severity`
- `FATED.Health.Severity4MeansDead`
- `FATED.Health.StabilizationStops`
- `FATED.Health.Stabilized`
- `FATED.Health.Treated`
- `FATED.Health.Unstabilized`
- `FATED.Health.UnstabilizedLose`
- `FATED.Health.Wound`
- `FATED.Health.Wounds`
- `FATED.ItemType.Armor`
- `FATED.ItemType.Equipment`
- `FATED.ItemType.Weapon`
- `FATED.Resource.Endurance`
- `FATED.Resource.Hope`
- `FATED.Resource.Load`
- `FATED.Resource.Power`
- `FATED.Roll.Success`
- `FATED.Roll.SuccessDice`
- `FATED.Roll.SuccessThreshold`
- `FATED.Roll.Successes`
- `FATED.Roll.Untrained`
- `FATED.Sheet.Attribute`
- `FATED.Sheet.Biography`
- `FATED.Sheet.CurrentStance`
- `FATED.Sheet.Display`
- `FATED.Sheet.Items`
- `FATED.Sheet.Key`
- `FATED.Sheet.Level`
- `FATED.Sheet.Name`
- `FATED.Sheet.NoItems`
- `FATED.Sheet.NoProficiencies`
- `FATED.Sheet.OpenMobile`
- `FATED.Sheet.PrimaryAttributes`
- `FATED.Sheet.Proficiencies`
- `FATED.Sheet.Remove`
- `FATED.Sheet.Resources`
- `FATED.Sheet.Rest`
- `FATED.Sheet.Skills`
- `FATED.Sheets.Fated`
- `FATED.Sheets.Item`
- `FATED.Sheets.Mobile`
- `FATED.Sheets.Npc`
- `FATED.Skill.Athletics`
- `FATED.Skill.Awe`
- `FATED.Skill.Craft`
- `FATED.Skill.Deceive`
- `FATED.Skill.Diplomacy`
- `FATED.Skill.Enhearten`
- `FATED.Skill.Explore`
- `FATED.Skill.Finesse`
- `FATED.Skill.Healing`
- `FATED.Skill.HuntingForaging`
- `FATED.Skill.Insight`
- `FATED.Skill.Leadership`
- `FATED.Skill.Lore`
- `FATED.Skill.Perception`
- `FATED.Skill.Persuade`
- `FATED.Skill.Reason`
- `FATED.Skill.Stealth`
- `FATED.Skill.Travel`
- `FATED.Stance.Defensive`
- `FATED.Stance.Neutral`
- `FATED.Stance.Offensive`
- `FATED.Stance.Ranged`

## 5. English intentionally retained

- “Fated” is the game proper name. This is the only literal alphabetic template text left after scanning text nodes and accessibility attributes.
- Technical examples such as `longSwords`, stored keys, form values, and identifiers remain unchanged.
- Developer/debug messages remain English. Pure-service error strings remain unchanged internally and are translated by the UI adapters when displayed.
- Foundry/core/extension diagnostics outside the Fated catalog retain their original messages; their translation belongs to Foundry or the extension. Unrecognized messages are not silently discarded.
- No Fated chat/card renderer or combat-phase UI exists in this repository; there was no such presentation surface to translate. Combat hooks and phase logic were left untouched.

## 6. User-authored text intentionally retained

Actor and Item names, proficiency displayName and keys, Action names/effects/rules text, custom modifier labels, free-form range units, descriptions, biographies, and GM notes are never translated. This includes text that happens to equal an English system label. Historical migration notes already stored in an Action’s editable rules text also remain verbatim, because that field cannot safely be distinguished from user-authored content. Existing migration behavior is unchanged.

## 7. Tests and other validation

Final full suite, using `FOUNDRY_APP_PATH=E:\Program Files\FoundryVTT\Foundry Virtual Tabletop\resources\app` and `node --test`:

- Tests: **339**
- Passed: **333**
- Failed: **6**
- Suites: **0**
- Cancelled / skipped / todo: **0 / 0 / 0**
- All **14** new localization tests pass. These cover recursive catalog and placeholder parity, canonical Skill labels, stable keys, opaque authored names, system-only modifiers, health/equipment projections, authoritative dice-source provenance, incomplete/legacy sources, error interpolation, unnamed versus authored Action names, form rejection, bilingual Handlebars rendering, and locked planner snapshots without mutation/recalculation.
- English and Italian desktop, mobile, NPC, Item/Action editor, rest, damage-window, and Companion fallback templates were compiled/rendered in Node using the installed Foundry Handlebars library. These are headless checks, not browser/visual acceptance testing.
- `node --check`: all **15** changed/new `.mjs` files passed.
- `git diff --check`: passed.
- `git status --short` and `git diff --stat`: inspected. Git’s diff stat excludes untracked new helpers/tests/this audit until they are staged; no staging or commit was performed.
- Literal template text, title/placeholder/aria attributes, notifications/dialogs, JS presentation labels, and dynamic context producers were audited.
- UTF-8 decoding and mojibake scan passed. New Italian text was manually reviewed; established committed wording was preserved.
- An initial sandboxed test attempt could not spawn Node workers (`EPERM`); the actual full test results above came from the permitted rerun.

## 8. Known unrelated baseline failures

These six tests in `tests/combat-phase.test.mjs` still fail with `ReferenceError: Actor is not defined` in their harness:

- startRound initialises phase and resets acted flags
- markActed and undoActed work per combatant
- beginAdversaryPhase sets phase without affecting acted flags
- endRound advances round, resets phase to players and clears acted flags
- external round change syncs phase and acted flags
- flags are stored in document flags, not schema

The prior dice-source legacy-label failure is resolved by the directly relevant formatter localization: the unchanged test expecting “Body 5” now passes. No existing tests were modified.

An existing unrelated issue was also noticed: both Add Proficiency handlers contain `await dialog` after the document update although `dialog` is not defined in those handlers. It was left unchanged in this presentation-only pass.

## 9. Duplicate-key validation

Both language files were explicitly decoded with Python `json.loads(..., object_pairs_hook=...)`, using a hook that rejects a repeated object key before constructing a dictionary. **Zero duplicate keys** in either file. This was separate from ordinary JSON parsing.

## 10. EN/IT parity

**Pass:** identical recursive object paths and **359** leaf-key paths; identical interpolation placeholders. Both JSON files parse successfully. All **128** baseline keys and their original English/Italian values were compared against HEAD and are unchanged. Every literal `FATED.*` reference in production modules/templates resolves to a catalog entry.

## 11. Recommended manual Foundry v14 checks

- Switch the Foundry language between English and Italian and reload. Inspect Actor/Item creation choices and sheet/app titles.
- Open desktop, mobile/Companion, NPC, and all five Item types; review narrow phone/tablet layouts, long Italian labels, keyboard focus, and accessible button names.
- Check Item Action selectors, stance labels, unknown/incomplete fields, proficiency/Skill sources, invalid range input, and equipment rejection dialogs/notifications.
- Lock a declaration, change language, then change live Items/Actor values: translated labels should follow the language while the locked numbers remain frozen. Check movement, Action order, Multi-Action details, checklist controls, and clear/end flows.
- Review health conditions, wound care/rest controls, defense and damage previews, rejected input, and read-only users in both languages.
- Verify that user-written text stays verbatim, including names or modifier labels such as “Body” or “Offensive stance”.
- Exercise Companion’s unassigned/wrong-type/permission states and its menu on an actual phone/tablet.

No live Foundry browser session or visual/touch acceptance test was performed during this pass.
