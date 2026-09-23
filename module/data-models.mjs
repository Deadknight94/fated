import { actionsField, migrateLegacyAction, STANCES } from "./actions/action-model.mjs";
// ArrayField is needed for the proficiencies array
import { SKILL_ATTRIBUTE_MAP } from "./skills.mjs";
import { declarationField } from "./declaration/data-model.mjs";
import { clampHope } from "./resources.mjs";
import { freshDeclaration } from "./declaration/evaluate.mjs";
import { deriveHealth, healthTransition, healthLockIssue } from "./health.mjs";
import { wornArmorIssue } from "./equipment.mjs";
import { calculateDefense } from "./defense.mjs";
import { normalizeWoundCare } from "./wound-care.mjs";

const {
  ArrayField,
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
        dead: new BooleanField({ required: true, nullable: false, initial: false }),
        woundCare: new SchemaField({
          care: new StringField({ required: true, nullable: false, blank: false, initial: "none", choices: ["none", "bandaged", "treated", "grievousHealingPending"] }),
          daysRemaining: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 })
        })
      }),
      declaration: declarationField({ initial: source => freshDeclaration(source.currentStance ?? "neutral") }),
      attributes: new SchemaField({
        heart: int(0, 0),
        body: int(0, 0),
        mind: int(0, 0)
      }),
      // Canonical skills – one entry per skill key, default level 1
      skills: new SchemaField(
        Object.fromEntries(
          Object.entries(SKILL_ATTRIBUTE_MAP).map(([k]) => [k, int(1, 0)])
        )
      ),
      // Generalized proficiencies – arbitrary entries
      proficiencies: new ArrayField(
        new SchemaField({
          key: new StringField({ required: true, nullable: false, blank: false, initial: "" }),
          displayName: new StringField({ required: true, nullable: false, blank: false, initial: "" }),
          attribute: new StringField({ required: true, nullable: false, initial: "", choices: ["heart", "body", "mind"] }),
          level: int(0, 0)
        })
      ),
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
    // Clamp initial Power to derived maximum (Heart + Body + Mind)
    const powerLimit = (source.attributes.heart ?? 0) + (source.attributes.body ?? 0) + (source.attributes.mind ?? 0);
    const rawPower = source.resources.power ?? 0; // guard against undefined
    const correctedPower = Math.max(0, Math.min(rawPower, powerLimit));
    if (correctedPower !== rawPower) {
      this.parent.updateSource({ "system.resources.power": correctedPower });
    }
    if (source.health) {
      // Normalize woundCare on creation
      const normalized = normalizeWoundCare(source.health.woundSeverity, source.health.woundCare);
      if (normalized.care !== source.health.woundCare.care || normalized.daysRemaining !== source.health.woundCare.daysRemaining) {
        this.parent.updateSource({ "system.health.woundCare.care": normalized.care, "system.health.woundCare.daysRemaining": normalized.daysRemaining });
      }
      this.parent.updateSource({ "system.health.stabilized": false,
        "system.health.dead": source.health.dead || source.health.woundSeverity >= 4 });
    }
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
    // Normalize woundCare on update
    const normalized = normalizeWoundCare(proposed.health.woundSeverity, proposed.health.woundCare);
    if (normalized.care !== proposed.health.woundCare.care || normalized.daysRemaining !== proposed.health.woundCare.daysRemaining) {
      if (Object.hasOwn(changes, "system")) {
        foundry.utils.setProperty(changes, "system.health.woundCare", normalized);
      } else {
        changes["system.health.woundCare"] = normalized;
      }
      proposed.health.woundCare = normalized;
    }
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
    // Clamp Power to derived maximum based on proposed attributes
    const powerLimit = candidate.attributes.heart + candidate.attributes.body + candidate.attributes.mind;
    // Guard against missing power on the candidate – treat as 0 for clamping logic
    const rawPower = candidate.resources.power ?? 0;
    const correctedPower = Math.max(0, Math.min(rawPower, powerLimit));
    if (correctedPower !== candidate.resources.power) {
      if (Object.hasOwn(changes, "system") || expanded.system?.resources?.power !== undefined ||
          expanded.system?.attributes?.heart !== undefined || expanded.system?.attributes?.body !== undefined ||
          expanded.system?.attributes?.mind !== undefined) {
        if (Object.hasOwn(changes, "system")) {
          foundry.utils.setProperty(changes, "system.resources.power", correctedPower);
        } else {
          changes["system.resources.power"] = correctedPower;
        }
      }
      candidate.resources.power = correctedPower;
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
