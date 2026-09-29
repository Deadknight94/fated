/**
 * @file Shared health click controller for Fated sheets. Uses the bound sheet as this,
 * blocks repeated local clicks and localizes service errors. updateHealth owns
 * Actor mutation; the handler does not derive health or schedule recovery.
 */
import { systemMessage } from "../presentation/text.mjs";
import { updateHealth } from "../health.mjs";

/**
 * Shared sheet handler; state and permissions remain on the Actor.
 *
 * Foundry action handler bound to a sheet; converts button data into an operation
 * and awaits updateHealth. Mutates only a local pending guard directly; errors
 * become localized notifications and Actor writes are delegated.
 */
export async function healthAction(event, button) {
  if (!this.isEditable || this.healthPending) return;
  this.healthPending = true;
  try {
    await updateHealth(this.document, { type: button.dataset.healthOperation, care: button.dataset.care, delta: Number(button.dataset.delta) }, { isGM: game.user.isGM });
  } catch (error) {
    ui.notifications.warn(systemMessage(error.message));
  } finally {
    this.healthPending = false;
  }
}
