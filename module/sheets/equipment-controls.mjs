/**
 * @file Shared equipment click controller. Looks up an embedded Item on the bound sheet,
 * guards repeated local clicks and displays localized errors. The equipment
 * service owns permission checks and Item.update(), not the template.
 */
import { setEquipped } from "../equipment.mjs";
import { systemMessage } from "../presentation/text.mjs";

/**
 * Foundry action handler bound to a sheet; delegates a proposed toggle to
 * setEquipped and clears its local pending guard even after rejection. Returns
 * Promise<void>; permission and exclusivity checks occur in the service.
 */
export async function toggleEquipment(event, button) {
  if (this.equipmentPending) return;
  const item = this.document.items.get(button.dataset.itemId);
  this.equipmentPending = true;
  try { await setEquipped(item, !item?.system.equipped); }
  catch (error) { ui.notifications.warn(systemMessage(error.message)); }
  finally { this.equipmentPending = false; }
}
