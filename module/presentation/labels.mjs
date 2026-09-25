import { SKILL_LABELS } from "../skills.mjs";
import { uiText, systemMessage } from "./text.mjs";

const labels = {
  attribute: { body: "Body", mind: "Mind", heart: "Heart" },
  stance: { offensive: "Offensive", neutral: "Neutral", defensive: "Defensive", ranged: "Ranged" },
  skill: SKILL_LABELS,
  itemType: { armor: "Armor", weapon: "Weapon", equipment: "Equipment", feature: "Feature", weaponProficiency: "Weapon Proficiency" },
  classification: { main: "Main Action", free: "Free Action", power: "Power Action", movement: "Movement" },
  attack: { melee: "Melee", ranged: "Ranged" },
  rollRequirement: { required: "Requires Roll", none: "No Roll" },
  section: { character: "Character", turn: "Turn", actions: "Actions", items: "Items" },
  wound: { 0: "Healthy", 1: "Light Wound", 2: "Grievous Wound", 3: "Death's Door", 4: "Dead" },
  condition: { overburdened: "Overburdened", exhausted: "Exhausted", inspired: "Inspired", despondent: "Despondent",
    broken: "Broken", incapacitated: "Incapacitated", dead: "Dead", bandaged: "Bandaged", treated: "Treated" },
  care: { none: "None", bandaged: "Bandaged", treated: "Treated", grievousHealingPending: "Grievous healing pending" }
};

/** Stable internal values go in; display strings come out. Unknown nonempty keys remain visible. */
export function displayLabel(kind, value, i18n) {
  const text = labels[kind] && Object.hasOwn(labels[kind], value) ? labels[kind][value] : undefined;
  return text ? uiText(text, {}, i18n) : value || uiText("Unspecified", {}, i18n);
}

export function skillGroupsView(groups, i18n) {
  return groups.map(group => ({ ...group, label: displayLabel("attribute", group.attribute, i18n),
    skills: group.skills.map(skill => ({ ...skill, label: displayLabel("skill", skill.key, i18n) })) }));
}

export function localizedHealth(view, i18n) {
  if (!view) return view;
  const adjustments = { overburdened: " (+1)", exhausted: " (+1)", inspired: " (−1)", despondent: " (+1)" };
  return { ...view, woundLabel: displayLabel("wound", view.severity, i18n),
    conditions: ["overburdened", "exhausted", "inspired", "despondent", "broken", "incapacitated", "dead"]
      .filter(key => view[key]).map(key => displayLabel("condition", key, i18n) + (adjustments[key] ?? "")) };
}

export function localizedEquipment(view, i18n) {
  return { ...view, typeLabel: displayLabel("itemType", view.type, i18n),
    stateLabel: uiText(view.type === "armor" ? "Worn" : "Equipped", {}, i18n) };
}

/** Only system provenance authorizes translation; custom Item/Action modifier labels stay verbatim. */
export function modifierLabel(modifier, i18n) {
  const source = modifier.source;
  if (source?.type === "stance") return uiText("{stance} stance", { stance: displayLabel("stance", source.stance, i18n) }, i18n);
  if (source?.type === "declaration" && modifier.id === "multi-action") return uiText("Multi-Action", {}, i18n);
  if (source?.type === "actor-state") {
    return source.condition === "wounds" ? displayLabel("wound", modifier.value, i18n)
      : displayLabel("condition", source.condition, i18n);
  }
  if (source?.type === "item" && modifier.label === `${source.itemName} (Worn Armor)`) {
    return uiText("{name} (Worn Armor)", { name: source.itemName }, i18n);
  }
  return modifier.label || uiText("Unlabelled modifier", {}, i18n);
}

export function modifiersView(modifiers, i18n) {
  return modifiers.map(modifier => ({ ...modifier, label: modifierLabel(modifier, i18n) }));
}

export function defenseView(defense, i18n) {
  return { ...defense, modifiers: modifiersView(defense.modifiers, i18n) };
}

export function rangeLabel(range, i18n) {
  if (range.min === null && range.max === null) return uiText("Unspecified", {}, i18n);
  // Range units are free-form authored text and must remain verbatim.
  return `${range.min ?? "?"}–${range.max ?? "?"} ${range.units || uiText("(units unspecified)", {}, i18n)}`;
}

export function declarationIssuesView(evaluation, i18n) {
  return evaluation.issues.map(issue => {
    let message = systemMessage(issue.message, i18n);
    const action = evaluation.entries.find(entry => entry.id === issue.entryId)?.action;
    // Distinguish a generated fallback from an Action actually named "Unnamed Action".
    if (action && !action.name && message.startsWith("Unnamed Action:")) {
      message = uiText("Unnamed Action", {}, i18n) + message.slice("Unnamed Action".length);
    }
    return { ...issue, message };
  });
}
