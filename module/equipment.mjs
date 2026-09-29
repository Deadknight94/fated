/**
 * @file Equipment service and presentation projection. Checks the single-Worn-Armor
 * invariant and persists equipped state through Item.update(). Does not change
 * Load or filter available Actions; sheet event handling lives in equipment-controls.
 */
/**
 * Read-only check of an Item and proposed worn state against its Fated parent
 * Items. Returns an English conflict message or null; does not unwear anything.
 */
export function wornArmorIssue(item, worn) {
  if (item.type !== "armor" || !worn || item.parent?.type !== "fated") return null;
  const other = [...item.parent.items].find(entry => entry.type === "armor"
    && entry.id !== item.id && entry.system.equipped);
  return other ? `${other.name} is already Worn. Unwear it before wearing ${item.name}.` : null;
}

/**
 * Checks ownership, supported Item type and Armor exclusivity, then returns the
 * Item.update() result for the Boolean equipped flag. Invalid requests throw;
 * this persistent mutation does not change owned=carried Load.
 */
export async function setEquipped(item, equipped) {
  if (!item?.isOwner) throw new Error("You cannot update this Item.");
  if (!["armor", "weapon", "equipment"].includes(item.type)) throw new Error("This Item has no equipped state.");
  const issue = wornArmorIssue(item, equipped);
  if (issue) throw new Error(issue);
  return item.update({ "system.equipped": Boolean(equipped) });
}

/**
 * Read-only Item presentation projection with identity, equipped/worn label and
 * owner editability. localizedEquipment handles translation after this call.
 */
export function equipmentView(item) {
  return { id: item.id, name: item.name, img: item.img, type: item.type,
    equipmentState: ["armor", "weapon", "equipment"].includes(item.type),
    stateLabel: item.type === "armor" ? "Worn" : "Equipped",
    equipped: item.system.equipped, editable: item.isOwner };
}
