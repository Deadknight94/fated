# Fated for Foundry VTT

Physical-dice playtest interface for the Fated TTRPG system.

## Target

- Foundry VTT v14
- System id: `fated`
- Current package version: `0.1.0`

## Current milestone

This build implements the data-model baseline and Item Action/mobile interface foundation:

- Actor types: `fated`, `npc`
- Item types: `weapon`, `armor`, `equipment`, `weaponProficiency`, `feature`
- Fated primary attributes: Heart, Body, Mind
- Derived Endurance maximum: Body + Heart
- Derived Hope limit: Mind + Heart
- Power resource
- Load derived from carried weapons, armor, and equipment
- NPC Resilience and Shadow
- Basic ApplicationV2 actor and item sheets
- Multiple structured Actions per Item, with separate traceable dice and threshold modifiers
- Optional mobile Fated sheet with Character, Turn placeholder, Actions, and Items navigation

Not yet implemented:

- Digital dice rolling (physical dice are primary; requires a later explicit request)
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

## Player interface

Open a Fated Actor and press **Open mobile interface**. Alternatively select **Fated Mobile Sheet** in its sheet configuration. The desktop sheet remains the default; NPCs are unchanged. The mobile sheet fills phone viewports up to 600px wide and remains a resizable window on larger screens.

Configure Actions on owned Items using **Add Action**. Fields save on change. Unspecified fields remain unknown; they do not imply zero or unrestricted use. No rolling or declaration planner is included.

See [Action architecture and smoke tests](docs/actions-mobile.md) for implementation details and verification steps.
