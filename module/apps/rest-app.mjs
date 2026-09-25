import { uiText, systemMessage } from "../presentation/text.mjs";
import { displayLabel, localizedHealth } from "../presentation/labels.mjs";
import { healthView } from "../health.mjs";
import { shortRest } from "../rest/short-rest.mjs";
import { longRest } from "../rest/long-rest.mjs";
import { beginExtendedRest, completeExtendedRestDay, completeExtendedRestGrievousHealing } from "../rest/extended-rest.mjs";
import { advanceWoundCareDay } from "../rest/wound-care-day.mjs";
const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class RestApp extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor({ document: actor, ...options } = {}) {
    if (actor?.type !== "fated") throw new Error("RestApp can only be opened for fated actors");
    super({ ...options, id: `fated-rest-${actor.id ?? actor.uuid}` });
    this.document = actor;
  }
  static DEFAULT_OPTIONS = {
    classes: ["fated", "rest-app"], tag: "div",
    position: { width: 480, height: 720 }, window: { title: "FATED.Common.Rest", resizable: true },
    actions: { shortRest: function () { return this.perform(shortRest, this.shortOptions()); },
      longRest: function () { return this.perform(longRest, this.healingOptions("longHealing")); },
      beginExtended: function () { return this.perform(beginExtendedRest); },
      completeExtendedDay: function () { return this.perform(completeExtendedRestDay, this.healingOptions("extendedHealing")); },
      advanceCareDay: function () { return this.perform(advanceWoundCareDay); },
      completeGrievousHealing: function () { return this.perform(completeExtendedRestGrievousHealing); } }
  };
  static PARTS = { main: { template: "systems/fated/templates/actor/rest-app.hbs", scrollable: [".rest-content"] } };
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    this.document.apps[this.id] = this;
  }
  _onClose(options) {
    super._onClose(options);
    delete this.document.apps[this.id];
  }
  values = { spendHope: false, extraRecovery: "1", shortHealing: "", longHealing: "", extendedHealing: "" };
  pending = false;
  async _onRender(context, options) {
    await super._onRender(context, options);
    for (const input of this.element.querySelectorAll("[data-rest-field]")) {
      input.addEventListener("input", () => { this.values[input.dataset.restField] = input.type === "checkbox" ? input.checked : input.value; });
      if (input.type === "checkbox") input.addEventListener("change", () => this.render({ force: true }));
    }
  }
  healingOptions(field) {
    if (this.element?.querySelector(`[data-rest-field="${field}"]`)?.validity.badInput) return { healingSuccesses: NaN };
    const value = this.values[field].trim();
    return value === "" ? {} : { healingSuccesses: Number(value) };
  }
  shortOptions() {
    return { ...this.healingOptions("shortHealing"), spendHope: this.values.spendHope,
      ...(this.values.spendHope ? { extraRecovery: Number(this.values.extraRecovery) } : {}) };
  }
  async perform(service, options) {
    if (this.pending) return false;
    if (!this.document.isOwner) { ui.notifications.warn(uiText("You cannot update this Actor.")); return false; }
    this.pending = true;
    try {
      await this.render({ force: true });
      if (!await service(this.document, options)) { ui.notifications.warn(uiText("Rest request rejected. Check the entered values and wound state.")); return false; }
      return true;
    } catch (error) {
      ui.notifications.warn(systemMessage(error.message));
      return false;
    } finally {
      this.pending = false;
      await this.render({ force: true });
    }
  }
  async _prepareContext() {
    const { resources } = this.document.system;
    const { health } = this.document.system;
    return { actor: this.document, editable: this.document.isOwner && !this.pending, values: this.values,
      spendHope: this.values.spendHope,
      extraChoices: Array.from({ length: this.document.system.attributes.heart }, (_, i) => ({ value: i+1, selected: Number(this.values.extraRecovery) === i+1 })),
      canCompletePending: this.document.isOwner && !this.pending && health.woundSeverity === 2
        && health.woundCare.care === "grievousHealingPending" && health.woundCare.daysRemaining === 0,
      endurance: { current: resources.endurance.value, max: resources.endurance.max },
      hope: { current: resources.hope.value, limit: resources.hope.max },
      // Power maximum derived from Heart + Body + Mind
      power: {
        current: resources.power,
        // The power maximum is derived from the actor's attributes
        max: this.document.system.attributes.heart + this.document.system.attributes.body + this.document.system.attributes.mind,
      },
      wound: localizedHealth(healthView(this.document)),
      woundCare: this.document.system.health.woundCare,
      careLabel: displayLabel("care", this.document.system.health.woundCare.care) };
  }
}
export async function openRestApp(actor) {
  const existing = Object.values(actor.apps).find(app => app instanceof RestApp);
  const app = existing ?? new RestApp({ document: actor });
  // Reserve the document application while first rendering, including rapid repeated taps.
  actor.apps[app.id] = app;
  try { await app.render({ force: true }); }
  catch (error) { if (!app.rendered) delete actor.apps[app.id]; throw error; }
  return app;
}
