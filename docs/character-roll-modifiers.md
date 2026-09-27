# Character roll modifiers and wound care

Fated Actors store `system.manualRollModifiers`, defaulting to `[]`. Each entry is
`{ id: string, type: "successDice" | "successThreshold", label: string, value: integer }`.
Ids are generated once on addition. Labels preserve authored text, including whitespace,
and are escaped by the templates rather than localized. Values accept either sign.
This additive field initializes empty for existing Actors; no existing Item/Action data changes.
NPCs do not have this field.

`actorRollModifiers(actor)` combines actor-state Threshold contributions with manual
Dice and Threshold modifiers. `calculateActorAction()` uses it for Actions (including
the mobile view), and `endurancePushContext()` uses it on projected post-spend state
for declaration previews and locked snapshots. Only canonical Wound/care contributions
determine suppressible Endurance Push costs. Manual penalties are never suppressible.
The existing roll layer retains its one-die minimum; the aggregate dice delta is unbounded.

The desktop Roll Summary uses that same global helper: signed total Dice modifier and
active sources, plus base Threshold 4, active Threshold sources and resulting Threshold.
It has no final dice pool and no stance, Multi-Action, Endurance Push or Item Action context.
The desktop Resources stance selector is removed; the Turn Planner still owns stance changes.

The shared Health section offers None/Bandaged for Light Wounds and
None/Bandaged/Treated for Grievous Wounds. Options derive from `normalizeWoundCare`;
pending healing is not a manual choice. Actor ownership and sheet editability guard
changes. Existing valid duration is preserved; no duration defaults beyond normalization's
existing zero are introduced. Care does not change severity. Light treatment still heals
through the existing rest workflow rather than persisting Treated Light.

Threshold contributions remain Light +1/Bandaged -1; Grievous +2/Bandaged -1 or
Treated -2. Care is shown beside the wound label and separately in the mechanical
breakdown. Healthy, Death's Door and Dead have no manual care controls. Recorded death
also normalizes stored care to None during creation/update, including transitions into
death; other rest, reopening and Multi-Action bandage lifecycle behavior is unchanged.
