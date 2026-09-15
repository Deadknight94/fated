import { ActionDataModel, STANCES } from "../actions/action-model.mjs";
import { readActionForm } from "./action-form.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class FatedItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["fated", "sheet", "item", "standard-form"],
    tag: "form",
    actions: {
      addAction: FatedItemSheet.addAction,
      removeAction: FatedItemSheet.removeAction,
      addModifier: FatedItemSheet.addModifier,
      removeModifier: FatedItemSheet.removeModifier
    },
    position: {
      width: 560,
      height: 640
    },
    window: {
      title: "FATED.Sheets.Item",
      resizable: true
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false
    }
  };

  static PARTS = {
    main: {
      id: "main",
      root: true,
      templates: ["systems/fated/templates/item/action-editor.hbs"],
      template: "systems/fated/templates/item/item-sheet.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      item: this.document,
      system: this.document.system,
      editable: this.isEditable,
      classifications: { "": "Unspecified", main: "Main Action", free: "Free Action", power: "Power Action" },
      attackTypes: { "": "Unspecified", melee: "Melee", ranged: "Ranged" },
      diceSources: { "": "Unspecified", fixed: "Fixed base", heart: "Heart", body: "Body", mind: "Mind" },
      eligibilityOptions: { "": "Unspecified", true: "Yes", false: "No" },
      isWeapon: this.document.type === "weapon",
      hasLoad: ["weapon", "armor", "equipment", "feature"].includes(this.document.type),
      actions: this.document.system.actions.map((action, index) => ({
        ...action.toObject(), index,
        eligibility: action.multiActionEligible === null ? "" : String(action.multiActionEligible),
        stances: STANCES.map(value => ({ value, checked: action.allowedStances.includes(value) })),
        modifierGroups: [
          { kind: "successDice", label: "Success Dice modifiers", entries: action.modifiers.successDice },
          { kind: "successThreshold", label: "Success Threshold modifiers", entries: action.modifiers.successThreshold }
        ]
      })),
      isProficiency: this.document.type === "weaponProficiency"
    };
  }

  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    if (data.system?.actions) data.system.actions = readActionForm(data.system.actions,
      this.document.system.actions.map(action => action.toObject()));
    return data;
  }

  async _preRender(context, options) {
    this.openActions = new Set([...this.element?.querySelectorAll("details[open][data-action-id]") ?? []]
      .map(element => element.dataset.actionId));
    await super._preRender(context, options);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    for (const element of this.element.querySelectorAll("details[data-action-id]")) {
      element.open = this.openActions?.has(element.dataset.actionId) || element.dataset.actionId === this.newActionId;
    }
    this.newActionId = null;
  }

  async editActions(edit) {
    if (!this.isEditable) return;
    await this.submit();
    const actions = this.document.system.actions.map(action => action.toObject());
    edit(actions);
    await this.document.update({ "system.actions": actions });
  }

  static async addAction() {
    await this.editActions(actions => {
      const action = new ActionDataModel({}).toObject();
      this.newActionId = action.id;
      actions.push(action);
    });
  }

  static async removeAction(event, button) {
    const id = button.closest("[data-action-id]").dataset.actionId;
    await this.editActions(actions => {
      const index = actions.findIndex(action => action.id === id);
      if (index >= 0) actions.splice(index, 1);
    });
  }

  static async addModifier(event, button) {
    const id = button.closest("[data-action-id]").dataset.actionId;
    const kind = button.dataset.kind;
    if (!["successDice", "successThreshold"].includes(kind)) return;
    await this.editActions(actions => actions.find(action => action.id === id)?.modifiers[kind]
      .push({ id: foundry.utils.randomID(), label: "", value: null }));
  }

  static async removeModifier(event, button) {
    const id = button.closest("[data-action-id]").dataset.actionId;
    const kind = button.dataset.kind;
    if (!["successDice", "successThreshold"].includes(kind)) return;
    await this.editActions(actions => {
      const action = actions.find(action => action.id === id);
      if (action) action.modifiers[kind] = action.modifiers[kind].filter(modifier => modifier.id !== button.dataset.modifierId);
    });
  }
}
