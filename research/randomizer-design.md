# Randomizer design notes

Research date: 23 September 2026. Target: Hunt: Showdown 1896, Update 2.9.
The standalone app now implements the core modes, trait preferences, arsenal filters, budgets, held cards, seeds and exports. This document retains design direction; custom ammo, dual wield, family-wide exclusions and full URL sharing remain potential extensions.

## Core experience

Generate a surprising loadout that the player can actually equip. Show two weapon positions, eight shared equipment positions, the weapon capacity used, and any required unlocks or traits. Allow empty positions where the rules or a challenge demand them.

- **Fun but playable:** reserve First Aid Kit and a melee option; optionally require a team-support item. Avoid redundant utility by default. These are convenience constraints, not game rules.
- **Full chaos:** relax the convenience constraints while retaining capacity and equipment-category limits.
- **Theme roll:** select a theme, then randomly choose eligible items rather than returning a fixed preset.
- **Owned arsenal:** allow scarce or event equipment only after the player enables specific owned/unlocked items.
- **Budget roll:** use a Hunt Dollar cap, with unknown prices excluded from strict budget calculations.

## Theme ideas

| Theme | Selection idea |
| --- | --- |
| Bayou Cowboy | Lever-action rifle and single-action revolver; dynamite flavor |
| Quiet Trouble | Silenced weapons or bows/crossbows, throwing tools, restrained explosives |
| Door-to-Door Salesman | Shotgun, close-range backup, breaching and distraction equipment |
| Trap Gremlin | Traps and area-denial equipment with a practical weapon pair |
| Field Medic | Healing, regeneration, and teammate support |
| Arson Enthusiast | Fire-oriented tools/consumables and compatible ammo once validated |
| Pocket Change | Cheap weapons and a strict total budget |
| Bayou Roulette | Broad variety, optional melee-only or deliberately awkward challenges |

Theme membership is an app editorial decision; it must not silently change game legality.

## Controls worth building

- Hold items during squad deals and loadout mulligans; mulligan losses can remove held gear. Item mulligans lose one random item. Loadout mulligans cost 1, then 2, then 3 items per hunter, and cannot restore previously empty slots.
- Exclude disliked weapons, scopes, traps, or entire families.
- Quartermaster toggle that updates the capacity budget.
- Enable event unlocks and owned scarce gear explicitly.
- Optional custom ammo and dual-wield modes after their compatibility is verified.
- Seeded rolls and shareable loadouts, including the catalog/rules version.
- Solo/duo/trio preference for utility weighting.
- Explain why an item was excluded or why a set of locks has no valid completion.

## Selection strategy

1. Filter by availability, unlocks, exclusions, and budget completeness.
2. Respect locked equipment and verify that it is still valid under the selected rules.
3. Choose a weapon family first, then a variant, so families with many variants do not dominate every roll. Offer uniform-by-item randomness as an alternative.
4. Choose only combinations that fit the weapon capacity budget.
5. Fill shared equipment positions while tracking consumable category counts.
6. Apply the selected convenience/theme constraints, then validate the entire result again.
7. If no completion exists, explain the conflicting filters. Do not loop indefinitely or relax rules silently.

## Data work before app implementation

The research catalog supplies names, sizes, listed prices, base ammo types, availability flags, and item sources. It is not yet a fully verified randomization pool. Complete and verify:

- Consumable limit-category assignment for every item, including beetles, satchels, and unusual event items.
- Enforce the audited one-copy-per-tool restriction; verify exact dual-pistol capacity/compatibility before enabling pairs.
- Per-variant custom ammo choices, split ammo slots, current scarce ammo restrictions, and additional prices.
- Use the audited Bloodline ranks for tools/consumables and obtain player-specific weapon unlock/owned inventory settings; exact weapon XP thresholds remain unverified.
- Manual theme/role tags and weapon family aliases, keeping them distinct from sourced facts.
- A final in-game spot check of capacity, prices, unlocks and any wiki/patch conflicts.

Keep the rules versioned and separate from UI code. Keep cosmetics out of gameplay-item counts; skins should be optional presentation choices later.
