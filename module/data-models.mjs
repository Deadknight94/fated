import { actionsField, migrateLegacyAction, STANCES } from "./actions/action-model.mjs";
import { declarationField } from "./declaration/data-model.mjs";
import { clampHope } from "./resources.mjs";
import { freshDeclaration } from "./declaration/evaluate.mjs";
import { deriveHealth, healthTransition, healthLockIssue } from "./health.mjs";
import { wornArmorIssue } from "./equipment.mjs";
import { calculateDefense } from "./defense.mjs";

const {
  BooleanField,
  HTMLField,
  NumberField,
  SchemaField,
  StringField
} = foundry.data.fields;

const int = (initial = 0, min = undefined) => new NumberField({
  required: true,
  nullable: false,
  integer: true,
  initial,
  ...(min === undefined ? {} : { min })
});

const resourceField = ({ initial = 0, max = 0, allowNegative = false } = {}) => new SchemaField({
  value: int(initial, allowNegative ? undefined : 0),
  max: int(max, 0)
});

export class FatedDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      biography: new HTMLField({ required: false, nullable: false, initial: "" }),
      currentStance: new StringField({ required: true, nullable: false, blank: false, initial: "neutral", choices: STANCES }),
      health: new SchemaField({
        woundSeverity: new NumberField({ required: true, nullable: false, integer: true, min: 0, max: 4, initial: 0 }),
        stabilized: new BooleanField({ required: true, nullable: false, initial: false }),
        dead: new BooleanField({ required: true, nullable: false, initial: false })
      }),
      declaration: declarationField({ initial: source => freshDeclaration(source.currentStance ?? "neutral") }),
      attributes: new SchemaField({
        heart: int(0, 0),
        body: int(0, 0),
        mind: int(0, 0)
      }),
      resources: new SchemaField({
        endurance: resourceField(),
        hope: resourceField({ allowNegative: true }),
        power: int(0, 0)
      }),
      load: int(0, 0)
    };
  }

  async _preCreate(data, options, user) {
    if (await super._preCreate(data, options, user) === false) return false;
    const source = this.toObject();
    this.parent.updateSource({ "system.resources.hope.value": clampHope(source.resources.hope.value, source.attributes) });
    // No prior Incapacitation exists at creation: simultaneous first causes do not kill.
    if (source.health) this.parent.updateSource({ "system.health.stabilized": false,
      "system.health.dead": source.health.dead || source.health.woundSeverity >= 4 });
  }

  async _preUpdate(changes, options, user) {
    if (await super._preUpdate(changes, options, user) === false) return false;
    const expanded = foundry.utils.expandObject(changes);
    const candidate = this.clone(expanded.system ?? {});
    const source = this.toObject();
    // Old out-of-range source values must not resurface when an attribute increases.
    const hope = expanded.system?.resources?.hope?.value === undefined
      ? clampHope(source.resources.hope.value, source.attributes) : candidate.resources.hope.value;
    const corrected = clampHope(hope, candidate.attributes);
    if (corrected !== source.resources.hope.value || expanded.system?.resources?.hope?.value !== undefined) {
      if (Object.hasOwn(changes, "system")) foundry.utils.setProperty(changes, "system.resources.hope.value", corrected);
      else changes["system.resources.hope.value"] = corrected;
    }
    const proposed = candidate.toObject();
    proposed.resources.hope.value = corrected;
    if (expanded.system?.health && Object.hasOwn(expanded.system.health, "dead")
      && expanded.system.health.dead !== source.health.dead && !user?.isGM) {
      throw new Error("Only a GM can administratively correct the recorded death state.");
    }
    const transition = healthTransition(source, proposed, {
      administrativeCorrection: user?.isGM && expanded.system?.health?.dead === false && source.health.dead
    });
    for (const field of ["dead", "stabilized"]) {
      if (transition[field] !== source.health[field] || expanded.system?.health?.[field] !== undefined) {
        if (Object.hasOwn(changes, "system")) foundry.utils.setProperty(changes, `system.health.${field}`, transition[field]);
        else changes[`system.health.${field}`] = transition[field];
      }
      proposed.health[field] = transition[field];
    }
    if (expanded.system?.declaration?.status === "locked" && source.declaration.status !== "locked") {
      const issue = healthLockIssue(deriveHealth(proposed));
      if (issue) throw new Error(issue);
    }
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    const heart = Number(this.attributes.heart) || 0;
    const body = Number(this.attributes.body) || 0;
    const mind = Number(this.attributes.mind) || 0;

    this.resources.endurance.max = body + heart;
    this.resources.hope.max = mind + heart;

    this.resources.endurance.value = Math.clamp(
      this.resources.endurance.value,
      0,
      this.resources.endurance.max
    );

    this.resources.hope.value = clampHope(this.resources.hope.value, this.attributes);
    this.defense = calculateDefense({ system: this, uuid: this.parent?.uuid }).total;
  }
}

export class NpcDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new HTMLField({ required: false, nullable: false, initial: "" }),
      resilience: resourceField(),
      shadow: int(0, 0)
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    this.resilience.value = Math.clamp(this.resilience.value, 0, this.resilience.max);
  }
}

class BaseItemDataModel extends foundry.abstract.TypeDataModel {
  static migrateData(source) {
    return super.migrateData(migrateLegacyAction(source));
  }

  static validateJoint(data) {
    const ids = data.actions.map(action => action.id);
    if (new Set(ids).size !== ids.length) throw new Error("Action IDs must be unique within an Item.");
  }

  static defineSchema() {
    return {
      description: new HTMLField({ required: false, nullable: false, initial: "" }),
      load: int(0, 0),
      actions: actionsField()
    };
  }
}

export class WeaponDataModel extends BaseItemDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      equipped: new BooleanField({ required: true, nullable: false, initial: false }),
      proficiency: new StringField({ required: true, nullable: false, initial: "" }),
      damage: int(1, 0)
    };
  }
}

export class EquipmentDataModel extends BaseItemDataModel {
  static defineSchema() {
    return { ...super.defineSchema(), equipped: new BooleanField({ required: true, nullable: false, initial: false }) };
  }
}

export class ArmorDataModel extends EquipmentDataModel {
  static defineSchema() { return { ...super.defineSchema(), armor: int(0, 0) }; }

  async _preCreate(data, options, user) {
    if (await super._preCreate(data, options, user) === false) return false;
    const issue = wornArmorIssue(this.parent, this.equipped);
    if (issue) throw new Error(issue);
  }

  async _preUpdate(changes, options, user) {
    if (await super._preUpdate(changes, options, user) === false) return false;
    const equipped = foundry.utils.expandObject(changes).system?.equipped;
    const issue = wornArmorIssue(this.parent, equipped ?? this.equipped);
    if (issue) throw new Error(issue);
  }
}

export class WeaponProficiencyDataModel extends BaseItemDataModel {
  static defineSchema() {
    return {
      description: new HTMLField({ required: false, nullable: false, initial: "" }),
      actions: actionsField(),
      key: new StringField({ required: true, nullable: false, initial: "" })
    };
  }
}

export class FeatureDataModel extends BaseItemDataModel {}
