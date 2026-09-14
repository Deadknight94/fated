# Fated for Foundry VTT

Early development scaffold for the Fated TTRPG system.

## Target

- Foundry VTT v14
- System id: `fated`
- Current package version: `0.1.0`

## Current milestone

This build intentionally implements only the first installable data-model milestone:

- Actor types: `fated`, `npc`
- Item types: `weapon`, `armor`, `equipment`, `weaponProficiency`, `feature`
- Fated primary attributes: Heart, Body, Mind
- Derived Endurance maximum: Body + Heart
- Derived Hope limit: Mind + Heart
- Power resource
- Load derived from carried weapons, armor, and equipment
- NPC Resilience and Shadow
- Basic ApplicationV2 actor and item sheets
- Basic responsive/mobile layout

Not yet implemented:

- Success Dice / Fate Die rolls
- Power Dice or Shadow Dice rolls
- Critical success resource generation
- Wounds and healing
- Broken / Death's Door automation
- Stances
- turn declaration / multi-action workflow
- range, LOS, and combat automation
- world-level Shadow pool
- rest automation

## Manual installation

Copy the `fated` directory into the Foundry User Data systems directory:

`Data/systems/fated`

Restart Foundry, create or edit a World, and select **Fated** as the game system.

## Development sequence

1. Confirm the package loads cleanly in Foundry v14.
2. Confirm Fated/NPC creation and sheet editing.
3. Confirm embedded Items can be created and Load is derived correctly.
4. Add the core roll engine.
5. Add wound/resource automation.
6. Add combat declaration and stance UX.
