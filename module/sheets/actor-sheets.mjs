/**
 * @file Desktop Fated and simplified NPC sheet/controllers using Foundry ActorSheetV2.
 * Build localized presentation models and route edits to Documents/shared controls.
 * The Fated desktop has global modifier editing; both sheets share the planner.
 * NPC views do not acquire Fated health, stance or declaration mechanics.
 */
import { uiText, systemMessage } from "../presentation/text.mjs";
import { displayLabel, skillGroupsView, localizedHealth, localizedEquipment, defenseView, rangeLabel } from "../presentation/labels.mjs";
import { LocalizedSheetMixin } from "../presentation/sheet-mixin.mjs";
import { equipmentView } from "../equipment.mjs";
import { toggleEquipment } from "./equipment-controls.mjs";
import { normalizeProficiencyKey, hasDuplicateKey } from "../helpers/proficiency-keys.mjs";
import { openMobileSheet } from "./mobile-sheet.mjs";
import { adjustResource } from "../resources.mjs";
import { DECLARATION_STANCES, powerActionAdditionIssue } from "../declaration/evaluate.mjs";
import { changeManualModifier, manualModifierAction } from "./manual-modifier-controls.mjs";
import { plannerView } from "../presentation/planner.mjs";
import { getDeclarationEvaluation, updateDeclaration } from "../declaration/service.mjs";
import { availableActionsView } from "../presentation/actions.mjs";
import { rollSummary, signedModifier } from "../presentation/roll-summary.mjs";
import { healthView } from "../health.mjs";
import { healthAction } from "./health-controls.mjs";
import { calculateDefense } from "../defense.mjs";
import { openDamageBookkeeping } from "./damage-bookkeeping.mjs";
import { openRestApp } from "../apps/rest-app.mjs";
import { buildSkillGroups } from "../skills.mjs";
import { ProficiencySheetMixin, captureProficiencyDetails, restoreProficiencyDetails } from "./proficiency-controls.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/** Shared submit-on-change shell and read-only context for both Actor types. */
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
      ...(this.document.type === "fated" ? { powerMax: this.document.system.attributes.heart + this.document.system.attributes.body + this.document.system.attributes.mind } : {})
    };
  }
}

/** Desktop tab ids; the first entry is the section a freshly opened sheet shows. */
const FATED_SECTIONS = ["character", "turn", "actions", "items", "notes"];

/**
 * Desktop Fated controller with health, rest, damage and manual-modifier controls.
 * _prepareContext reads services; form/actions persist through Foundry Documents.
 * The Turn Planner delegates to the same presentation and services as mobile.
 */
export class FatedActorSheet extends ProficiencySheetMixin(BaseFatedActorSheet) {
  /** Selected desktop tab. Sheet-instance state only, never Actor data. */
  _fatedSection = "character";
  actionPickerOpen = false;

  /** Add the mobile entry to Foundry's native menu, retaining inherited controls. */
  _getHeaderControls() {
    return [...super._getHeaderControls(), {
      action: "openMobile",
      label: "FATED.Sheet.OpenMobile",
      icon: "fa-solid fa-mobile-screen-button"
    }];
  }

  async _prepareContext(options) {
    const section = FATED_SECTIONS.includes(this._fatedSection) ? this._fatedSection : "character";
    const actions = availableActionsView(this.document);
    let turnContext = {};
    if (section === "turn") {
      const declaration = this.document.system.declaration.toObject();
      const evaluation = getDeclarationEvaluation(this.document);
      turnContext = { planner: plannerView(this.document, { declaration, evaluation,
        actionPickerOpen: this.actionPickerOpen, actionPickerId: `${this.id}-desktop-action-picker` }),
        actions: actions.map(action => ({ ...action,
          additionIssue: evaluation.locked ? null : systemMessage(powerActionAdditionIssue(action, evaluation))
        })) };
    }
    return { ...await super._prepareContext(options), canEditProficiencyKeys: game.user.isGM && this.isEditable,
      rollSummary: rollSummary(this.document), manualModifiers: this.document.system.manualRollModifiers.map(entry =>
        ({ ...entry, signedValue: signedModifier(entry.value) })),
      currentStances: DECLARATION_STANCES.map(value => ({ value, label: displayLabel("stance", value), selected: value === this.document.system.currentStance })),
      actions, actionsSection: section === "actions",
      itemsSection: section === "items", notesSection: section === "notes",
      turnSection: section === "turn", ...turnContext };
  }

  async _onChangeForm(formConfig, event) {
    const input = event.target;
    if (!input.matches?.("[data-modifier-field]")) return super._onChangeForm(formConfig, event);
    const field = input.dataset.modifierField;
    try {
      const changed = await changeManualModifier(this, { type: "edit", id: input.dataset.modifierId, field,
        value: field === "value" ? (input.value.trim() ? Number(input.value) : NaN) : input.value });
      // Successful Actor updates already rerender, preserving the existing scroll lifecycle.
      if (!changed) await this.render({ force: true });
    } catch (error) {
      ui.notifications.warn(systemMessage(error.message));
      await this.render({ force: true });
    }
  }

  /**
   * Switch the desktop tab (Character / Turn / Actions / Items / Notes).
   * Pending form fields are submitted first so edits made in the section being left
   * are never dropped; the new section then starts at the top of its own content.
   * Only the sheet instance remembers the selection, never the Actor document.
   */
  static async selectSection(event, button) {
    const section = button?.dataset?.section;
    if (!FATED_SECTIONS.includes(section)) return;
    const previous = FATED_SECTIONS.includes(this._fatedSection) ? this._fatedSection : "character";
    if (this.isEditable) await this.submit();
    this._fatedSection = section;
    this._sectionChanged = section !== previous;
    await this.render({ force: true });
  }

  /** Save pending fields before adjusting; guard both submission and the service write. */
  static async adjustResource(event, button) {
    if (!this.isEditable || this.resourcePending) return;
    this.resourcePending = true;
    try {
      await this.submit();
      await adjustResource(this.document, button.dataset.resource, Number(button.dataset.delta));
    } catch (error) {
      ui.notifications.warn(systemMessage(error.message));
    } finally {
      this.resourcePending = false;
    }
  }

  /** Sheet-local expansion only: no submit or declaration operation. */
  static toggleActionPicker(event, button) {
    if (!this.isEditable || button.disabled) return;
    const picker = this.element.querySelector(".turn-picker");
    if (!picker) return;
    this.actionPickerOpen = !this.actionPickerOpen;
    picker.hidden = !this.actionPickerOpen;
    button.setAttribute("aria-expanded", String(this.actionPickerOpen));
  }

  /** Carry the rendered revision to the service; guard repeated taps in this sheet. */
  static async planner(event, button) {
    if (!this.isEditable || this.plannerPending) return;
    const revision = Number(button.closest("[data-declaration-revision]").dataset.declarationRevision);
    const { operation: type, stance, kind, itemId, actionId, entryId, direction, enduranceSpend } = button.dataset;
    this.plannerPending = true;
    try {
      await updateDeclaration(this.document, revision, { type, stance, kind, itemId, actionId, entryId, direction: Number(direction), enduranceSpend: Number(enduranceSpend) });
    } catch (error) {
      ui.notifications.warn(systemMessage(error.message));
    } finally {
      this.plannerPending = false;
      await this.render({ force: true });
    }
  }

  static openItem(event, button) {
    this.document.items.get(button.dataset.itemId)?.sheet.render({ force: true });
  }

  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    actions: {
      toggleEquipment,
      adjustResource: FatedActorSheet.adjustResource,
      openItem: FatedActorSheet.openItem,
      openRest: function () { return openRestApp(this.document); },
      openMobile: function () { return openMobileSheet(this.document); },
      health: healthAction,
      manualModifier: manualModifierAction,
      openDamage: openDamageBookkeeping,
      selectSection: FatedActorSheet.selectSection,
      planner: FatedActorSheet.planner,
      toggleActionPicker: FatedActorSheet.toggleActionPicker,
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
   * A tab switch is the one case where the old offset is wrong: the new section
   * starts at the top of its own content.
   */
  async _preRender(context, options) {
    this._scrollPosition =
      this.element?.querySelector(".window-content")?.scrollTop ?? 0;
    captureProficiencyDetails(this);
    if (this.element?.querySelector(".turn-planner")) {
      this.openPlannerDetails = new Set([...(this.element.querySelectorAll("details[open][data-planner-detail]") ?? [])]
        .map(element => element.dataset.plannerDetail));
    }

    await super._preRender(context, options);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    restoreProficiencyDetails(this);
    for (const element of this.element?.querySelectorAll("details[data-planner-detail]") ?? []) {
      element.open = this.openPlannerDetails?.has(element.dataset.plannerDetail) ?? false;
    }

    const scrollContainer = this.element?.querySelector(".window-content");
    if (!scrollContainer) return;

    if (this._sectionChanged) {
      delete this._sectionChanged;
      scrollContainer.scrollTop = 0;
      return;
    }

    if (this._scrollPosition === undefined) return;

    requestAnimationFrame(() => {
      scrollContainer.scrollTop = this._scrollPosition;
    });
  }

  static PARTS = {
    main: {
      id: "main",
      root: true,
      template: "systems/fated/templates/actor/fated-sheet.hbs",
      templates: ["systems/fated/templates/actor/turn-planner.hbs", "systems/fated/templates/actor/health-state.hbs", "systems/fated/templates/actor/defense.hbs"]
    }
  };

  /* ---------- Proficiency mutation helpers ---------- */
  /**
   * Add a new proficiency entry with a unique technical key.
   * The entry is added to the actor's system.proficiencies array.
   * Submit pending fields first, then persist the new array with Actor.update().
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

   // Existing unresolved dialog reference remains after the Actor write.
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
}
/**
 * Simplified NPC controller with local stats/actions/items/notes navigation.
 * Displays configured Item Actions without Fated calculations or a planner;
 * ordinary forms persist Resilience, Defense and description on the Actor.
 */
export class NpcActorSheet extends BaseFatedActorSheet {
  _npcSection = "stats";

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return { ...context,
      npcSections: ["stats", "actions", "items", "notes"].map(id => ({ id,
        label: id === "stats" ? game.i18n.localize("FATED.Npc.Stats")
          : id === "notes" ? game.i18n.localize("FATED.Npc.Notes") : displayLabel("section", id),
        active: id === this._npcSection })),
      npcStats: this._npcSection === "stats", npcActions: this._npcSection === "actions",
      npcItems: this._npcSection === "items", npcNotes: this._npcSection === "notes",
      actions: this.document.getAvailableActions().map(action => ({ ...action,
        name: action.name || uiText("Unnamed Action"),
        classificationLabel: displayLabel("classification", action.classification),
        attackLabel: action.attackType ? displayLabel("attack", action.attackType) : null,
        rollLabel: displayLabel("rollRequirement", action.rollRequirement),
        rangeLabel: action.range && (action.range.min !== null || action.range.max !== null || action.range.units)
          ? rangeLabel(action.range) : null
      }))
    };
  }

  static async selectNpcSection(event, button) {
    const section = button.dataset.section;
    if (!["stats", "actions", "items", "notes"].includes(section)) return;
    if (this.isEditable) await this.submit();
    this._npcSection = section;
    await this.render();
  }

  static openNpcItem(event, button) {
    return this.document.items.get(button.dataset.itemId)?.sheet.render(true);
  }

  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: [...super.DEFAULT_OPTIONS.classes, "npc-actor"],
    actions: { removeItem: NpcActorSheet.removeItem, selectNpcSection: NpcActorSheet.selectNpcSection, openNpcItem: NpcActorSheet.openNpcItem },
    window: {
      ...super.DEFAULT_OPTIONS.window,
      title: "FATED.Sheets.Npc"
    }
  };

  static PARTS = {
    main: {
      id: "main",
      root: true,
      template: "systems/fated/templates/actor/npc-sheet.hbs",
      scrollable: [".npc-content"]
    }
  };
}
