import { equipmentView, toggleEquipment } from "../equipment.mjs";
import { calculateActorAction, healthView } from "../health.mjs";
import { healthAction } from "./health-controls.mjs";
import { getDeclarationEvaluation, updateDeclaration } from "../declaration/service.mjs";
import { DECLARATION_STANCES, powerActionAdditionIssue } from "../declaration/evaluate.mjs";
import { adjustResource } from "../resources.mjs";
import { calculateDefense, actionDamage } from "../defense.mjs";
import { openRestApp } from "../apps/rest-app.mjs";
import { buildSkillGroups } from "../skills.mjs";

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
    actions: { toggleEquipment, showSection: FatedMobileSheet.showSection, openItem: FatedMobileSheet.openItem,
      planner: FatedMobileSheet.planner, adjustResource: FatedMobileSheet.adjustResource, health: healthAction, openRest: FatedMobileSheet.openRest,
      // Proficiency mutation actions
      addProficiency: FatedMobileSheet.addProficiency,
      removeProficiency: FatedMobileSheet.removeProficiency }
  };

  static PARTS = { main: { template: "systems/fated/templates/actor/mobile-sheet.hbs",
    templates: ["systems/fated/templates/actor/turn-planner.hbs", "systems/fated/templates/actor/health-state.hbs", "systems/fated/templates/actor/defense.hbs"], scrollable: [".mobile-content"] } };

  section = "character";

  async _preRender(context, options) {
    this.openPlannerDetails = new Set([...(this.element?.querySelectorAll("details[open][data-planner-detail]") ?? [])]
      .map(element => element.dataset.plannerDetail));
    await super._preRender(context, options);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    for (const element of this.element.querySelectorAll("details[data-planner-detail]")) {
      element.open = this.openPlannerDetails?.has(element.dataset.plannerDetail) ?? false;
    }
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const declaration = this.document.system.declaration.toObject();
    const evaluation = getDeclarationEvaluation(this.document);
    const actions = this.document.getAvailableActions().map(action => {
      const calculation = calculateActorAction(this.document, action);
      const range = action.range.min === null && action.range.max === null ? "Unspecified"
        : `${action.range.min ?? "?"}–${action.range.max ?? "?"}${action.range.units ? ` ${action.range.units}` : " (units unspecified)"}`;
      return { ...action,
        damagePerSuccess: actionDamage(action, this.document.items.get(action.source.itemId)),
        hasDamage: actionDamage(action, this.document.items.get(action.source.itemId)) !== null,
        additionIssue: evaluation.locked ? null : powerActionAdditionIssue(action, evaluation),
        name: action.name || "Unnamed Action",
        rollRequirementLabel: action.rollRequirement === "required" ? "Requires Roll" : action.rollRequirement === "none" ? "No Roll" : "Roll requirement unspecified",
        classificationLabel: label(action.classification), attackLabel: label(action.attackType), rangeLabel: range,
        stanceLabel: action.allowedStances.length ? action.allowedStances.map(label).join(", ") : "Unspecified",
        eligibilityLabel: action.multiActionEligible === null ? "Unspecified" : action.multiActionEligible ? "Yes" : "No",
        diceSourceLabel: label(action.successDice.source),
        dice: breakdownView(calculation.successDice), threshold: breakdownView(calculation.successThreshold),
        thresholdReviewIssue: calculation.successThreshold.reviewIssue
      };
    });
    const planner = { ...evaluation, revision: declaration.revision, stanceLabel: label(declaration.stance),
      stanceChosen: Boolean(declaration.stance),
      stances: DECLARATION_STANCES.map(value => ({ value, label: label(value), selected: value === declaration.stance })),
      canAddMovement: !evaluation.locked && evaluation.movementCount === 0 && Boolean(declaration.stance),
      entries: evaluation.entries.map((entry, index, all) => ({ ...entry, number: index + 1,
        movement: entry.kind === "movement", name: entry.action?.name || "Missing or unnamed Action",
        classificationLabel: label(entry.action?.classification),
        requiresRoll: entry.action?.rollRequirement === "required", noRoll: entry.action?.rollRequirement === "none",
        dice: entry.calculation ? breakdownView(entry.calculation.successDice) : null,
        threshold: entry.calculation ? breakdownView(entry.calculation.successThreshold) : null,
        diceSourceLabel: label(entry.action?.successDice?.source),
        rangeLabel: entry.action ? `${entry.action.range.min ?? "?"}–${entry.action.range.max ?? "?"} ${entry.action.range.units || "(units unspecified)"}` : "",
        canMoveUp: index > 0, canMoveDown: index < all.length - 1, completed: declaration.completed.includes(entry.id)
      })) };
    return { ...context, actor: this.document, system: this.document.system, editable: this.isEditable, actions, planner, skills: buildSkillGroups(this.document.system.skills),
      healthState: healthView(this.document, { isGM: game.user.isGM }),
      defense: calculateDefense(this.document),
      currentStances: DECLARATION_STANCES.map(value => ({ value, label: label(value), selected: value === this.document.system.currentStance })),
      items: this.document.items.contents.map(equipmentView),
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

  static async openRest(event, button) {
    return openRestApp(this.document);
  }

  static async adjustResource(event, button) {
    if (!this.isEditable || this.resourcePending) return;
    this.resourcePending = true;
    try {
      await adjustResource(this.document, button.dataset.resource, Number(button.dataset.delta));
    } catch (error) {
      ui.notifications.warn(error.message);
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
      ui.notifications.warn(error.message);
    } finally {
      this.plannerPending = false;
      await this.render({ force: true });
    }
  }
  static async addProficiency() {
    if (!this.isEditable) return;

    await this.submit();

    const profs = this.document.system.proficiencies ?? [];
    const newProf = {
      key: `proficiency-${foundry.utils.randomID()}`,
      displayName: "New Proficiency",
      attribute: "body",
      level: 0
    };

    await this.document.update({
      "system.proficiencies": [...profs, newProf]
    });
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
