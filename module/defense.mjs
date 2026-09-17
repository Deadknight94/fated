/** Worn Armor and stance remain individually traceable; effective Defense has a floor of 1. */
export function calculateDefense(actor, additionalModifiers = []) {
  const { body, mind } = actor.system.attributes;
  const stance = actor.system.currentStance;
  const armor = [...(actor.items ?? [])].filter(item => item.type === "armor" && item.system.equipped);
  if (armor.length > 1) throw new Error("More than one Armor Item is Worn. Unwear the extra Armor before calculating Defense.");
  const armorModifiers = armor.map(item => ({ label: `${item.name} (Worn Armor)`, value: item.system.armor,
    source: { type: "item", itemId: item.id, itemUuid: item.uuid, itemName: item.name } }));
  const modifiers = [...armorModifiers, ...additionalModifiers].map(modifier => ({ ...modifier }));
  if (modifiers.some(modifier => !modifier.label || !modifier.source)) throw new Error("Defense modifiers require a label and source.");
  if (stance === "offensive" || stance === "defensive") modifiers.unshift({
    label: `${stance === "offensive" ? "Offensive" : "Defensive"} stance`,
    value: stance === "offensive" ? -1 : 1, source: { type: "stance", actorUuid: actor.uuid, stance }
  });
  if (![body, mind, ...modifiers.map(m => m.value)].every(Number.isFinite)) throw new Error("Defense data is incomplete.");
  const base = body + mind;
  const raw = base + modifiers.reduce((sum, modifier) => sum + modifier.value, 0);
  return { body, mind, base, modifiers, raw, total: Math.max(1, raw) };
}

export function stanceDamageModifiers(attacker) {
  if (attacker?.type !== "fated") return [];
  const stance = attacker.system.currentStance;
  return ["offensive", "defensive"].includes(stance) ? [{
    label: `${stance === "offensive" ? "Offensive" : "Defensive"} stance`,
    value: stance === "offensive" ? 1 : -1, source: { type: "stance", actorUuid: attacker.uuid, stance }
  }] : [];
}

/** Explicit Action override; weapon Damage is reused only for explicitly melee/ranged Actions. */
export function actionDamage(action, item) {
  if (!["melee", "ranged"].includes(action?.attackType)) return null;
  return action.damage ?? (item?.type === "weapon" ? item.system.damage : null);
}
