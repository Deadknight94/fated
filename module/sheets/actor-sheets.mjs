import { equipmentView, toggleEquipment } from "../equipment.mjs";
import { openMobileSheet } from "./mobile-sheet.mjs";
import { DECLARATION_STANCES } from "../declaration/evaluate.mjs";
import { healthView } from "../health.mjs";
import { healthAction } from "./health-controls.mjs";
import { calculateDefense } from "../defense.mjs";
import { openDamageBookkeeping } from "./damage-bookkeeping.mjs";
import { openRestApp } from "../apps/rest-app.mjs";

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
      items: this.document.items.contents.map(equipmentView),
      editable: this.isEditable,
      healthState: healthView(this.document, { isGM: game.user.isGM }),
      ...(this.document.type === "fated" ? { defense: calculateDefense(this.document), isGM: game.user.isGM } : {}),
      ...(this.document.type === "fated" ? { currentStances: DECLARATION_STANCES.map(value => ({ value,
        label: value[0].toUpperCase() + value.slice(1), selected: value === this.document.system.currentStance })) } : {})
    };
  }
}

export class FatedActorSheet extends BaseFatedActorSheet {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    actions: { toggleEquipment, openRest: function () { return openRestApp(this.document); }, openMobile: function () { return openMobileSheet(this.document); }, health: healthAction, openDamage: openDamageBookkeeping },
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
      template: "systems/fated/templates/actor/fated-sheet.hbs",
      templates: ["systems/fated/templates/actor/health-state.hbs", "systems/fated/templates/actor/defense.hbs"]
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
