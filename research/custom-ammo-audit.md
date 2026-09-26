# Custom ammunition audit — 24 September 2026

The optional ammo roller uses **91 weapon-variant mappings** compiled from the current **Ammo Types** section of the previously downloaded, per-variant wiki pages in `sources/items/`. Each included option has an explicit purchase price and a link to its weapon page in `data/custom-ammo.json`. It does not infer compatibility from a weapon family, ammo caliber, patch-history paragraph or category tag.

Reproduce the data with `scripts/compile-ammo.ps1`, then rebuild the app. This command reads existing snapshots; it does not silently update the research date or refresh those pages.

## Cross-checks and scope

- Crytek's [Update 2.8 notes](https://www.huntshowdown.com/releasenotes/en_US/update-281781019648) mark all Dumdum, Explosive (including frag arrows, explosive bolts and waxed frag charges), and Spitzer ammunition scarce, and retire Dolch FMJ. These types are explicitly excluded in addition to excluding any row labelled Scarce.
- Crytek's [custom ammunition introduction](https://www.huntshowdown.com/news/custom-ammo-arrives-in-the-bayou) describes split ammunition reserves for certain weapons. This release does not guess the price or quantity of those separate pools.
- Split-reserve weapons and combination-barrel families are conservatively kept on standard ammunition: Hand Crossbow, LeMat, Sparks, Bomb Launcher, Drilling, Haymaker, Romero 77, Springfield 1866, 1890 Cavalry, Berthier 1892, Bomb Lance, Hunting Bow, Crossbow, Martini-Henry and Maynard Sniper. This list is an exclusion scope, not a claim that every variant has identical ammo handling.
- For included single-pool variants, the roller selects either standard ammunition or one explicitly priced custom option. The listed price is added once to that weapon's purchase price. Both equipment and ammunition count toward the hunter's effective budget, including the $300 challenge.
- Exact per-ammo XP unlock progress is not available locally. The checkbox explicitly asks the player to confirm that the supported custom ammo is unlocked. Bloodline rank continues to gate equipment purchases; it is not substituted for weapon XP progression.

## Behavior and validation

Ammo stays attached to its weapon slot. Holding a weapon preserves its ammo and reserves that ammo's cost before generating the rest of the kit. An equipment-slot reroll preserves both ammo choices; a weapon-slot reroll can select compatible ammunition for the replacement while preserving the other weapon's ammo. Failed generation does not mutate the saved build.

The full-kit validator rejects incompatible ammo, custom ammo while its option is disabled, and equipment-plus-ammo totals over budget. Unsupported weapons use standard ammo. JSON and copied text include chosen custom ammunition; favorites and history persist it with the complete squad.

The included tests check the catalog's source/price shape, exclusion of scarce types, known Conversion FMJ compatibility and price, held ammunition, full-kit budgets, deterministic seeded rolls, and per-hunter UI persistence. These checks validate the app against this research snapshot, not future game patches.
