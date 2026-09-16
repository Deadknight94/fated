import { FatedActor, FatedItem } from "./module/documents.mjs";
import {
  FatedDataModel,
  NpcDataModel,
  WeaponDataModel,
  ArmorDataModel,
  EquipmentDataModel,
  WeaponProficiencyDataModel,
  FeatureDataModel
} from "./module/data-models.mjs";
import { FatedActorSheet, NpcActorSheet } from "./module/sheets/actor-sheets.mjs";
import { FatedItemSheet } from "./module/sheets/item-sheet.mjs";
import { FatedMobileSheet } from "./module/sheets/mobile-sheet.mjs";

Hooks.once("init", () => {
  console.log("Fated | Initializing Fated system");

  CONFIG.Actor.documentClass = FatedActor;
  CONFIG.Item.documentClass = FatedItem;

  CONFIG.Actor.dataModels = {
    fated: FatedDataModel,
    npc: NpcDataModel
  };

  CONFIG.Item.dataModels = {
    weapon: WeaponDataModel,
    armor: ArmorDataModel,
    equipment: EquipmentDataModel,
    weaponProficiency: WeaponProficiencyDataModel,
    feature: FeatureDataModel
  };

  CONFIG.Actor.trackableAttributes = {
    fated: {
      bar: ["resources.endurance", "resources.hope"],
      value: ["attributes.heart", "attributes.body", "attributes.mind", "resources.power", "load"]
    },
    npc: {
      bar: ["resilience"],
      value: ["shadow"]
    }
  };

  const sheets = foundry.applications.apps.DocumentSheetConfig;

  sheets.unregisterSheet(Actor, "core", foundry.appv1.sheets.ActorSheet);
  sheets.registerSheet(Actor, "fated", FatedActorSheet, {
    types: ["fated"],
    label: "FATED.Sheets.Fated",
    makeDefault: true
  });
  sheets.registerSheet(Actor, "fated", NpcActorSheet, {
    types: ["npc"],
    label: "FATED.Sheets.Npc",
    makeDefault: true
  });
  sheets.registerSheet(Actor, "fated", FatedMobileSheet, {
    types: ["fated"], label: "FATED.Sheets.Mobile", makeDefault: false
  });

  sheets.unregisterSheet(Item, "core", foundry.appv1.sheets.ItemSheet);
  sheets.registerSheet(Item, "fated", FatedItemSheet, {
    types: ["weapon", "armor", "equipment", "weaponProficiency", "feature"],
    label: "FATED.Sheets.Item",
    makeDefault: true
  });
});
