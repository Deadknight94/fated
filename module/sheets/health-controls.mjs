import { updateHealth } from "../health.mjs";

/** Shared sheet handler; state and permissions remain on the Actor. */
export async function healthAction(event, button) {
  if (!this.isEditable || this.healthPending) return;
  this.healthPending = true;
  try {
    await updateHealth(this.document, { type: button.dataset.healthOperation, delta: Number(button.dataset.delta) }, { isGM: game.user.isGM });
  } catch (error) {
    ui.notifications.warn(error.message);
  } finally {
    this.healthPending = false;
  }
}
