/**
 * @file Desktop manual-modifier controller. Serializes edits per Actor object before
 * replacing its stored modifier array; labels remain authored text. Calculation
 * and localization of system modifiers belong to health/presentation services.
 */
// Shared across sheets using the same Actor object; not a server-side lock.
const pendingUpdates = new WeakMap();

/**
 * Serialize blur/add/remove events so an in-flight edit cannot overwrite a sibling.
 *
 * Returns Promise<boolean> for an add/edit/remove operation. Queues by Actor
 * object, then reads current entries and calls Actor.update() with the full array.
 * This protects sibling edits on this client, not independent remote clients.
 */
export async function changeManualModifier(sheet, operation) {
  const actor = sheet.document;
  if (!sheet.isEditable || !actor.isOwner || actor.type !== "fated") return false;
  const pending = (pendingUpdates.get(actor) ?? Promise.resolve()).catch(() => {})
    .then(() => applyManualModifier(sheet, operation));
  pendingUpdates.set(actor, pending);
  try { return await pending; }
  finally { if (pendingUpdates.get(actor) === pending) pendingUpdates.delete(actor); }
}

/** Replace the array atomically, addressing entries by stable id rather than row index. */
async function applyManualModifier(sheet, operation) {
  const actor = sheet.document;
  if (!sheet.isEditable || !actor.isOwner || actor.type !== "fated") return false;
  const modifiers = (actor.system.manualRollModifiers ?? []).map(entry => ({ ...entry }));
  if (operation.type === "add") {
    modifiers.push({ id: foundry.utils.randomID(), type: "successDice", label: "", value: 0 });
  } else {
    const index = modifiers.findIndex(entry => entry.id === operation.id);
    if (index < 0) return false;
    if (operation.type === "remove") modifiers.splice(index, 1);
    else if (operation.type === "edit") {
      const { field, value } = operation;
      if (field === "value" && !Number.isSafeInteger(value)) return false;
      if (field === "type" && !["successDice", "successThreshold"].includes(value)) return false;
      if (field === "label" && typeof value !== "string") return false;
      if (!["label", "type", "value"].includes(field)) return false;
      modifiers[index][field] = value;
    } else return false;
  }
  await actor.update({ "system.manualRollModifiers": modifiers });
  return true;
}

/**
 * Bound-sheet add/remove click handler; delegates to the Actor queue and clears
 * a local click guard in finally. Does not calculate modifiers or rewrite labels.
 */
export async function manualModifierAction(event, button) {
  if (this._manualModifierPending) return;
  this._manualModifierPending = true;
  try {
    await changeManualModifier(this, { type: button.dataset.operation, id: button.dataset.modifierId });
  } finally {
    this._manualModifierPending = false;
  }
}
