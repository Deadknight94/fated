import { calculateAction } from "../actions/actions.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const label = value => value ? value[0].toUpperCase() + value.slice(1) : "Unspecified";
const displayNumber = value => Number.isFinite(value) ? String(value) : "Unspecified";

function breakdownView(value) {
  return { base: displayNumber(value.base), total: displayNumber(value.total), complete: value.complete,
    modifiers: value.modifiers.map(modifier => ({
      label: modifier.label || "Unlabelled modifier",
      value: Number.isFinite(modifier.value) ? `${modifier.value >= 0 ? "+" : ""}${modifier.value}` : "Unspecified"
    })) };
}

export class FatedMobileSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["fated", "sheet", "fated-mobile"], tag: "form",
    position: { width: 760, height: 780 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: { showSection: FatedMobileSheet.showSection, openItem: FatedMobileSheet.openItem }
  };

  static PARTS = { main: { template: "systems/fated/templates/actor/mobile-sheet.hbs", scrollable: [".mobile-content"] } };

  section = "character";

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actions = this.document.getAvailableActions().map(action => {
      const calculation = calculateAction(action, this.document.system.attributes);
      const range = action.range.min === null && action.range.max === null ? "Unspecified"
        : `${action.range.min ?? "?"}–${action.range.max ?? "?"}${action.range.units ? ` ${action.range.units}` : " (units unspecified)"}`;
      return { ...action,
        name: action.name || "Unnamed Action",
        classificationLabel: label(action.classification), attackLabel: label(action.attackType), rangeLabel: range,
        stanceLabel: action.allowedStances.length ? action.allowedStances.map(label).join(", ") : "Unspecified",
        eligibilityLabel: action.multiActionEligible === null ? "Unspecified" : action.multiActionEligible ? "Yes" : "No",
        diceSourceLabel: label(action.successDice.source),
        dice: breakdownView(calculation.successDice), threshold: breakdownView(calculation.successThreshold)
      };
    });
    return { ...context, actor: this.document, system: this.document.system, editable: this.isEditable, actions,
      items: this.document.items.contents,
      sections: ["character", "turn", "actions", "items"].map(id => ({ id, label: label(id), active: id === this.section })),
      character: this.section === "character", turn: this.section === "turn",
      actionsView: this.section === "actions", itemsView: this.section === "items" };
  }

  static async showSection(event, button) {
    const section = button.dataset.section;
    if (!["character", "turn", "actions", "items"].includes(section) || section === this.section) return;
    if (this.isEditable) await this.submit();
    this.section = section;
    await this.render({ force: true });
  }

  static openItem(event, button) {
    this.document.items.get(button.dataset.itemId)?.sheet.render({ force: true });
  }
}

export function openMobileSheet(actor) {
  const existing = Object.values(actor.apps).find(app => app instanceof FatedMobileSheet);
  return (existing ?? new FatedMobileSheet({ document: actor })).render({ force: true });
}
