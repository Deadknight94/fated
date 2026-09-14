const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

class BaseFatedActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["fated", "sheet", "actor", "standard-form"],
    tag: "form",
    position: {
      width: 700,
      height: 720
    },
    window: {
      resizable: true
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      actor: this.document,
      system: this.document.system,
      items: this.document.items.contents,
      editable: this.isEditable
    };
  }
}

export class FatedActorSheet extends BaseFatedActorSheet {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: [...super.DEFAULT_OPTIONS.classes, "fated-actor"],
    window: {
      ...super.DEFAULT_OPTIONS.window,
      title: "FATED.Sheets.Fated"
    }
  };

  static PARTS = {
    main: {
      id: "main",
      root: true,
      template: "systems/fated/templates/actor/fated-sheet.hbs"
    }
  };
}

export class NpcActorSheet extends BaseFatedActorSheet {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: [...super.DEFAULT_OPTIONS.classes, "npc-actor"],
    window: {
      ...super.DEFAULT_OPTIONS.window,
      title: "FATED.Sheets.Npc"
    }
  };

  static PARTS = {
    main: {
      id: "main",
      root: true,
      template: "systems/fated/templates/actor/npc-sheet.hbs"
    }
  };
}
