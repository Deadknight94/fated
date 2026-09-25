import { setEquipped } from "../equipment.mjs";
import { systemMessage } from "../presentation/text.mjs";

export async function toggleEquipment(event, button) {
  if (this.equipmentPending) return;
  const item = this.document.items.get(button.dataset.itemId);
  this.equipmentPending = true;
  try { await setEquipped(item, !item?.system.equipped); }
  catch (error) { ui.notifications.warn(systemMessage(error.message)); }
  finally { this.equipmentPending = false; }
}
