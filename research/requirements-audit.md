# Gear requirements audit

Checked 23 September 2026. The official release index still lists Update 2.9 (8 September 2026) as the latest patch. This is a source audit, not an in-game or player-account inspection.

## Result

The original inventory capacity rules match the current official guide. The original catalog was incomplete for player eligibility: it recorded item availability but omitted Bloodline ranks and duplicate-tool restrictions, and it did not distinguish an unlock to purchase from an already-owned item. Those requirements are now recorded in the JSON, CSV, readable catalog and rules file.

| Check | Result |
| --- | --- |
| Weapons | Two positions, combined Size at most 5; 6 with equipped Quartermaster |
| Equipment | Eight positions shared by tools and consumables |
| Consumable limits | At most four each of Throwables, Placeables, Shots and Tarot Cards |
| Duplicate tools | One of each tool; tool charges are not additional equipped copies |
| Duplicate consumables | Allowed within the equipment/category limits; owned mode also needs enough copies |
| Quartermaster | Rank 1 unlock, 8 Upgrade Points to buy; the selected Hunter must have it equipped |
| Weapons/variants | All 150 sizes checked against their individual wiki infoboxes; no category/infobox disagreement |
| Ordinary tools/consumables | All 51 have explicit Bloodline purchase ranks |
| Rank corroboration | 50 agree with the Bloodline overview; Recovery Shot rank 1 is supported by its item page but omitted from that overview |
| Current event weapons | Three Burgess entries require the relevant Blood Testament unlock to purchase during the event |
| Scarce gear | Four weapons and 14 Tarot cards require a confirmed equippable inventory copy; no ordinary shop purchase |
| Removed/historical event gear | Two removed tools and ten event-review entries remain excluded |

Capacity and equipment limits: [Crytek inventory rework](https://www.huntshowdown.com/news/inventory-slot-rework) and [player guide](https://www.huntshowdown.com/player-guide). Tool uniqueness: [Hunters](https://huntshowdown.wiki.gg/wiki/Hunters). Quartermaster: [trait reference](https://huntshowdown.wiki.gg/wiki/Traits/Quartermaster). Rank corroboration: [Bloodline](https://huntshowdown.wiki.gg/wiki/Bloodline), plus individual item sources in the catalog, including [Recovery Shot](https://huntshowdown.wiki.gg/wiki/Consumables/Recovery_Shot).

## Purchase versus use

An unlocked item can be bought when the player has the required Hunt Dollars. A confirmed equippable item already in the arsenal is a separate acquisition route. Do not apply a purchase unlock as an automatic ban on an owned copy. Conversely, owning one copy does not permit unlimited repeat purchases. Count actual copies for owned-only rolls.

For ordinary weapons the dataset conservatively requires confirmation that the exact item is unlocked in the player's arsenal before offering to buy it. This is an app eligibility policy, not an extra game requirement. Base weapon access and variant progression differ; exact XP thresholds are not reliably documented in the current item infoboxes. Do not infer unlock progression from wiki URL paths or the catalog's `family` label: standalone page names can still represent progression unlocks.

References: [weapon progression summary](https://huntshowdown.wiki.gg/wiki/Weapons), [owned-versus-unlocked explanation](https://steamcommunity.com/sharedfiles/filedetails/?id=2760060527). The latter is community guidance; the app should use a player's confirmed equippable inventory rather than assume account state from it.

Burgess unlocks persist through Prestige during Blood Testament; ordinary rank-based unlocks reset on Prestige. Refresh the player's unlock state after Prestige. The Battle Pass statement alone does not establish that a paid pass is necessary. [Official Update 2.9](https://www.huntshowdown.com/releasenotes/en_US/update-29-patch-notes1788874685), [Bloodline progression](https://huntshowdown.wiki.gg/wiki/Bloodline).

## Restrictions still needing confirmation

- **Dual wield:** 25 current item descriptions explicitly support it. Exact current pair capacity and pairing compatibility have not been verified sufficiently; pair generation remains disabled. A pair must never inherit the capacity of a single pistol. Older guides use obsolete slot sizes.
- **Custom ammo:** the complete per-variant compatibility/slot/price matrix remains unverified; custom ammo generation stays disabled. Some options are scarce or removed, so merely appearing in an old weapon guide is insufficient. Update 2.8 makes Dumdum, Explosive and Spitzer scarce, along with Frag Arrows and Waxed Frag Charges, and retires Dolch FMJ. Update 2.9 adds LeMat High Velocity. [Official 2.8 notes](https://www.huntshowdown.com/releasenotes/en_US/update-281781019648), [official 2.9 notes](https://www.huntshowdown.com/releasenotes/en_US/update-29-patch-notes1788874685).
- **Player state:** Bloodline rank, actual weapon unlocks, owned quantities, available money and equipped traits cannot be inferred from public sources. The app needs player settings for these.

Traits recommended for handling or reload speed are not automatically requirements to equip the weapon. Keep those recommendations separate from Quartermaster's conditional capacity requirement.

## Validation

Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/audit-requirements.ps1` from this project folder. It checks each catalog entry and export against the saved evidence, rejects missing requirements, and checks the critical restricted-item cases. Passing this audit establishes internal/source consistency; it does not establish live account eligibility.
