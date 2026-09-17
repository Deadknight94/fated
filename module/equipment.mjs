export function wornArmorIssue(item, worn) {
  if (item.type !== "armor" || !worn || item.parent?.type !== "fated") return null;
  const other = [...item.parent.items].find(entry => entry.type === "armor"
    && entry.id !== item.id && entry.system.equipped);
  return other ? `${other.name} is already Worn. Unwear it before wearing ${item.name}.` : null;
}

export async function setEquipped(item, equipped) {
  if (!item?.isOwner) throw new Error("You cannot update this Item.");
  if (!["armor", "weapon", "equipment"].includes(item.type)) throw new Error("This Item has no equipped state.");
  const issue = wornArmorIssue(item, equipped);
  if (issue) throw new Error(issue);
  return item.update({ "system.equipped": Boolean(equipped) });
}

export function equipmentView(item) {
  return { id: item.id, name: item.name, img: item.img, type: item.type,
    equipmentState: ["armor", "weapon", "equipment"].includes(item.type),
    stateLabel: item.type === "armor" ? "Worn" : "Equipped",
    equipped: item.system.equipped, editable: item.isOwner };
}

export async function toggleEquipment(event, button) {
  if (this.equipmentPending) return;
  const item = this.document.items.get(button.dataset.itemId);
  this.equipmentPending = true;
  try { await setEquipped(item, !item?.system.equipped); }
  catch (error) { ui.notifications.warn(error.message); }
  finally { this.equipmentPending = false; }
}
