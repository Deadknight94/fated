import { uiText, systemMessage } from "../presentation/text.mjs";
import { displayLabel, skillGroupsView, localizedHealth, localizedEquipment, modifierLabel, defenseView, rangeLabel, declarationIssuesView } from "../presentation/labels.mjs";
import { equipmentView } from "../equipment.mjs";
import { toggleEquipment } from "./equipment-controls.mjs";
import { normalizeProficiencyKey, hasDuplicateKey } from "../helpers/proficiency-keys.mjs";
import { calculateActorAction, healthView } from "../health.mjs";
import { formatDiceSourceLabel } from "../helpers/dice-source-label.mjs";
import { healthAction } from "./health-controls.mjs";
import { getDeclarationEvaluation, updateDeclaration } from "../declaration/service.mjs";
import { DECLARATION_STANCES, powerActionAdditionIssue } from "../declaration/evaluate.mjs";
import { adjustResource } from "../resources.mjs";
import { calculateDefense, actionDamage } from "../defense.mjs";
import { openRestApp } from "../apps/rest-app.mjs";
import { buildSkillGroups } from "../skills.mjs";
import { LocalizedSheetMixin } from "../presentation/sheet-mixin.mjs";
import { ProficiencySheetMixin, captureProficiencyDetails, restoreProficiencyDetails } from "./proficiency-controls.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const displayNumber = value => Number.isFinite(value) ? String(value) : uiText("Unspecified");

function breakdownView(value) {
  return { base: displayNumber(value.base), total: displayNumber(value.total), complete: value.complete,
    modifiers: value.modifiers.map(modifier => ({
      label: modifierLabel(modifier),
      value: Number.isFinite(modifier.value) ? `${modifier.value >= 0 ? "+" : ""}${modifier.value}` : uiText("Unspecified")
    })) };
}

export class FatedMobileSheet extends ProficiencySheetMixin(LocalizedSheetMixin(HandlebarsApplicationMixin(ActorSheetV2))) {
  static DEFAULT_OPTIONS = {
    classes: ["fated", "sheet", "fated-mobile"], tag: "form",
    position: { width: 760, height: 780 },
    window: { title: "FATED.Sheets.Mobile", resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      toggleEquipment,
      showSection: FatedMobileSheet.showSection,
      openItem: FatedMobileSheet.openItem,
      planner: FatedMobileSheet.planner,
      adjustResource: FatedMobileSheet.adjustResource,
      health: healthAction,
      openRest: FatedMobileSheet.openRest,
      addProficiency: FatedMobileSheet.addProficiency,
      removeProficiency: FatedMobileSheet.removeProficiency,
      removeItem: FatedMobileSheet.removeItem
    }
  };

  static async removeItem(event, button) {
    if (!this.isEditable) return;

    await this.submit();

    const id = button.dataset.itemId;
    if (!id) return;

    await this.document.deleteEmbeddedDocuments("Item", [id]);
  }

  static PARTS = { main: { template: "systems/fated/templates/actor/mobile-sheet.hbs",
    templates: ["systems/fated/templates/actor/turn-planner.hbs", "systems/fated/templates/actor/health-state.hbs", "systems/fated/templates/actor/defense.hbs"], scrollable: [".mobile-content"] } };

  section = "character";

  async _preRender(context, options) {
    // Preserve scroll position
    this._scrollPosition = this.element?.querySelector(".mobile-content")?.scrollTop ?? 0;
    captureProficiencyDetails(this);
    // Preserve planner detail open state
    this.openPlannerDetails = new Set([...(this.element?.querySelectorAll("details[open][data-planner-detail]") ?? [])]
      .map(element => element.dataset.plannerDetail));
    await super._preRender(context, options);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    restoreProficiencyDetails(this);
    for (const element of this.element.querySelectorAll("details[data-planner-detail]")) {
      element.open = this.openPlannerDetails?.has(element.dataset.plannerDetail) ?? false;
    }
    if (this._scrollPosition !== undefined && this.element) {
      this.element.querySelector(".mobile-content")?.scrollTo({ top: this._scrollPosition });
    }
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const declaration = this.document.system.declaration.toObject();
    const evaluation = getDeclarationEvaluation(this.document);
    const actions = this.document.getAvailableActions().map(action => {
      const calculation = calculateActorAction(this.document, action);
      const range = rangeLabel(action.range);
      return { ...action,
        damagePerSuccess: actionDamage(action, this.document.items.get(action.source.itemId)),
        hasDamage: actionDamage(action, this.document.items.get(action.source.itemId)) !== null,
        additionIssue: evaluation.locked ? null : systemMessage(powerActionAdditionIssue(action, evaluation)),
        name: action.name || uiText("Unnamed Action"),
        rollRequirementLabel: action.rollRequirement ? displayLabel("rollRequirement", action.rollRequirement) : uiText("Roll requirement unspecified"),
        classificationLabel: displayLabel("classification", action.classification), attackLabel: displayLabel("attack", action.attackType), rangeLabel: range,
        stanceLabel: action.allowedStances.length ? action.allowedStances.map(value => displayLabel("stance", value)).join(", ") : uiText("Unspecified"),
        eligibilityLabel: uiText(action.multiActionEligible === null ? "Unspecified" : action.multiActionEligible ? "Yes" : "No"),
        diceSourceLabel: formatDiceSourceLabel(action, calculation, this.document),
        dice: breakdownView(calculation.successDice), threshold: breakdownView(calculation.successThreshold),
        thresholdReviewIssue: systemMessage(calculation.successThreshold.reviewIssue)
      };
    });
    const planner = { ...evaluation, revision: declaration.revision, stanceLabel: displayLabel("stance", declaration.stance),
      issues: declarationIssuesView(evaluation),
      stanceChosen: Boolean(declaration.stance),
      stances: DECLARATION_STANCES.map(value => ({ value, label: displayLabel("stance", value), selected: value === declaration.stance })),
      canAddMovement: !evaluation.locked && evaluation.movementCount === 0 && Boolean(declaration.stance),
      entries: evaluation.entries.map((entry, index, all) => ({ ...entry, number: index + 1,
        movement: entry.kind === "movement", name: entry.action?.name || uiText("Missing or unnamed Action"),
        classificationLabel: displayLabel("classification", entry.action?.classification),
        requiresRoll: entry.action?.rollRequirement === "required", noRoll: entry.action?.rollRequirement === "none",
        dice: entry.calculation ? breakdownView(entry.calculation.successDice) : null,
        threshold: entry.calculation ? breakdownView(entry.calculation.successThreshold) : null,
        diceSourceLabel: formatDiceSourceLabel(entry.action, entry.calculation, this.document),
        rangeLabel: entry.action ? rangeLabel(entry.action.range) : "",
        canMoveUp: index > 0, canMoveDown: index < all.length - 1, completed: declaration.completed.includes(entry.id)
      })) };
    return { ...context, actor: this.document, system: this.document.system, editable: this.isEditable, actions, planner, skills: skillGroupsView(buildSkillGroups(this.document.system.skills)),
      canEditProficiencyKeys: game.user.isGM && this.isEditable,
      healthState: localizedHealth(healthView(this.document, { isGM: game.user.isGM })),
      defense: defenseView(calculateDefense(this.document)),
      currentStances: DECLARATION_STANCES.map(value => ({ value, label: displayLabel("stance", value), selected: value === this.document.system.currentStance })),
      items: this.document.items.contents.map(item => localizedEquipment(equipmentView(item))),
      sections: ["character", "turn", "actions", "items"].map(id => ({ id, label: displayLabel("section", id), active: id === this.section })),
      character: this.section === "character", turn: this.section === "turn",
      actionsView: this.section === "actions", itemsView: this.section === "items" };
  }

  static async showSection(event, button) {
    const section = button.dataset.section;
    if (!["character", "turn", "actions", "items"].includes(section) || section === this.section) return;

    if (this.isEditable) await this.submit();


    this._scrollPosition = 0;
    this.section = section;
    await this.render({ force: true });
  }

  static openItem(event, button) {
    this.document.items.get(button.dataset.itemId)?.sheet.render({ force: true });
  }

  static async openRest(event, button) {
    return openRestApp(this.document);
  }

  static async adjustResource(event, button) {
    if (!this.isEditable || this.resourcePending) return;
    this.resourcePending = true;
    try {
      await adjustResource(this.document, button.dataset.resource, Number(button.dataset.delta));
    } catch (error) {
      ui.notifications.warn(systemMessage(error.message));
    } finally {
      this.resourcePending = false;
    }
  }

  static async planner(event, button) {
    if (!this.isEditable || this.plannerPending) return;
    const revision = Number(button.closest("[data-declaration-revision]").dataset.declarationRevision);
    const { operation: type, stance, kind, itemId, actionId, entryId, direction } = button.dataset;
    this.plannerPending = true;
    try {
      await updateDeclaration(this.document, revision, { type, stance, kind, itemId, actionId, entryId, direction: Number(direction) });
    } catch (error) {
      ui.notifications.warn(systemMessage(error.message));
    } finally {
      this.plannerPending = false;
      await this.render({ force: true });
    }
  }
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
    await dialog;
  }

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

export function openMobileSheet(actor) {
  const existing = Object.values(actor.apps).find(app => app instanceof FatedMobileSheet);
  return (existing ?? new FatedMobileSheet({ document: actor })).render({ force: true });
}
