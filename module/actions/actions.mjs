import { BASE_SUCCESS_THRESHOLD } from "./action-model.mjs";

/** Preserve ambiguous legacy data for explicit review instead of inventing a modifier. */
export function legacyThresholdIssue(action) {
  const value = action.successThreshold;
  return value !== null && value !== undefined && value !== BASE_SUCCESS_THRESHOLD
    ? `Stored legacy Success Threshold ${value} requires review. The universal base is 4; represent confirmed deviations as named Threshold modifiers and reset the legacy value to 4.` : null;
}

/** Pure, additive infrastructure. Call afresh with all applicable modifiers; never accumulate prior totals. */
export function calculateValue(base, modifiers = []) {
  const entries = modifiers.map(modifier => ({ ...modifier }));
  const complete = Number.isFinite(base) && entries.every(entry => Number.isFinite(entry.value));
  return { base: Number.isFinite(base) ? base : null, modifiers: entries,
    total: complete ? base + entries.reduce((sum, entry) => sum + entry.value, 0) : null, complete };
}

export function calculateAction(action, attributes = {}, additionalModifiers = {}) {
  const source = action.successDice.source;
  const baseDice = source === "fixed" ? action.successDice.base : attributes[source] ?? null;
  return {
    successDice: calculateValue(baseDice, [...action.modifiers.successDice, ...(additionalModifiers.successDice ?? [])]),
    successThreshold: { ...calculateValue(BASE_SUCCESS_THRESHOLD,
      [...action.modifiers.successThreshold, ...(additionalModifiers.successThreshold ?? [])]),
      reviewIssue: legacyThresholdIssue(action) }
  };
}

/** Source provenance is derived, so copying an Item never retains another owner's UUID. */
export function getItemActions(item) {
  return (item.system.actions ?? []).filter(action => action.enabled).map(action => {
    const data = typeof action.toObject === "function" ? action.toObject() : structuredClone(action);
    const source = { itemId: item.id, itemUuid: item.uuid, itemName: item.name, itemType: item.type };
    const modifiers = Object.fromEntries(["successDice", "successThreshold"].map(kind => [kind,
      data.modifiers[kind].map(modifier => ({ ...modifier, source: { ...source, actionId: data.id } }))]));
    return { ...data, key: `${item.uuid}#${data.id}`, source, modifiers };
  });
}

/** Available here means enabled on an owned Item; future stance/condition legality is not evaluated. */
export function getActorActions(actor) {
  return Array.from(actor.items).flatMap(item => item.getAvailableActions());
}
