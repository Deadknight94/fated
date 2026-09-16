# Fated for Foundry VTT

Physical-dice playtest interface for the Fated TTRPG system.

## Target

- Foundry VTT v14
- System id: `fated`
- Current package version: `0.1.0`

## Current milestone

This build implements the data-model baseline, Item Actions and mobile Turn Declaration Planner:

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
- Optional mobile Fated sheet with Character, Turn, Actions, and Items navigation
- Target-agnostic declarations with stance selection, ordered Actions, one Movement segment, Multi-Action Threshold calculation, persistent locking and an execution checklist

Not yet implemented:

- Digital dice rolling (physical dice are primary; requires a later explicit request)
- Power Dice or Shadow Dice rolls
- Critical success resource generation
- Wounds and healing
- Broken / Death's Door automation
- Additional stance mechanics beyond configured Action restrictions
- range, LOS, and combat automation
- world-level Shadow pool
- rest automation

## Manual installation

Copy the `fated` directory into the Foundry User Data systems directory:

`Data/systems/fated`

Restart Foundry, create or edit a World, and select **Fated** as the game system.

## Player interface

Open a Fated Actor and press **Open mobile interface**. Alternatively select **Fated Mobile Sheet** in its sheet configuration. The desktop sheet remains the default; NPCs are unchanged. The mobile sheet fills phone viewports up to 600px wide and remains a resizable window on larger screens.

Configure Actions on owned Items using **Add Action**. Fields save on change. Unspecified fields remain unknown; they do not imply zero or unrestricted use. Set each Action's roll requirement explicitly.

Use **Turn** to choose a stance and order Main, Free and Power Actions plus one optional continuous Movement segment. A declared Power Action disables additional Main/Power choices; declared Main Actions disable Power choices. Movement and Free Actions remain available. Incomplete or illegal declarations cannot lock. Locking freezes Action text and calculations for physical-dice execution; ending the declaration clears it while preserving stance and resources. No digital rolling or combat resolution is included.

See [Action architecture and smoke tests](docs/actions-mobile.md) for implementation details and verification steps.

Companion Mode opens automatically after client ready for non-GM Users at viewport widths up to 1024 CSS pixels, or on touch/coarse-pointer devices with a smaller viewport dimension up to 1024 pixels (including iPad Pro landscape). Once activated it stays active through rotation/resizing for that session. GMs never enter automatically. It uses Foundry's native User-linked character; missing, unsupported or inaccessible characters show a fallback screen. The persistent frameless shell shares the existing Actor data and four sections. Its menu provides return, browser refresh/reconnect and logout. Returning closes the linked character's open Item editors through their normal lifecycle. Escape is intercepted only while Companion Mode is active to prevent an inaccessible core modal menu. Canvas/interface suppression is local CSS only; no shared Scene state changes. Desktop manual opening remains available.
