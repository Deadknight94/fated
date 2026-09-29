/**
 * @file Presentation models for sheets: translate system identifiers and provenance-backed
 * labels while retaining authored text and numeric calculations. Reads localization
 * services but never writes Documents or changes declaration snapshots.
 */
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

/**
 * Stable internal values go in; display strings come out. Unknown nonempty keys remain visible.
 *
 * Read-only localization lookup returning a string; unknown nonempty values stay
 * visible. The optional i18n service supports headless callers.
 */
export function displayLabel(kind, value, i18n) {
  const text = labels[kind] && Object.hasOwn(labels[kind], value) ? labels[kind][value] : undefined;
  return text ? uiText(text, {}, i18n) : value || uiText("Unspecified", {}, i18n);
}

/**
 * Returns copied groups/skill rows with localized system labels. Does not change
 * skill keys, levels or the input grouping.
 */
export function skillGroupsView(groups, i18n) {
  return groups.map(group => ({ ...group, label: displayLabel("attribute", group.attribute, i18n),
    skills: group.skills.map(skill => ({ ...skill, label: displayLabel("skill", skill.key, i18n) })) }));
}

/**
 * Returns a localized health presentation copy (or the falsy input). Displays
 * care choices/descriptions and only Broken/Incapacitated/Dead condition rows;
 * numeric roll effects belong in the shared Roll Summary.
 */
export function localizedHealth(view, i18n) {
  if (!view) return view;
  return {
    ...view,
    woundLabel: displayLabel("wound", view.severity, i18n),
    careDescription: view.severity === 1 && view.care === "bandaged"
      ? uiText("Wound Bandaged: Ignore 1 point of the Wound’s Success Threshold penalty. The Wound still counts as Light; if another Wound is suffered, it becomes Grievous.", {}, i18n)
      : view.severity === 2 && view.care === "bandaged"
        ? uiText("Wound Bandaged: Ignore 1 point of the Wound’s Success Threshold penalty. The Wound remains Grievous. Declaring Multi-Action breaks the bandage after that Multi-Action resolves.", {}, i18n)
        : view.severity === 2 && view.care === "treated"
          ? uiText("Wound Treated: Ignore 2 points of the Wound’s Success Threshold penalty. If another Wound would be suffered, the treatment is lost instead: the Grievous Wound reopens and its full penalty returns. That damage instance does not increase wound severity.", {}, i18n)
          : null,
    careLabel: view.care && view.care !== "none"
      ? displayLabel("care", view.care, i18n)
      : null,
    careChoices: (view.careChoices ?? []).map(value => ({
      value,
      label: displayLabel("care", value, i18n),
      selected: value === view.care
    })),
    conditions: ["broken", "incapacitated", "dead"]
      .filter(key => view[key])
      .map(key => displayLabel("condition", key, i18n))
  };
}

/**
 * Returns an equipment presentation copy with localized type and state labels;
 * Item name, identity, equipped state and permissions remain unchanged.
 */
export function localizedEquipment(view, i18n) {
  return { ...view, typeLabel: displayLabel("itemType", view.type, i18n),
    stateLabel: uiText(view.type === "armor" ? "Worn" : "Equipped", {}, i18n) };
}

/**
 * Only system provenance authorizes translation; custom Item/Action modifier labels stay verbatim.
 *
 * Returns the display label based on source provenance, not label spelling alone.
 * Reads i18n only; never rewrites stored modifier labels or numeric contributions.
 */
export function modifierLabel(modifier, i18n) {
  const source = modifier.source;
  if (source?.type === "actor-manual") return modifier.label;
  if (source?.type === "declaration" && source.condition === "wound-suppression" && modifier.id === "endurance-push") return uiText("Endurance Push", {}, i18n);
  if (source?.type === "stance") return uiText("{stance} stance", { stance: displayLabel("stance", source.stance, i18n) }, i18n);
  if (source?.type === "declaration" && modifier.id === "multi-action") return uiText("Multi-Action", {}, i18n);
  if (source?.type === "actor-state") {
    if (source.condition === "hope") return uiText("Hope", {}, i18n);
    return source.condition === "wounds" ? displayLabel("wound", modifier.value, i18n)
      : displayLabel("condition", source.condition, i18n);
  }
  if (source?.type === "item" && modifier.label === `${source.itemName} (Worn Armor)`) {
    return uiText("{name} (Worn Armor)", { name: source.itemName }, i18n);
  }
  return modifier.label || uiText("Unlabelled modifier", {}, i18n);
}

/**
 * Returns copied modifier rows with display labels; numbers and provenance are
 * retained, and the input array/snapshot is not mutated.
 */
export function modifiersView(modifiers, i18n) {
  return modifiers.map(modifier => ({ ...modifier, label: modifierLabel(modifier, i18n) }));
}

/**
 * Returns a Defense presentation copy with localized modifier rows. Arithmetic
 * is already complete in calculateDefense and is not repeated here.
 */
export function defenseView(defense, i18n) {
  return { ...defense, modifiers: modifiersView(defense.modifiers, i18n) };
}

/**
 * Formats min/max or unknown endpoints and verbatim authored units. Returns a
 * localized unspecified label when both endpoints are null; does not check range.
 */
export function rangeLabel(range, i18n) {
  if (range.min === null && range.max === null) return uiText("Unspecified", {}, i18n);
  // Range units are free-form authored text and must remain verbatim.
  return `${range.min ?? "?"}–${range.max ?? "?"} ${range.units || uiText("(units unspecified)", {}, i18n)}`;
}

/**
 * Returns copied issue rows with localized system messages, preserving authored
 * Action names. Uses entries only to distinguish generated unnamed fallbacks.
 */
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
