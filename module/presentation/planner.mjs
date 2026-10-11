/** Read-only Turn Planner presentation shared by sheet controllers. */
import { displayLabel, rangeLabel, declarationIssuesView } from "./labels.mjs";
import { uiText } from "./text.mjs";
import { breakdownView } from "./actions.mjs";
import { formatDiceSourceLabel } from "../helpers/dice-source-label.mjs";
import { DECLARATION_STANCES } from "../declaration/evaluate.mjs";
import { enduranceSpendOptions } from "../declaration/endurance-push.mjs";

/**
 * Format a declaration and its service evaluation without evaluating Actions or
 * writing Actor data. The caller supplies getDeclarationEvaluation(actor), which
 * selects current draft calculations or frozen locked snapshots. Picker state and
 * its unique element ID belong to the caller; i18n is optional for headless use.
 */
export function plannerView(actor, { declaration, evaluation, actionPickerOpen = false, actionPickerId, i18n }) {
  return { ...evaluation, revision: declaration.revision, stanceLabel: displayLabel("stance", declaration.stance, i18n),
    enduranceSpend: evaluation.locked ? evaluation.enduranceSpend : declaration.enduranceSpend,
    enduranceOptions: enduranceSpendOptions(actor, declaration.enduranceSpend),
    issues: declarationIssuesView(evaluation, i18n),
    stanceChosen: Boolean(declaration.stance),
    actionPickerOpen: actionPickerOpen && Boolean(declaration.stance) && !evaluation.locked,
    actionPickerId,
    stances: DECLARATION_STANCES.map(value => ({ value, label: displayLabel("stance", value, i18n), selected: value === declaration.stance })),
    canAddMovement: !evaluation.locked && evaluation.movementCount === 0 && Boolean(declaration.stance),
    entries: evaluation.entries.map((entry, index, all) => ({ ...entry, number: index + 1,
      movement: entry.kind === "movement", name: entry.action?.name || uiText("Missing or unnamed Action", {}, i18n),
      classificationLabel: displayLabel("classification", entry.action?.classification, i18n),
      requiresRoll: entry.action?.rollRequirement === "required", noRoll: entry.action?.rollRequirement === "none",
      dice: entry.calculation ? breakdownView(entry.calculation.successDice, i18n) : null,
      threshold: entry.calculation ? breakdownView(entry.calculation.successThreshold, i18n) : null,
      diceSourceLabel: formatDiceSourceLabel(entry.action, entry.calculation, actor, i18n),
      rangeLabel: entry.action ? rangeLabel(entry.action.range, i18n) : "",
      canMoveUp: index > 0, canMoveDown: index < all.length - 1, completed: declaration.completed.includes(entry.id)
    })) };
}
