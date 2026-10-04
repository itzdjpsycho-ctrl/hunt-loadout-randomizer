# Custom ammunition audit

The optional ammo roller covers 135 weapon variants compiled from the Ammo Types sections of cached variant pages in sources/items/, plus supported dual-wield pairs during the frontend build. Reproduce with scripts/compile-ammo.ps1, then rebuild. Snapshot date remains 24 September 2026; this change does not claim refreshed live prices.

Every weapon with listed purchasable custom ammo has a slot definition. Cached descriptions identify split reserves via ?per slot?; exceptions such as Romero Alamo and Martini-Henry Ironside retain one ammo pool. LeMat, Haymaker and Drilling separate bullet options from shotgun options. Two-slot weapons use the prices already listed for each slot, without halving them again. Dual pairs double each slot?s purchase cost.

Scarce/retired types (Dumdum, Explosive, Spitzer and Frag, plus Dolch FMJ) remain excluded. Weapons without purchasable custom options use their standard ammunition; melee weapons have no ammo to randomize. Players must confirm custom ammo unlocks.

Each eligible ammo slot has 85% custom and 15% standard weight, with custom weight divided equally among compatible options. Legal combinations are filtered by the complete kit budget and selected by their product weights, without prioritizing either weapon. Tight budgets can therefore increase standard ammo frequency. Free ammo reroll controls are removed; item mulligans can redraw weapon ammunition.

Ammo stays attached to each weapon. Holds preserve all its choices and reserve their total cost. Equipment mulligans preserve both weapons' ammo unless a weapon is lost; weapon mulligans preserve the other weapon's ammo unless it is lost. Loadout mulligans redraw ammunition for unheld weapons and preserve ammunition on surviving held weapons. Validation rejects incompatible slot lengths, wrong-barrel ammo, disabled custom ammo and over-budget kits. Cards, copy/JSON export, favorites, history and shared rooms retain every ammo slot. Existing scalar ammo saves remain supported.

Crytek?s [inventory slot rework](https://www.huntshowdown.com/news/inventory-slot-rework) confirms current scarce ammo categories and mixed Berthier ammo use. Cached per-variant pages provide option prices and compatibility.

Burgess, Burgess Bayonet and Burgess Trauma are included under the app assumption that their event unlocks are available. Their current event-unlock metadata remains unchanged. Each uses one ammo slot with Dragon Breath, Flechette, Penny Shot and Slug from its cached weapon page.
