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
- Manual Wounds/stabilization bookkeeping, derived health conditions, traceable character-state Threshold modifiers and history-sensitive second-incapacitation death
- Derived Defense (Body + Mind + current stance, minimum 1), physical attack damage previews and explicit simultaneous Wound application

Not yet implemented:

- Digital dice rolling (physical dice are primary; requires a later explicit request)
- Power Dice or Shadow Dice rolls
- Critical success resource generation
- Wound recovery and healing
- Timed Broken / Death's Door effects
- Ranged stance Success Dice modifier and other deferred stance mechanics
- range, LOS, and combat automation
- world-level Shadow pool
- rest automation

## Manual installation

Copy the `fated` directory into the Foundry User Data systems directory:

`Data/systems/fated`

Restart Foundry, create or edit a World, and select **Fated** as the game system.

## Player interface

Open a Fated Actor and press **Open mobile interface**. Alternatively select **Fated Mobile Sheet** in its sheet configuration. The desktop sheet remains the default; NPCs are unchanged. The mobile sheet fills phone viewports up to 600px wide and remains a resizable window on larger screens.

Configure Actions on owned Items using **Add Action**. Fields save on change. Success Threshold always starts at 4; configure Action-specific deviations as named Threshold modifiers. Other unspecified fields remain unknown; they do not imply zero or unrestricted use. Set each Action's roll requirement explicitly. Preserved non-4 legacy thresholds show a review warning and block affected required-roll declarations until reviewed.

The Companion Character view provides direct editing and touch-friendly −1/+1 controls for Endurance, Hope and Power. Load remains derived/read-only under the owned=carried assumption. All edits use the real Actor document and native ownership permissions. Hope is persistently corrected within ±(Mind + Heart) during the TypeDataModel pre-create/pre-update lifecycle, including when attributes shrink; increasing the limit later cannot restore discarded Hope. Preparation does not issue document updates.

Fated Actors store `system.currentStance` (Neutral by default; Offensive, Defensive or Ranged). Character and desktop sheets edit this persistent state. A fresh declaration begins from current stance; editing its proposed stance leaves current stance unchanged. Successful locking commits the proposed stance with the locked declaration in one Actor update. Clearing preserves current stance and initializes the next declaration from it. No combat-start reset or stance enforcement beyond existing Action restrictions is automated.

Use **Turn** to choose a stance and order Main, Free and Power Actions plus one optional continuous Movement segment. A declared Power Action disables additional Main/Power choices; declared Main Actions disable Power choices. Movement and Free Actions remain available. Incomplete or illegal declarations cannot lock. Locking freezes Action text and calculations for physical-dice execution; ending the declaration clears it while preserving stance and resources. Dice are rolled physically.

The GM opens **Physical damage bookkeeping** on the target Fated desktop sheet. Select a visible attack Action and enter physical Successes, or enter manual final Damage. Preview shows calculation, current Defense and Wounds; **Apply Wounds** updates severity once. See [Defense and physical damage](docs/damage-bookkeeping.md). Equipment Defense remains deferred until worn/equipped semantics are defined.

See [Action architecture and smoke tests](docs/actions-mobile.md) for implementation details and verification steps.

See [Health-state bookkeeping](docs/health-state.md) for schema, transition handling, modifier integration and deferred recovery/timed effects.

Companion Mode opens automatically after client ready for non-GM Users at viewport widths up to 1024 CSS pixels, or on touch/coarse-pointer devices with a smaller viewport dimension up to 1024 pixels (including iPad Pro landscape). Once activated it stays active through rotation/resizing for that session. GMs never enter automatically. It uses Foundry's native User-linked character; missing, unsupported or inaccessible characters show a fallback screen. The persistent frameless shell shares the existing Actor data and four sections. Its menu provides return, browser refresh/reconnect and logout. Returning closes the linked character's open Item editors through their normal lifecycle. Escape is intercepted only while Companion Mode is active to prevent an inaccessible core modal menu. Canvas/interface suppression is local CSS only; no shared Scene state changes. Desktop manual opening remains available.
