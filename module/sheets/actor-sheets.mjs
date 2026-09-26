import { uiText, systemMessage } from "../presentation/text.mjs";
import { displayLabel, skillGroupsView, localizedHealth, localizedEquipment, defenseView } from "../presentation/labels.mjs";
import { LocalizedSheetMixin } from "../presentation/sheet-mixin.mjs";
import { equipmentView } from "../equipment.mjs";
import { toggleEquipment } from "./equipment-controls.mjs";
import { normalizeProficiencyKey, hasDuplicateKey } from "../helpers/proficiency-keys.mjs";
import { openMobileSheet } from "./mobile-sheet.mjs";
import { DECLARATION_STANCES } from "../declaration/evaluate.mjs";
import { healthView } from "../health.mjs";
import { healthAction } from "./health-controls.mjs";
import { calculateDefense } from "../defense.mjs";
import { openDamageBookkeeping } from "./damage-bookkeeping.mjs";
import { openRestApp } from "../apps/rest-app.mjs";
import { buildSkillGroups } from "../skills.mjs";
import { ProficiencySheetMixin, captureProficiencyDetails, restoreProficiencyDetails } from "./proficiency-controls.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

class BaseFatedActorSheet extends LocalizedSheetMixin(HandlebarsApplicationMixin(ActorSheetV2)) {
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
      ? skillGroupsView(buildSkillGroups(this.document.system.skills)) : [];
    const healthState = localizedHealth(healthView(this.document, { isGM: game.user.isGM }));

    return {
      ...context,
      actor: this.document,
      system: this.document.system,
      items: this.document.items.contents.map(item => localizedEquipment(equipmentView(item))),
      editable: this.isEditable,
      healthState,
      skills,
      ...(this.document.type === "fated" ? { defense: defenseView(calculateDefense(this.document)), isGM: game.user.isGM } : {}),
      ...(this.document.type === "fated" ? { currentStances: DECLARATION_STANCES.map(value => ({ value,
        label: displayLabel("stance", value), selected: value === this.document.system.currentStance })) } : {}),
      ...(this.document.type === "fated" ? { powerMax: this.document.system.attributes.heart + this.document.system.attributes.body + this.document.system.attributes.mind } : {})
    };
  }
}

export class FatedActorSheet extends ProficiencySheetMixin(BaseFatedActorSheet) {
  async _prepareContext(options) {
    return { ...await super._prepareContext(options), canEditProficiencyKeys: game.user.isGM && this.isEditable };
  }

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
      removeProficiency: FatedActorSheet.removeProficiency,
      removeItem: FatedActorSheet.removeItem
    },
    classes: [...super.DEFAULT_OPTIONS.classes, "fated-actor"],
    window: {
      ...super.DEFAULT_OPTIONS.window,
      title: "FATED.Sheets.Fated"
    }
  };

  /**
   * Preserve scroll position and expanded proficiency rows across renders.
   * Capture before the sheet renders, then restore after rendering.
   */
  async _preRender(context, options) {
    this._scrollPosition =
      this.element?.querySelector(".window-content")?.scrollTop ?? 0;
    captureProficiencyDetails(this);

    await super._preRender(context, options);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    restoreProficiencyDetails(this);

    const scrollContainer = this.element?.querySelector(".window-content");
    if (!scrollContainer || this._scrollPosition === undefined) return;

    requestAnimationFrame(() => {
      scrollContainer.scrollTop = this._scrollPosition;
    });
  }

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
    const data = await foundry.applications.api.DialogV2.input({
     window: { title: uiText("Add Proficiency") },
     content: `
       <div class="form-group">
         <label>${uiText("Display Name")}</label>
         <div class="form-fields">
           <input type="text" name="name" required autofocus>
         </div>
       </div>
     `,
     ok: {
       label: uiText("Add Proficiency")
     }
   });

   if (!data) return;

   const name = String(data.name ?? "").trim();
   if (!name) return;

   const key = normalizeProficiencyKey(name);

   if (!key) {
     ui.notifications.warn(uiText("Invalid proficiency name."));
     return;
   }

   const profs = this.document.system.proficiencies ?? [];

   if (hasDuplicateKey(profs, key)) {
     ui.notifications.warn(uiText("Proficiency {key} already exists.", { key }));
     return;
   }

   const newProf = {
     key,
     displayName: name,
     attribute: "body",
     level: 0
   };

   await this.document.update({
     "system.proficiencies": [...profs, newProf]
   });

   // Await the dialog promise to keep the async flow consistent
    await dialog;
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

  /**
   * Remove an owned Item from the Actor.
   * Uses the stable document id from the data-item-id attribute.
   * Only deletes the embedded document; world items remain untouched.
   * Respect this.isEditable.
   */
  static async removeItem(event, button) {
    if (!this.isEditable) return;
    await this.submit();
    const id = button.dataset.itemId;
    if (!id) return;
    // deleteEmbeddedDocuments expects an array of ids
    await this.document.deleteEmbeddedDocuments("Item", [id]);
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
