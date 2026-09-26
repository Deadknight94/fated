# FATED Rules Canon

> **Repository snapshot of the human-authoritative rules.**
>
> Source: Google Doc **“FatedTTRPG Core System Summary”**.
> Snapshot refreshed from the master document on **2026-09-23**.
>
> The Google Doc remains the master rules document. This file exists so coding agents can read a stable, local rules reference without depending on live Google Drive access.
>
> **Coding-agent rule:** do not invent, reinterpret, or silently complete rules that are absent, ambiguous, experimental, or marked TBD here. For a narrow implementation task, the task prompt may restate the relevant subset of these rules; if that prompt conflicts with this file, report the conflict rather than choosing one.
>
> Refresh this snapshot whenever approved rules in the Google Doc materially change.

---

# Core Rules

# FatedTTRPG Core System Summary

# Core Concept

A low-magic TTRPG focused on heroic characters, fellowship, fate, and the struggle between Light and Shadow.

# Player Characters (The Fated):

## Primary Attributes

**Heart** — courage, leadership, spirit, faith…
**Body** — strength, dexterity, endurance…
**Mind** — wisdom, perception, intelligence…

## Secondary Attributes

**Endurance**  — The ability to go on fighting/traveling
	Endurance is calculated as the sum of Body and Heart. This value represents the Maximum Endurance, which opposes Load (see below)
**Hope**  — Not falling into shadow
	A Fated's Hope Limit is equal to the sum of Mind and Heart. Current Hope ranges from the negative value of this limit to its positive value, and all Fated begin at 0 Hope. Hope cannot rise above the positive Hope Limit or fall below the negative Hope Limit; any excess Hope gained or lost beyond these limits is discarded. For example, a Fated with Mind 2 and Heart 3 has a Hope range from \-5 to \+5.
**Defense**  — Avoid damage
	Defense is calculated as the sum of Body and Mind, and can be modified by Equipment.
**Power** — The ability to perform incredible deeds
	Maximum Power is equal to the sum of Body, Heart and Mind. All Fated begin with 0 current Power.
**Load** — The weight of things
	Load is calculated as the sum of the Load values of carried Equipment.

##

## Wounds

A Fated, when damaged in combat, can suffer one or more Wounds. Wound severity is tracked in four steps: Healthy (0), Light Wound (1), Grievous Wound (2), and Incapacitated / Death’s Door (3). Death’s Door is not a separate mechanical condition; it is the narrative term used for Incapacitation caused by Wounds. If wound severity reaches 4 or more, the Fated dies. When a single source inflicts multiple Wounds, all of those Wounds are applied simultaneously to the Fated’s current wound severity. Sufficiently overwhelming damage can therefore move a Fated directly from Healthy to Grievously Wounded, Death’s Door, or Dead.

Wounds affect how well the Fated can perform, reflected in game by modifying the success threshold of its Success Dice, as per the table below:

| Wounds | Success Threshold |
| :---- | :---- |
| None | 4+ |
| Light | 5+ |
| Grievous | 6+ |

## Endurance and Load

A Fated whose current Load exceeds its current Endurance becomes Overburdened. An Overburdened Fated suffers a penalty of 1 to its Success Threshold. Should a Fated’s Endurance become 0, they also become Exhausted. An Exhausted Fated suffers an additional penalty of 1 to its Success Threshold. A Fated that is both Overburdened and Exhausted therefore suffers a total penalty of 2\. Furthermore, every time an Exhausted Fated would lose a point of Endurance, they lose a point of Hope instead.

## Hope

For a Fated with a positive Hope Limit, current Hope greater than 0 grants a bonus of 1 to Success Threshold, reducing the threshold by 1. At the positive Hope Limit, the Fated becomes Inspired and the total Hope bonus increases to 2, reducing Success Threshold by 2. These are tiers of one modifier and do not stack. A Fated whose current Hope equals their negative Hope Limit becomes Despondent and suffers a penalty of 1 to Success Threshold. Negative Hope above the negative Hope Limit and Hope exactly 0 have no Success Threshold effect. With Hope Limit 0, neither Inspired nor Despondent applies and there is no Hope modifier. Hope cannot move beyond either limit; any excess Hope gained above the positive Hope Limit or lost below the negative Hope Limit is discarded.

All normal Success Threshold modifiers remain cumulative, including Wounds, Load, Exhaustion, stance, Multi-Action, and equipment. There is no Success Threshold floor or ceiling. A natural 6 remains a Critical Success regardless of the final Success Threshold.
*For example, with base Success Threshold 4, Dargon succeeds on 3+ while Hope is positive but below maximum, and on 2+ when Inspired. After suffering a Light Wound while still Inspired, his rolls succeed on 3+. If his Hope then falls to the negative Hope Limit, he becomes Despondent and succeeds on 6+ including the Light Wound. Without the wound, negative Hope above minimum or Hope 0 gives 4+, and minimum Hope gives 5+.*

## Power

A Fated’s Maximum Power is equal to the sum of Heart, Body and Mind. It represents the Fated’s capacity to build up the potential needed to perform incredible feats. A Fated begins with 0 current Power and cannot exceed its Maximum Power. As a general rule, Power is generated only when the player chooses to gain 1 Power from a Critical Success. Power does not recover passively or through resting. Specific rules, such as equipment or features, may provide additional ways to gain Power.

Power can be spent multiple ways:

* When a Fated makes a Dice Roll, the player may spend Power to add Success Dice to the roll equal to the amount of Power spent. These additional dice are called Power Dice. The player must declare and spend this Power before any dice are rolled; the amount spent determines how many Power Dice are added to the roll. In combat, this expenditure is declared immediately before resolving the already-declared Action, just before the roll; it does not need to be included in the turn declaration. Power Dice follow the normal Success Threshold and a 6 may count as 2 successes, but Power Dice can never generate Power. When rolling physically, Power Dice must be distinguishable from normal Success Dice, such as by using different-colored dice or rolling them separately.
* If a Fated chooses to perform an action that transcends normal capabilities (TBD), the Game Master will inform the player of how many successes the Fated needs to be successful. In combat, the intention to perform this extraordinary Power action must be included in the Fated's turn declaration. A Fated may perform at most one extraordinary Power Action per turn. If a Fated declares a Power Action, that Power Action is its only Main Action for the turn and the Fated cannot use the Multi-Action rule that turn; declared movement and Free Actions remain allowed as normal. Before rolling, the player declares how much Power the Fated will spend. The Fated then rolls that many Power Dice, thus determining the outcome of the action. I.e. Dargon, fighting under a thunderstorm, tries to command the next lightning to strike his enemies. The GM deems this an extremely difficult action, requiring Dargon to know the command words and the knowledge how to use them, and asks for 6 successes. Dargon spends all 8 of his Power to roll 8 Power Dice, scoring 1, 2, 3, 3, 4, 5, 6, 6, scoring thus 6 successes.

Incapacitation and Death

A Fated becomes Incapacitated in either of two ways. If its wound severity reaches 3, it is on Death’s Door. If it is both Despondent and Exhausted, it is Broken (Spezzato). Death’s Door and Broken are both forms of Incapacitation, but rules may interact with them differently. An Incapacitated Fated falls unconscious until the condition causing the Incapacitation is resolved. Broken cannot be removed by Healing rolls or by rules that heal or treat Wounds; it ends only when the Fated is no longer Despondent or no longer Exhausted. If simultaneous Wounds raise a Fated’s wound severity to 4 or more, the Fated dies outright. If a Fated meets either Incapacitation requirement while already Incapacitated, the Fated dies. Thus, a Fated on Death’s Door dies if it becomes Broken, while a Broken Fated dies if its wound severity reaches 3\. For example, a Grievously Wounded Broken Fated dies if another Wound raises its wound severity to 3\.
While a Fated is on Death's Door, it loses 1 point of Endurance and 1 point of Hope every round of combat. Outside combat, a Fated on Death's Door instead loses 1 point of Endurance and 1 point of Hope every hour. If the Fated is already Exhausted, the Endurance loss is converted into an additional loss of 1 Hope as normal, resulting in a total loss of 2 Hope for that round or hour. A Healing roll that scores at least 1 success can stabilize a Fated on Death's Door. A stabilized Fated remains on Death's Door and Incapacitated, but no longer suffers this Endurance and Hope drain. Specific items may temporarily close or support the wound of a stabilized Fated, suppressing the Incapacitation from Death's Door and allowing the Fated to act for the duration specified by the item. This does not reduce wound severity: the Fated remains at wound severity 3, and another Wound still causes death. At the Game Master's discretion, another Fated may also use Power creatively to attempt an extraordinary healing effect capable of removing Death's Door if the attempt succeeds. A Broken Fated does not suffer the Death's Door Endurance or Hope drain. Instead, a Broken Fated loses 1 Power at the end of each combat round, to a minimum of 0\. Reaching 0 Power does not itself kill the Fated. A Fated can remain continuously Broken for a number of days equal to its Body attribute; if it is still Broken at the end of that period, the Fated dies.

## Skills

Each of the 3 Primary Attributes has 6 skills associated to it:

### Body:

* Awe (maestosità)
* Athletics (atletica)
* Hunting / Foraging (caccia / raccolta)
* Travel (viaggiare)
* Craft (artigianato)
* Finesse (destrezza)

### Mind

* Persuade (persuasione)
* Stealth (furtività)
* Perception (percezione)
* Explore (esplorazione)
* Reason (ragionamento)
* Lore (conoscenza)

### Heart

* Enhearten (rincuorare)
* Leadership (comando)
* Insight (intuito)
* Healing (cura)
* Diplomacy (diplomazia)
* Deceive (inganno)

Each skill has a default level of 1\. During character creation and further along the adventure, a Fated can invest Skill Points to increase the level of the skill.

### Proficiencies

Proficiencies represent specific learned training with a group of weapons, tools, or another trained field, such as Swords, Bows, or an Alchemy Kit. Every Proficiency is associated with one Primary Attribute. Proficiencies start at level 0\. Raising a Proficiency to a level equal to or lower than its associated Attribute costs 1 Skill Point per level; raising it above that Attribute costs 2 Skill Points per level. A Proficiency cannot exceed twice its associated Attribute. When a roll specifically requires a Proficiency at level 0, the Fated is untrained: it rolls 1 Success Die, and only a natural 6 counts as a success. That 6 cannot be counted as 2 successes, but it may still be used to generate 1 Power. An Attribute Roll does not replace a Skill or Proficiency when the task specifically calls for that training.

**Skill Point Cost (see Character Creation):**
Taking a level in a skill, while its level is below the Attribute associated with it, takes 1 Skill Point. Levels that would take the Skill Level beyond the value of the Attribute associated with the skill take 2 points instead.
A skill level cannot exceed twice the value of the Attribute associated with it.

#

# Dice checks:

Dice Rolls are made only when the outcome of an action is both uncertain and consequential. The Game Master decides when a Dice Roll is required. If an action is routine, automatic, impossible, or its outcome is already established by the fiction, it is resolved without rolling. Repeated attempts under substantially unchanged circumstances do not create additional Dice Rolls simply to seek a different Fate Die or Critical Success result.
Attribute Rolls may be used when no Skill or Proficiency appropriately covers the uncertain action or resistance being tested. For an Attribute Roll, the Fated rolls Success Dice equal to the relevant Attribute. Body is used for raw physical resistance or capability, while Mind or Heart may be used for mental, emotional, or spiritual resistance depending on the nature of the threat. If a Skill or Proficiency directly covers the situation, it is used instead of an Attribute Roll.

Whenever a Fated makes a Dice Roll, it always rolls 1d20 Fate Die as part of that roll, regardless of what other dice the roll uses. This includes extraordinary Power Actions that roll only Power Dice. Only Fated ever roll the Fate Die; non-Fated characters never roll it. When a roll uses Success Dice, the number rolled depends on the relevant Skill, Proficiency, or Attribute.

## Success Dice (d6)

A Success Die rolls a Success on a 4+ and a Failure on a 1-3. This is known as the Success Threshold. The Success Threshold belongs to the actor making the roll and may be modified only by circumstances affecting that actor, such as Hope, Wounds, Load, Exhaustion, multiple actions, the actor's equipment, stance, and other rules. A target's Defense or other target-side statistics never modify the attacker's Success Threshold. All applicable Success Threshold modifiers are cumulative: apply every bonus and penalty affecting the roller to determine the final Success Threshold. Success Die modifiers are also cumulative. After all Success Die bonuses and penalties are applied, a roll that uses Success Dice always rolls at least 1 Success Die; penalties can never reduce the Success Dice pool below 1\.
A 6 on a Success Die is a Critical Success. A Critical Success scores a success regardless of the current success threshold for the Fated, even beyond 7+. (for instance if at Minimum Hope and with a Grievous Wound the success threshold would be 7+).Furthermore, Critical Successes have a bonus effect. A player chooses which effect to apply to each of his Critical Successes.
Some rolls may require more than 1 Success to achieve their intended effect; the Game Master decides how many successes are required in most cases. Combat attacks are resolved differently: every Success contributes the attacking Equipment Action's fixed Damage, and the attack inflicts a Wound only if the resulting total Damage reaches or exceeds the defender's Defense.
The effects are:

* Counts as 2 Successes
* Generates 1 Power for the player’s Fated, up to its Maximum Power

## Fate Die (d20)

The Fate Die is rolled as part of every Dice Roll made by a Fated, including rolls that use only Power Dice. It doesn’t affect the result of the action, but it reflects the repercussions the action causes.
1 \= The Master gains 2 Shadow
2–4 \= The Master gains 1 Shadow
5–16 \= No effect
17–19 \= The Fated gains 1 Hope
20 \= The Fated gains 2 Hope

## Attacks and Damage

When rolling an attack, if the attacking Equipment defines a Proficiency, the attacker uses that Proficiency to determine the Action's Success Dice. If the Equipment defines no Proficiency, the attacking Equipment Action may instead specify a Skill. Equipment Actions do not directly use Attributes as their roll source.
For each success, the attacker scores Damage equal to that Equipment Action's fixed Damage value. Total Damage from the attack is therefore the number of successes multiplied by the Action's Damage.
(i.e 3 successes with a Damage 4 weapon is equal to 12 damage).
If the Damage is lower than the defender’s Defense score, the defender suffers no Wounds. Otherwise, the number of Wounds inflicted is equal to the number of full multiples of Defense contained in the Damage: Damage equal to Defense inflicts 1 Wound, Damage equal to twice Defense inflicts 2 Wounds, and so on. All Wounds caused by the same damage instance are applied simultaneously. Add them to the defender’s current wound severity to determine the result: 1 is a Light Wound, 2 is a Grievous Wound, 3 is Incapacitated / Death’s Door, and 4 or more means the defender dies outright.

# Character Creation

Creating one of the Fated begins with a foundation of baseline competence. Every hero starts with primary Attributes at level 2 and all Skills at level 1, while Proficiencies start at level 0 and represent specific learned training. From this starting point, you will shape your hero by investing points to improve natural talents and earned training, a process that directly defines critical secondary attributes like Defense, Endurance, Hope, and Power. A central mechanic in this development is the relationship between Attributes and Skills: while raising a Skill is generally straightforward, pushing training beyond natural Attribute levels becomes significantly more taxing, encouraging a strategic balance between innate ability and specialized practice. For the standard v0.1 character creation rules, Fated use the Separated Points System described below. The Unified Point-Buy System is retained as an alternative, experimental creation method for groups that want greater variation in starting Attributes and Power. Characters may be built from scratch or from a pre-balanced Archetype.

Experimental design note — Skills at 0: A future alternate character-creation model may start all 18 Skills at level 0 rather than level 1\. Under the current cost structure, restoring the 18 baseline Skill ranks would raise the equivalent starting Skill budget from 14 to approximately 32 Skill Points before accounting for any ranks purchased above an associated Attribute. Unlike the standard rules, this would allow a Fated to leave some Skills untrained and concentrate more points into a smaller set of specialties. This is not part of the standard v0.1 rules and is retained for future consideration alongside alternatives such as Unified Point-Buy.

# Unified Point Buy

# Character Creation (Unified Point-Buy System)

In this version of character creation, the distinction between Attribute and Skill pools is removed in favor of a single **Unified Pool**. This allows players to choose between investing in "Natural Talent" (Attributes) or "Hard-Earned Training" (Skills).

#### **1\. Base Values**

All Fated begin with a baseline level of competency:

* **Primary Attributes:** Body, Mind, and Heart all start at a base of **2**.
* **Skills & Proficiencies: All 18 core Skills start at a default level of 1\. Proficiencies start at a default level of 0\.**

#### **2\. The Unified Point Pool**

Players are granted **40 Creation Points** to spend across all facets of their character:

* **Raising Attributes:** Increasing a Primary Attribute costs **5 points** per \+1. Attributes are capped at **6** during character creation.
* **Raising Skills:** Increasing a skill or proficiency follows the **Skill Point Cost Rule** based on the current value of its associated Attribute.

#### **3\. The Skill Point Cost Rule**

The cost to raise a Skill or Proficiency is dynamic and depends on your Attribute investment:

* **Normal Cost: Raising a Skill or Proficiency to a level equal to or lower than its associated Attribute costs 1 point per level.**
* **Specialized Cost: Raising a Skill or Proficiency to a level higher than its associated Attribute costs 2 points per level.**
* **Skill & Proficiency Cap: A Skill or Proficiency cannot exceed twice the value of its associated Attribute.**

#### **4\. Calculate Secondary Attributes**

After spending all 40 points, determine the derived statistics:

* **Endurance (Body \+ Heart):** Capacity for combat, travel, and resisting **Load**.
* **Hope Limit (Mind \+ Heart): Sets the Fated's Hope range from the negative Limit to the positive Limit. Current Hope starts at 0\.**
* **Defense (Body \+ Mind \+ Equipment):** The threshold to avoid suffering **Wounds**.
* **Maximum Power (Body \+ Heart \+ Mind): Sets the Fated's Power limit. Current Power starts at 0\.**

---


# Separated Points

# Character Creation

The Separated Points System is the standard character creation method for Fated v0.1. A character can be built from scratch or by selecting an Archetype as a pre-balanced starting template.

#### **1\. Base Values**

All Fated begin with a baseline level of competency before any points are spent:

* **Primary Attributes:** Body, Mind, and Heart all start at a base of **2**.
* **Skills & Proficiencies: All 18 core Skills start at a default level of 1\. Proficiencies start at a default level of 0\.**

#### **2\. Point Distribution**

Players customize their Fated in two steps: first choose an Attribute spread, then spend Skill Points.

* **Attribute Spread: Choose one of the following complete spreads and assign its three values to Body, Mind, and Heart in any order:**
* **• 6 / 2 / 2**
* **• 5 / 3 / 2**
* **• 4 / 4 / 2**
* **• 4 / 3 / 3**
* **These are all possible spreads created from the starting values of 2/2/2 plus four Attribute increases. Every spread totals 10, so Body \+ Heart \+ Mind equals 10 for every newly created Fated. Current Power nevertheless begins at 0\.**
* **Skill Points (14): These are used to raise Skills from their starting level of 1 and Proficiencies from their starting level of 0\.**

#### **3\. The Skill Point Cost Rule**

The cost to raise a Skill or Proficiency is tied directly to its associated Primary Attribute:

* **Normal Cost: Raising a Skill or Proficiency to a level equal to or lower than its associated Attribute costs 1 Skill Point per level.**
* **Specialized Cost: Raising a Skill or Proficiency to a level higher than its associated Attribute costs 2 Skill Points per level.**
* **Skill & Proficiency Cap: A Skill or Proficiency cannot exceed twice the value of its associated Attribute.**

#### **4\. Calculate Secondary Attributes**

Once the Attribute spread is assigned and Skill Points are spent, determine the character's secondary attributes:

* **Endurance:** Body \+ Heart (Determines capacity to resist fatigue and manage **Load**).
* **Hope Limit: Mind \+ Heart (Current Hope ranges from the negative Limit to the positive Limit and starts at 0).**
* **Defense:** Body \+ Mind \+ Equipment (Determines the damage threshold to avoid **Wounds**).
* **Maximum Power: Body \+ Heart \+ Mind. Current Power starts at 0\.**

---

# Combat

# Combat

# The flow of combat

In Fated, combat happens in rounds, subdivided into turns.
Only Fated use fighting stances. A Fated begins combat in Neutral stance. Non-Fated characters do not use stances unless a specific rule explicitly says otherwise. Stances determine which Item Actions are available to a Fated, and each stance also has a simple combat effect. At the start of its turn, before moving or taking actions, a Fated may freely change to any other stance. This change costs no movement and does not consume a Main Action or Free Action. The Fated then remains in that stance for the rest of the turn unless another rule or effect forces a stance change. The available stances are:

* Offensive: improves the Success Threshold by 1 on applicable attack rolls (for example, 4+ becomes 3+); \-1 Defense.
* Neutral: no bonus or penalty.
* Defensive: \+1 Defense; \-1 Success Die on applicable attack rolls.
* Ranged: \+1 Success Die on ranged Item Actions. Ranged Item Actions may only be used while in Neutral or Ranged stance. Melee Item Actions may only be used while in Offensive, Neutral, or Defensive stance. A Fated cannot enter Ranged stance while adjacent to an enemy; if an enemy becomes adjacent while the Fated is in Ranged stance, the Fated immediately becomes Neutral. Adjacent means occupying a neighboring hex, and adjacency is checked continuously regardless of which combatant moved. A Fated that begins its turn adjacent to an enemy cannot enter Ranged stance that turn, because stance changes occur before movement. It may move away normally and, if it begins a later turn no longer adjacent to an enemy, may then enter Ranged stance.

During its turn, a Fated may move up to 3 hexes. This movement is separate from Main Actions and must be taken as a single continuous movement segment at one point in the turn: before all Main Actions, between two Main Actions, or after all Main Actions. The movement cannot be split into multiple segments. Item Actions list their range in hexes. Ranged Item Actions have no general minimum range. If a ranged Action should not be usable against adjacent or very close targets, that Action must define an explicit Minimum Range. A ranged target must be in line of sight unless the Item Action specifically states otherwise. Cover is binary in the v0.1 rules: a target either has Total Cover and cannot be targeted, or it has no cover. There are no partial-cover modifiers. Creatures do not provide cover or block line of sight in the v0.1 rules. A Fated may move through a hex occupied by an allied creature, but may not move through a hex occupied by an enemy. A Fated may never end its movement in a hex occupied by another creature. Terrain is also binary for movement in the v0.1 rules: a hex is either passable at normal movement cost or impassable. There is no general difficult-terrain movement cost unless a specific rule or effect states otherwise. For the v0.1 rules, movement does not trigger opportunity attacks, and there are no general rules for facing, flanking, or zones of control. These default movement and Main Action rules apply only to Fated. A non-Fated character's movement, available actions, and any action restrictions are defined individually by its stat block.
Each round is divided into a Player Phase followed by an Adversary Phase. During the Player Phase, the players choose which player Fated acts next among those who have not yet taken a turn that round. They may make this choice after each turn rather than fixing the full order in advance. Each player Fated may take only one turn during the phase. After every player Fated has taken a turn, the adversaries take their turns in whichever order the Game Master decides.
The Game Master determines whether the Fated are surprised based on the fiction; Surprise does not require a separate roll unless a specific rule says otherwise. If the Fated are surprised, the Adversary Phase occurs before the Player Phase during the first round only. From the second round onward, combat returns to the normal order: Player Phase first, then Adversary Phase. End-of-round effects resolve after the final phase of the round. Under the normal phase order this is immediately after the Adversary Phase; during a surprised first round, it is after the Player Phase instead.

# Actions in combat

Main Actions: Actions requiring a Dice Roll
Free Actions: Actions not requiring a Dice Roll.

A Fated can normally perform a single Main Action in combat, and as many Free Actions as he is able to. A Fated may perform up to a maximum of 3 Main Actions in a turn, at the cost of a decreased Success Rate. Main Actions may be repeated within the same turn unless the specific Action states otherwise. At the start of that Fated's own turn, the Fated first chooses whether to change stance. After the stance is set, and before moving or taking actions, the controlling player—or the Game Master for a Fated adversary—must declare the exact movement path and every Main Action and Free Action for that turn, including their order and intended targets where applicable. Any intended extraordinary Power Action must also be declared at this point. A Fated may declare at most one Power Action per turn. If it does, that Power Action is its only Main Action for the turn and the Fated cannot use the Multi-Action rule that turn, though its declared movement and Free Actions remain allowed as normal. Power spent only to add Power Dice to an already-declared Action is instead chosen immediately before that Action's roll. The declared movement path, Main Actions, Free Actions, order, and targets are fixed for the turn unless a specific rule or effect interrupts or forces a change. If the declared movement path becomes blocked or otherwise impossible before or during movement, the Fated follows it as far as legally possible, stops at the last legal hex, and loses the remainder of that movement; it cannot reroute. If a declared target becomes invalid before a later declared Action resolves—for example, because an earlier Action in the same turn defeated that target—the later Action is lost. A Fated may also voluntarily abandon a still-valid declared Action after the turn has begun; that Action is lost and cannot be replaced, changed, or retargeted. The Multi-Action penalty is fixed when the turn is declared, based on the total number of Main Actions declared, and does not decrease if one or more later Actions are lost, abandoned, or become impossible. The Success Threshold of the declared Main Actions is then modified according to their total number, as per the table below:

| Number of Actions | Success Threshold |
| :---- | :---- |
| 1 | \- |
| 2 | \+1 |
| 3 | \+2 |

# Resting and Recovery

# Resting and Recovery

Recovering Hope and Endurance, as well as healing Wounds can be achieved multiple ways.

# Resting

## Short Rest

A short rest is a small respite between events on an adventuring day. It consists of an hour of pause or very light activity.

### Endurance and Hope

During a short rest, Fated recover 1 point of Endurance. Additionally, once per Short Rest, a Fated may spend 1 point of Hope to recover up to a number of Endurance points equal to their Heart value. Spending Hope reduces the Fated’s current Hope by 1, even if this takes it from 0 into negative Hope or further into negative Hope. A Fated already at their negative Hope Limit cannot spend Hope. Because Broken requires the Fated to be both Despondent and Exhausted, the 1 point of Endurance recovered by a Short Rest normally removes Exhausted and therefore ends Broken. The Fated remains Despondent, however, and will become Broken again if their Endurance returns to 0 while they remain at their negative Hope Limit.

Fellowship Points are not used in the v0.1 rules. The intended shared Fellowship Point pool, and any recovery effects that spend it, are deferred to a later version.

### Wounds

During a short rest, a successful Healing roll allows a Fated to bandage a Wound. This allows the Wounded Fated to ignore 1 point of penalty to their Success Threshold for a number of days equal to the number of successes of the Healing roll, at which point the wounded Fated will need to be bandaged again. A Fated who was stabilized on Death's Door and completes a Short Rest recovers from Death's Door: their wound severity is reduced from 3 to 2, leaving them with a Grievous Wound and ending the Incapacitation caused by Death's Door.

The Fated still counts as having the Wound for the purposes of taking further damage. A Fated with a bandaged Light Wound who suffers a Wound becomes Grievously Wounded, and a Fated with a bandaged Grievous Wound who suffers a Wound is placed on Death's Door.

If the bandaged wound is a Grievous Wound, if the wounded Fated attempts Multi-Action, the bandage will break, losing the beneficial effect (The regained Wound penalties are applied AFTER the Multi Action, not affecting the Multi Action itself).

## Long Rest

A Long Rest consists in at least 8 hours of light activity and sleep between adventuring days.

### Endurance and Hope

During a Long Rest a Fated recovers Endurance equal to his Body value, as well as 1 point of Hope for having survived yet another day. At the end of a completed Long Rest, the Fated's current Power resets to 0, representing the loss of accumulated heroic momentum.

### Wounds

During Long Rests, Fated can attempt to treat Wounds, one step higher than bandaged.
In case of a Light Wound, a successful Healing roll allows the Wound to be healed, removing the Wound from the Fated
In case of a Grievous Wound, a successful Healing roll allows the Fated to ignore the penalty to their Success Threshold for a number of days equal to the number of successes, at which point the wounded Fated will need to be treated again.
If a Fated with a Treated Grievous Wound would suffer a Wound from a damage instance, that Wound does not increase wound severity. Instead, the treatment is lost: the Grievous Wound reopens and its full Success Threshold penalty returns. The Fated remains Grievously Wounded; subsequent Wounds are resolved normally and may place the Fated on Death's Door.

## Extended Rest

An Extended Rests consists in at least a full 24 hours in a Safe Heaven (TBD).

### Endurance and Hope

During an Extended Rest, a Fated recovers their Endurance fully. They also recover 1 point of Hope every day spent resting. Current Power resets to 0 at the beginning of an Extended Rest, representing the loss of accumulated heroic momentum between adventures.

### Wounds

During an Extended Rest, Light Wounds are healed.
Each day, a Fated can attempt a Healing roll to treat a Grievous Wound. 24 hours after a successful attempt, the Wound heals.

# Experience and Advancements

# Advancements

Fated, during their adventures, earn meaningful experiences through their successes and failures, as well as the connections they make and places they visit.
During an Extended Rest, the Fated can turn this Experience into newfound power to tackle their next adventures.

# Skill points

During adventures, the GM may award the Fated with Skill Points. These work exactly like the Skill Points used during character creation.
During an Extended Rest, Fated may spend their Skill Points to improve their Skill Levels.

# Equipment

# Equipment

## Weapons

| Name | Class | Primary Action Damage | Load | Special Rules |
| :---- | :---- | :---- | :---- | :---- |
| Short Sword | Swords | 3 | 1 |  |
| Short Spear | Spears | 2 | 1 | Can be thrown |
| Greataxe | Axes | 5 | 3 | 2 handed Specialized |
| Crossbow | Bows | 2 | 2 | Ranged |
| Longbow | Bows | 3 | 1 | Ranged |

### Special rules:

**Specialized: a Fated may use a Specialized weapon even without the required training. If its Weapon Proficiency in the weapon’s class is lower than 2, only results of 6 on its Success Dice score successes. This is a penalizing exception to the normal Critical Success rule: those 6s cannot be chosen to count as 2 successes, but they still generate 1 Power each.**
**2 handed: the Fated is expected to use both hands to wield the weapon, but may attempt to use it with fewer. If it does, only results of 6 on its Success Dice score successes. This is a penalizing exception to the normal Critical Success rule: those 6s cannot be chosen to count as 2 successes, but they still generate 1 Power each.**
**Thrown/Ranged: this trait indicates that the weapon provides at least one ranged Weapon Action.**

**Equipment structure: Weapons and general Equipment use the same underlying item structure. A Weapon is a category of Equipment rather than a separate item type. Equipment stores its Load, any applicable Proficiency, traits or special properties, and one or more Equipment Actions. Proficiencies are not limited to weapons; other Equipment, such as specialist tools, may also use a Proficiency. When an Equipment Action requires a Dice Roll, it uses the Equipment's Proficiency if one is defined; if the Equipment has no specific Proficiency, the Action may instead specify a Skill to determine its Success Dice. Equipment Actions do not directly use Attributes as their roll source. Damage is not an intrinsic Equipment statistic; each damaging Equipment Action has its own fixed Damage value. The sample weapon table above lists the Damage of each weapon's current primary Action as a shorthand until additional Actions are defined.**

**Each Equipment Action defines its Range, any optional Minimum Range, its Allowed Stances where relevant, whether it is a damaging Action and, if so, its fixed Damage, any Success Die modifier, any Success Threshold modifier, and any Special Effects. Range represents the Action's maximum range unless a Minimum Range is explicitly specified. There is no default Minimum Range for ranged Actions; any such restriction must be written into the individual Action, although many ranged weapon Actions are expected to define one. Equipment bonuses and penalties use the two normal roll levers: they may add or remove Success Dice and/or modify the Success Threshold. They do not dynamically modify Damage, Defense, Range, Load, Armor, Hope, Endurance, Power, or other core values. Those values remain fixed unless a core rule explicitly defines otherwise. An Equipment Action that requires a Dice Roll is a Main Action. An Equipment Action that requires no Dice Roll is a Free Action. Passive effects are not Actions and simply apply while their stated conditions are met. Extraordinary Power Actions remain governed by the Power rules.**

**Consumables are a category of Equipment. They track a Quantity and use the normal Equipment Action structure. When an Action consumes the item, its Quantity is reduced when that Action resolves, not when it is declared. If the Action is lost or becomes impossible before resolving, the item is not consumed unless a specific rule states otherwise.**

## Armor

| Name | Class | Armor | Load | Special Rules |
| :---- | :---- | :---- | :---- | :---- |
| Leather Tunic | Leather | 1 | 1 |  |
| Chainmail | Mail | 3 | 2 | Noisy |

### Special rules:

**Noisy: the success threshold for stealth rolls while wearing this armor has a penalty of 1\.**

**Armor structure: Armor provides a fixed Armor value that is added to the wearer's Defense, has a Load value, and can be Worn or not Worn. Armor may apply targeted Success Die and/or Success Threshold modifiers and may have Special Effects. A targeted modifier must identify the specific Skill, Proficiency, item, or named Equipment Action it affects rather than relying on a general Action-tag system or applying as a general penalty to every roll. Armor effects do not dynamically modify Damage, Defense, Range, Load, Armor, Hope, Endurance, Power, or other core values beyond the Armor's own fixed contribution to Defense.**

# Adversaries and NPCs

# Adversaries and NPCs

## Adversaries

# Enemies of the Fated can come in multiple forms. Most of them will be Shadow-aligned; however, there could be some Light-aligned NPCs that oppose the Fated in their quest against the Shadow, for one reason or another. These are not Shadow-aligned but count as Adversaries.

## Fated NPCs and Adversaries

In their journey, the Fated may encounter other Fated such as themselves. These could be either Light or Shadow aligned (the Shadow chooses its champions as much as the Light\!). They follow the same rules as the Player Fated, with the exception of the Power statistic, which they don’t innately have.
These Fated can either help, hinder or be neutral to the Player Fated, making them potential adversaries, regardless of alignment.

## Power for Adversaries and NPCs

NPCs and Adversaries do not have a Power statistic. When an adversary would use Power, the Game Master spends points from the shared Shadow pool instead, following the normal Power rules. Dice added or rolled by spending Shadow follow the same rules as Power Dice: they use the normal Success Threshold, a 6 may count as 2 successes, and they can never generate Shadow. This applies to Adversary Fated regardless of whether they are Light- or Shadow-aligned.

## NPCs

Non-Fated NPCs, be they enemy combatants or denizens of the world, unless Fated, are mechanically much simpler. Unless otherwise specified, they do not have a Wounds characteristic. Should they suffer a Wound, they are immediately on Death’s Door.
Their primary attributes and relevant skills are defined on their NPC character sheet.
They do not roll a Fate die on their Dice Rolls, therefore not generating Shadow or Hope.
Non-Fated NPCs do not track Hope, Endurance, or Load separately. Instead, they use a single Resilience stat. Any rule or effect that would interact with an NPC’s Hope, Endurance, or Load interacts with Resilience instead. Resilience is the only such resource that needs to be tracked for the NPC or NPC group.

# The Game Master

# The Game Master

# Shadow

Shadow is gained by the Game Master (GM) in different ways. Because Dice Rolls can generate Shadow, Hope, and Power, the GM should call for a roll only when the outcome is uncertain and consequential. Routine, automatic, impossible, or narratively settled actions are resolved without rolling; players cannot create repeated checks solely to generate resources.
The main way the GM gains Shadow is through Dice Rolls. Whenever a Fated or an NPC aligned with the Light rolls a 1 on the Fate Die, the GM gains 2 Shadow; on a 2–4, the GM gains 1 Shadow. Whenever an adversary rolls a 6 on a Success Die, that die is a Critical Success. For each such 6, the GM chooses either to count it as 2 successes or to generate 1 Shadow. This mirrors the Critical Success choice available to the Fated and also applies to non-Fated adversaries, even though they do not roll a Fate Die.
Shadow is the Game Master’s equivalent of Power for adversaries. It is a single shared pool with no maximum, and it never resets. Whenever an adversary would spend Power, the GM may spend Shadow from this pool instead, using the same costs, effects, and restrictions as Power.
