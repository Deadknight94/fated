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

    this.resources.hope.value = Math.clamp(
      this.resources.hope.value,
      -this.resources.hope.max,
      this.resources.hope.max
    );
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
  static defineSchema() {
    return {
      description: new HTMLField({ required: false, nullable: false, initial: "" }),
      load: int(0, 0),
      action: new SchemaField({
        enabled: new BooleanField({ required: true, nullable: false, initial: false }),
        name: new StringField({ required: true, nullable: false, initial: "" }),
        type: new StringField({ required: true, nullable: false, initial: "main" }),
        stance: new StringField({ required: true, nullable: false, initial: "any" }),
        range: new SchemaField({
          min: int(0, 0),
          max: int(1, 0)
        })
      })
    };
  }
}

export class WeaponDataModel extends BaseItemDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      proficiency: new StringField({ required: true, nullable: false, initial: "" }),
      damage: int(1, 0)
    };
  }
}

export class ArmorDataModel extends BaseItemDataModel {}
export class EquipmentDataModel extends BaseItemDataModel {}

export class WeaponProficiencyDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new HTMLField({ required: false, nullable: false, initial: "" }),
      key: new StringField({ required: true, nullable: false, initial: "" })
    };
  }
}

export class FeatureDataModel extends BaseItemDataModel {}
