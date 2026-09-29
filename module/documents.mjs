/**
 * @file Foundry Document adapters: expose enabled Item Actions and derive Actor values
 * that depend on embedded Items. Schemas and persistent normalization belong to
 * data-models.mjs; this module does not roll dice or resolve declarations.
 */
import { getActorActions, getItemActions } from "./actions/actions.mjs";

import { calculateDefense } from "./defense.mjs";

/**
 * Foundry Actor adapter for both Actor types. Exposes enabled embedded Actions;
 * only Fated preparation derives carried Load and Item-aware Defense. These
 * prepared assignments do not persist updates or alter embedded Items.
 */
export class FatedActor extends Actor {
  getAvailableActions() {
    return getActorActions(this);
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    if (this.type !== "fated") return;

    // Load is derived from physical carried Items. Weapon proficiencies and Features
    // are rules records, not carried objects, and therefore do not add Load.
    const loadTypes = new Set(["weapon", "armor", "equipment"]);
    const load = this.items.reduce((total, item) => {
      if (!loadTypes.has(item.type)) return total;
      return total + (Number(item.system.load) || 0);
    }, 0);

    this.system.load = Math.max(0, load);
    this.system.defense = calculateDefense(this).total;
  }
}

/**
 * Foundry Item adapter exposing detached enabled Actions through the Action
 * service. Schema, migration and validation remain on its system Data Model.
 */
export class FatedItem extends Item {
  getAvailableActions() {
    return getItemActions(this);
  }
}
