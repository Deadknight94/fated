/**
 * @file GM physical-result controller for one Fated target. Holds transient inputs and
 * a reviewable preview; damage.mjs owns calculations and health.mjs owns Wound
 * updates. No canvas selection, digital dice or persistent damage-event log.
 */
import { uiText, systemMessage } from "../presentation/text.mjs";
import { modifierLabel, defenseView } from "../presentation/labels.mjs";
import { actionDamage } from "../defense.mjs";
import { previewDamage, applyDamage } from "../damage.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Target-centric GM bookkeeping window. Inputs are transient physical results, not Actor state.
 *
 * Preview is read-only; Apply checks current inputs/state against the reviewed
 * result before calling applyDamage. A successful application consumes the local
 * preview. The pending guard is per window, not cross-client transaction protection.
 */
export class DamageBookkeeping extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = { classes: ["fated", "damage-bookkeeping", "standard-form"], tag: "div",
    position: { width: 480, height: 620 }, window: { title: "FATED.Common.PhysicalDamage", resizable: true },
    actions: { preview: DamageBookkeeping.preview, apply: DamageBookkeeping.apply } };
  static PARTS = { main: { template: "systems/fated/templates/actor/damage-bookkeeping.hbs" } };

  constructor(target) { super(); this.target = target; this.values = { attack: "", successes: "0", finalDamage: "0" }; }

  /** Read visible Actor Actions with numeric Damage; not a target-legality check. */
  availableAttacks() {
    return game.actors.contents.filter(actor => actor.visible).flatMap(attacker =>
      (attacker.getAvailableActions?.() ?? []).flatMap(action => {
        const item = attacker.items.get(action.source.itemId);
        const damage = actionDamage(action, item);
        return damage === null ? [] : [{ key: `${attacker.id}:${item.id}:${action.id}`, attacker, action, item,
          label: `${attacker.name} · ${item.name} · ${action.name || uiText("Unnamed Action")} · ${uiText("Damage")} ${damage}` }];
      }));
  }

  async _prepareContext() {
    return { targetName: this.target.name, values: this.values, result: this.result ? { ...this.result, defense: defenseView(this.result.defense),
        finalDamageModifiers: this.result.finalDamageModifiers.map(modifier => ({ ...modifier, label: modifierLabel(modifier) })) } : null,
      message: systemMessage(this.message),
      attacks: this.availableAttacks().map(attack => ({ value: attack.key, label: attack.label, selected: attack.key === this.values.attack })),
      canApply: this.target.isOwner && this.result && this.result.wounds > 0 && !this.pending };
  }

  /** Read transient form values and re-resolve the selected Action from live Items. */
  readInput() {
    for (const field of ["attack", "successes", "finalDamage"]) this.values[field] = this.element.querySelector(`[data-damage-field="${field}"]`).value;
    const input = { target: this.target };
    const number = value => value.trim() === "" ? NaN : Number(value);
    if (!this.values.attack) return { ...input, finalDamage: number(this.values.finalDamage) };
    const selected = this.availableAttacks().find(attack => attack.key === this.values.attack);
    if (!selected) throw new Error("The selected attack is no longer available. Preview again.");
    return { ...input, attacker: selected.attacker, action: selected.action, item: selected.item, successes: number(this.values.successes) };
  }

  static async preview() {
    if (this.pending) return;
    try { this.result = previewDamage(this.readInput()); this.message = null; }
    catch (error) { this.result = null; this.message = error.message; }
    await this.render({ force: true });
  }

  static async apply() {
    if (this.pending || !this.target.isOwner || !this.result) return;
    this.pending = true;
    try {
      const input = this.readInput();
      const current = previewDamage(input);
      // Require another review when current arithmetic or target health has changed.
      // This comparison does not serialize damage requests from other clients.
      if (JSON.stringify(current) !== JSON.stringify(this.result)) {
        this.result = current;
        this.message = "Inputs or Actor state changed. Review the updated preview and press Apply Wounds again.";
      } else {
        const applied = await applyDamage(input);
        this.message = `Applied ${applied.wounds} Wounds in one update. Current severity: ${applied.resultingWoundSeverity}.`;
        this.result = null;
      }
    } catch (error) { this.result = null; this.message = error.message; }
    finally { this.pending = false; await this.render({ force: true }); }
  }
}

/**
 * Bound-sheet entry point restricted to GM/Fated targets; returns a newly rendered
 * window or undefined. Opening does not apply Wounds or mutate the target.
 */
export function openDamageBookkeeping() {
  if (!game.user.isGM || this.document.type !== "fated") return;
  return new DamageBookkeeping(this.document).render({ force: true });
}
