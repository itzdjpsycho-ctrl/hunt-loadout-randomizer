# Loadout rules and source decisions

Checked on 23 September 2026 against the official player guide and Update 2.8/2.9 material.

## Current inventory rules

- Two weapon positions; individual weapons have Size 1 through Size 5.
- Combined weapon capacity is at most 5, or 6 with Quartermaster.
- Eight shared equipment positions accept tools or consumables.
- Consumables are capped at four per category: Throwables, Placeables, Shots, Tarot Cards. The cap is per category, not simply per identical item.

Each tool must be unique; consumables may repeat within these limits. Quartermaster must be equipped on the Hunter, costs 8 Upgrade Points to buy, and unlocks at Bloodline rank 1. See the [requirements audit](requirements-audit.md) for the source checks and newly recorded per-item unlock requirements.

Source: [Crytek inventory rework, 2 June 2026](https://www.huntshowdown.com/news/inventory-slot-rework), corroborated by the [current player guide](https://www.huntshowdown.com/player-guide).

Examples: 4+1 and 3+2 fit the normal budget. 4+2, 3+3, and 5+1 require Quartermaster. A Size 5 weapon fills the normal capacity on its own. Two Size 4 weapons do not fit either budget.

Do not implement the old three-size system or hardcode four tools plus four consumables. Historical patch tables and old randomizers can describe obsolete rules.

## September patch implications

Update 2.9 adds Burgess, Burgess Bayonet and Burgess Trauma; the family uses Size 3. During Blood Testament they require Battle Pass unlocks, with normal progression planned afterward. The patch also changes seven tool/consumable prices, introduces LeMat High Velocity ammunition, and adjusts several weapon statistics.

Apply the explicit price changes to the research catalog: Tool Box 25, Medical Pack 15, Throwing Spear 145, Throwing Axes 80, Derringer Pennyshot 100, Decoy Fuses 15, Bear Traps 35 Hunt Dollars.

Source: [official Update 2.9 notes, 8 September 2026](https://www.huntshowdown.com/releasenotes/en_US/update-29-patch-notes1788874685).

## Availability and ammo

Separate standard equipment, event unlocks, scarce owned items, removed items, and world pickups. Tarot cards require an owned-item mode; they are not ordinary shop purchases. Water Bottles are world pickups, not selectable starting equipment. The Maxim M1895 is also an in-world weapon and cannot be kept after extraction.

Sources: [Consumables](https://huntshowdown.wiki.gg/wiki/Consumables), [Water Bottle](https://huntshowdown.wiki.gg/wiki/World_Items/Water_Bottle), [official Road to Hell launch](https://www.huntshowdown.com/news/update-28-road-to-hell-go-live).

Do not assume all ammunition with similar names shares a reserve pool. The 2.8 changes separate Special Long from ordinary Long. Do not assign custom ammo globally: support and scarcity differ by weapon and variant.

Source: [official Update 2.8 notes](https://www.huntshowdown.com/releasenotes/en_US/update-281781019648).

## Research confidence

Official recent notes take precedence for explicit changes. Individual wiki pages provide a broad equipment inventory but can lag patches or conflict with category pages. The catalog records source URLs and snapshot revisions, and flags unresolved availability. A listed price does not prove an item is currently unlocked for a player.

Tools and consumables overview groupings such as “Distraction” and “Fire/Light” are wiki browsing groups, **not** the four game categories used for consumable limits. Do not feed those group labels directly into a legality validator.

Prices are the listed equipment prices, not a certified total including custom ammo, player inventory, discounts, or cosmetics. Unknown values remain null, never zero.
