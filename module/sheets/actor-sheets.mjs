import { equipmentView, toggleEquipment } from "../equipment.mjs";
import { normalizeProficiencyKey, hasDuplicateKey } from "../helpers/proficiency-keys.mjs";
import { openMobileSheet } from "./mobile-sheet.mjs";
import { DECLARATION_STANCES } from "../declaration/evaluate.mjs";
import { healthView } from "../health.mjs";
import { healthAction } from "./health-controls.mjs";
import { calculateDefense } from "../defense.mjs";
import { openDamageBookkeeping } from "./damage-bookkeeping.mjs";
import { openRestApp } from "../apps/rest-app.mjs";
import { buildSkillGroups } from "../skills.mjs";

const STANCE_LOCALIZATION_KEYS = {
  offensive: "FATED.Stance.Offensive",
  neutral: "FATED.Stance.Neutral",
  defensive: "FATED.Stance.Defensive",
  ranged: "FATED.Stance.Ranged"
};

const ATTRIBUTE_LOCALIZATION_KEYS = {
  body: "FATED.Attribute.Body",
  mind: "FATED.Attribute.Mind",
  heart: "FATED.Attribute.Heart"
};

const SKILL_LOCALIZATION_KEYS = {
  awe: "FATED.Skill.Awe",
  athletics: "FATED.Skill.Athletics",
  huntingForaging: "FATED.Skill.HuntingForaging",
  travel: "FATED.Skill.Travel",
  craft: "FATED.Skill.Craft",
  finesse: "FATED.Skill.Finesse",
  persuade: "FATED.Skill.Persuade",
  stealth: "FATED.Skill.Stealth",
  perception: "FATED.Skill.Perception",
  explore: "FATED.Skill.Explore",
  reason: "FATED.Skill.Reason",
  lore: "FATED.Skill.Lore",
  enhearten: "FATED.Skill.Enhearten",
  leadership: "FATED.Skill.Leadership",
  insight: "FATED.Skill.Insight",
  healing: "FATED.Skill.Healing",
  diplomacy: "FATED.Skill.Diplomacy",
  deceive: "FATED.Skill.Deceive"
};

const ITEM_TYPE_LOCALIZATION_KEYS = {
  armor: "FATED.ItemType.Armor",
  weapon: "FATED.ItemType.Weapon",
  equipment: "FATED.ItemType.Equipment"
};

const EQUIPMENT_STATE_LOCALIZATION_KEYS = {
  armor: "FATED.Common.Worn",
  weapon: "FATED.Common.Equipped",
  equipment: "FATED.Common.Equipped"
};

const WOUND_LOCALIZATION_KEYS = {
  0: "FATED.Health.Healthy",
  1: "FATED.Health.LightWound",
  2: "FATED.Health.GrievousWound",
  3: "FATED.Health.DeathsDoor",
  4: "FATED.Health.Dead"
};

const HEALTH_CONDITION_LOCALIZATION_KEYS = {
  overburdened: "FATED.Health.Overburdened",
  exhausted: "FATED.Health.Exhausted",
  inspired: "FATED.Health.Inspired",
  despondent: "FATED.Health.Despondent",
  broken: "FATED.Health.Broken",
  incapacitated: "FATED.Health.Incapacitated",
  dead: "FATED.Health.Dead"
};

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
  ? buildSkillGroups(this.document.system.skills).map(group => ({
      ...group,
      label: game.i18n.localize(ATTRIBUTE_LOCALIZATION_KEYS[group.attribute]),
      skills: group.skills.map(skill => ({
        ...skill,
        label: game.i18n.localize(SKILL_LOCALIZATION_KEYS[skill.key])
      }))
    }))
  : [];

const baseHealthState = healthView(this.document, { isGM: game.user.isGM });

const healthState = baseHealthState
  ? {
      ...baseHealthState,
      woundLabel: game.i18n.localize(WOUND_LOCALIZATION_KEYS[baseHealthState.severity]),
      conditions: [
        baseHealthState.overburdened &&
          `${game.i18n.localize(HEALTH_CONDITION_LOCALIZATION_KEYS.overburdened)} (+1)`,
        baseHealthState.exhausted &&
          `${game.i18n.localize(HEALTH_CONDITION_LOCALIZATION_KEYS.exhausted)} (+1)`,
        baseHealthState.inspired &&
          `${game.i18n.localize(HEALTH_CONDITION_LOCALIZATION_KEYS.inspired)} (−1)`,
        baseHealthState.despondent &&
          `${game.i18n.localize(HEALTH_CONDITION_LOCALIZATION_KEYS.despondent)} (+1)`,
        baseHealthState.broken &&
          game.i18n.localize(HEALTH_CONDITION_LOCALIZATION_KEYS.broken),
        baseHealthState.incapacitated &&
          game.i18n.localize(HEALTH_CONDITION_LOCALIZATION_KEYS.incapacitated),
        baseHealthState.dead &&
          game.i18n.localize(HEALTH_CONDITION_LOCALIZATION_KEYS.dead)
      ].filter(Boolean)
    }
  : null;

return {
      ...context,
      actor: this.document,
      system: this.document.system,
      items: this.document.items.contents.map(item => {
       const view = equipmentView(item);

      return {
          ...view,
          typeLabel: ITEM_TYPE_LOCALIZATION_KEYS[item.type]
            ? game.i18n.localize(ITEM_TYPE_LOCALIZATION_KEYS[item.type])
            : item.type,
          stateLabel: EQUIPMENT_STATE_LOCALIZATION_KEYS[item.type]
            ? game.i18n.localize(EQUIPMENT_STATE_LOCALIZATION_KEYS[item.type])
            : view.stateLabel
        };
      }),
      editable: this.isEditable,
      healthState,
      skills,
      ...(this.document.type === "fated" ? { defense: calculateDefense(this.document), isGM: game.user.isGM } : {}),
      ...(this.document.type === "fated" ? { currentStances: DECLARATION_STANCES.map(value => ({ value,
        label: game.i18n.localize(STANCE_LOCALIZATION_KEYS[value]), selected: value === this.document.system.currentStance })) } : {}),
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
   * Preserve scroll position across renders.
   * Capture before the sheet renders, then restore after rendering.
   */
  async _preRender(context, options) {
  this._scrollPosition =
    this.element?.querySelector(".window-content")?.scrollTop ?? 0;

    await super._preRender(context, options);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

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
     window: { title: "Add Proficiency" },
     content: `
       <div class="form-group">
         <label>Display Name</label>
         <div class="form-fields">
           <input type="text" name="name" required autofocus>
         </div>
       </div>
     `,
     ok: {
       label: "Add Proficiency"
     }
   });

   if (!data) return;

   const name = String(data.name ?? "").trim();
   if (!name) return;

   const key = normalizeProficiencyKey(name);

   if (!key) {
     ui.notifications.warn("Invalid proficiency name.");
     return;
   }

   const profs = this.document.system.proficiencies ?? [];

   if (hasDuplicateKey(profs, key)) {
     ui.notifications.warn(`Proficiency ${key} already exists.`);
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
