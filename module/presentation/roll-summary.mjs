import { actorRollModifiers } from "../health.mjs";
import { modifiersView } from "./labels.mjs";
import { BASE_SUCCESS_THRESHOLD } from "../actions/action-model.mjs";

export const signedModifier = value => value >= 0 ? `+${value}` : String(value);

/** No roll source or turn context: dice are a delta, threshold has universal base 4. */
export function rollSummary(actor, i18n) {
  const modifiers = actorRollModifiers(actor);
  const rows = type => modifiersView(modifiers[type].filter(modifier => modifier.value !== 0), i18n)
    .map(modifier => ({ ...modifier, signedValue: signedModifier(modifier.value) }));
  const total = type => modifiers[type].reduce((sum, modifier) => sum + modifier.value, 0);
  return { successDice: rows("successDice"), successThreshold: rows("successThreshold"),
    diceModifier: signedModifier(total("successDice")), thresholdBase: BASE_SUCCESS_THRESHOLD,
    thresholdTotal: BASE_SUCCESS_THRESHOLD + total("successThreshold") };
}
