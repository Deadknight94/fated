/**
 * @file Actor-wide Roll Summary presentation for desktop and mobile sheets. Combines
 * health/manual modifiers without an Action source or turn context; the dice value
 * is a delta, not a final pool. Does not roll dice or persist data.
 */
import { actorRollModifiers } from "../health.mjs";
import { modifiersView } from "./labels.mjs";
import { BASE_SUCCESS_THRESHOLD } from "../actions/action-model.mjs";

/**
 * Pure signed-number formatter for summary rows; zero displays as +0.
 */
export const signedModifier = value => value >= 0 ? `+${value}` : String(value);

/**
 * No roll source or turn context: dice are a delta, threshold has universal base 4.
 *
 * Read-only projection with localized nonzero modifier rows, signed dice delta,
 * base Threshold and global Threshold total. Does not include stance, Multi-Action,
 * Endurance Push or Item modifiers and does not clamp the global dice delta.
 */
export function rollSummary(actor, i18n) {
  const modifiers = actorRollModifiers(actor);
  const rows = type => modifiersView(modifiers[type].filter(modifier => modifier.value !== 0), i18n)
    .map(modifier => ({ ...modifier, signedValue: signedModifier(modifier.value) }));
  const total = type => modifiers[type].reduce((sum, modifier) => sum + modifier.value, 0);
  return { successDice: rows("successDice"), successThreshold: rows("successThreshold"),
    diceModifier: signedModifier(total("successDice")), thresholdBase: BASE_SUCCESS_THRESHOLD,
    thresholdTotal: BASE_SUCCESS_THRESHOLD + total("successThreshold") };
}
