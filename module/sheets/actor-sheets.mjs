import { equipmentView, toggleEquipment } from "../equipment.mjs";
import { openMobileSheet } from "./mobile-sheet.mjs";
import { DECLARATION_STANCES } from "../declaration/evaluate.mjs";
import { healthView } from "../health.mjs";
import { healthAction } from "./health-controls.mjs";
import { calculateDefense } from "../defense.mjs";
import { openDamageBookkeeping } from "./damage-bookkeeping.mjs";
import { openRestApp } from "../apps/rest-app.mjs";
import { buildSkillGroups } from "../skills.mjs";

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
    const skills = this.document.type === "fated"
  ? buildSkillGroups(this.document.system.skills)
  : [];
    return {
      ...context,
      actor: this.document,
      system: this.document.system,
      items: this.document.items.contents.map(equipmentView),
      editable: this.isEditable,
      healthState: healthView(this.document, { isGM: game.user.isGM }),
      skills,
      ...(this.document.type === "fated" ? { defense: calculateDefense(this.document), isGM: game.user.isGM } : {}),
      ...(this.document.type === "fated" ? { currentStances: DECLARATION_STANCES.map(value => ({ value,
        label: value[0].toUpperCase() + value.slice(1), selected: value === this.document.system.currentStance })) } : {}),
      ...(this.document.type === "fated" ? { powerMax: this.document.system.attributes.heart + this.document.system.attributes.body + this.document.system.attributes.mind } : {})
    };
  }
}

export class FatedActorSheet extends BaseFatedActorSheet {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    actions: {
      toggleEquipment,
      openRest: function () { return openRestApp(this.document); },
      openMobile: function () { return openMobileSheet(this.document); },
      health: healthAction,
      openDamage: openDamageBookkeeping,
      // Proficiency mutation actions
      addProficiency: FatedActorSheet.addProficiency,
      removeProficiency: FatedActorSheet.removeProficiency
    },
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

  /* ---------- Proficiency mutation helpers ---------- */
  /**
   * Add a new proficiency entry with a unique technical key.
   * The entry is added to the actor's system.proficiencies array.
   * No UI is directly edited; the form submit will persist the new entry.
   */
  static async addProficiency() {
  if (!this.isEditable) return;

  await this.submit();

  const newProf = {
    key: `proficiency-${foundry.utils.randomID()}`,
    displayName: "New Proficiency",
    attribute: "body",
    level: 0
  };

  const profs = this.document.system.proficiencies ?? [];
  await this.document.update({
    "system.proficiencies": [...profs, newProf]
  });
}

  /**
   * Remove a proficiency identified by its stable key.
   * The `event` is expected to originate from a button with `data-proficiency-key`.
   */
  static async removeProficiency(event, button) {
  if (!this.isEditable) return;

  await this.submit();

  const key = button.dataset.proficiencyKey;
  if (!key) return;

  const profs = this.document.system.proficiencies ?? [];
  const updated = profs.filter(prof => prof.key !== key);

  await this.document.update({
    "system.proficiencies": updated
  });
 }
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
