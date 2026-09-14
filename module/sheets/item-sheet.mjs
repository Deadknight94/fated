const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class FatedItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["fated", "sheet", "item", "standard-form"],
    tag: "form",
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
      isWeapon: this.document.type === "weapon",
      hasLoad: ["weapon", "armor", "equipment", "feature"].includes(this.document.type),
      hasAction: ["weapon", "armor", "equipment", "feature"].includes(this.document.type),
      isProficiency: this.document.type === "weaponProficiency"
    };
  }
}
