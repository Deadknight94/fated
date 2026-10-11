/** Read-only Action cards shared by desktop and mobile; no declaration context. */
import { calculateActorAction } from "../health.mjs";
import { actionDamage } from "../defense.mjs";
import { formatDiceSourceLabel } from "../helpers/dice-source-label.mjs";
import { displayLabel, modifierLabel, rangeLabel } from "./labels.mjs";
import { uiText, systemMessage } from "./text.mjs";

const displayNumber = (value, i18n) => Number.isFinite(value) ? String(value) : uiText("Unspecified", {}, i18n);

/** Format service output without arithmetic, retaining modifier provenance. */
export function breakdownView(value, i18n) {
  return { ...value, base: displayNumber(value.base, i18n), total: displayNumber(value.total, i18n),
    modifiers: value.modifiers.map(modifier => ({ ...modifier,
      label: modifierLabel(modifier, i18n),
      value: Number.isFinite(modifier.value) ? `${modifier.value >= 0 ? "+" : ""}${modifier.value}` : uiText("Unspecified", {}, i18n)
    })) };
}

/** Availability belongs to the Actor API; planner addition issues belong to its controller. */
export function availableActionsView(actor, i18n) {
  return actor.getAvailableActions().map(action => {
    const calculation = calculateActorAction(actor, action);
    const damagePerSuccess = actionDamage(action, actor.items.get(action.source.itemId));
    return { ...action, damagePerSuccess, hasDamage: damagePerSuccess !== null,
      name: action.name || uiText("Unnamed Action", {}, i18n),
      rollRequirementLabel: action.rollRequirement ? displayLabel("rollRequirement", action.rollRequirement, i18n) : uiText("Roll requirement unspecified", {}, i18n),
      classificationLabel: displayLabel("classification", action.classification, i18n),
      attackLabel: displayLabel("attack", action.attackType, i18n), rangeLabel: rangeLabel(action.range, i18n),
      stanceLabel: action.allowedStances.length ? action.allowedStances.map(value => displayLabel("stance", value, i18n)).join(", ") : uiText("Unspecified", {}, i18n),
      eligibilityLabel: uiText(action.multiActionEligible === null ? "Unspecified" : action.multiActionEligible ? "Yes" : "No", {}, i18n),
      diceSourceLabel: formatDiceSourceLabel(action, calculation, actor, i18n),
      dice: breakdownView(calculation.successDice, i18n), threshold: breakdownView(calculation.successThreshold, i18n),
      thresholdReviewIssue: systemMessage(calculation.successThreshold.reviewIssue, i18n)
    };
  });
}
