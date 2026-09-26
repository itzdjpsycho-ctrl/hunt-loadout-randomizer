# Dot-sourced by compile-research.ps1 after collecting the item snapshots.
# Uses the existing $items dictionary and Plain / Field helpers.
$bloodlineHtml = Get-Content (Join-Path $sourceRoot 'bloodline.html') -Raw
$bloodlineRanks = @{}
$starting = [regex]::Match($bloodlineHtml, '(?s)id="Starting_Equipment".*?(?=<h3)').Value
foreach ($m in [regex]::Matches($starting, 'href="(/wiki/(?:Tools|Consumables)/[^"#]+)"')) {
    $bloodlineRanks['https://huntshowdown.wiki.gg' + $m.Groups[1].Value] = 1
}
foreach ($row in [regex]::Matches($bloodlineHtml, '(?s)<tr\b[^>]*>\s*<td>(\d+)</td>\s*<td>(.*?)</td>\s*</tr>')) {
    $rank = [int]$row.Groups[1].Value
    foreach ($m in [regex]::Matches($row.Groups[2].Value, 'href="(/wiki/(?:Tools|Consumables)/[^"#]+)"')) {
        $bloodlineRanks['https://huntshowdown.wiki.gg' + $m.Groups[1].Value] = $rank
    }
}
foreach ($item in $items.Values) {
    if ($item.verification -eq 'fetch-failed') { throw "Cannot audit missing snapshot: $($item.name)" }
    $html = Get-Content (Join-Path $projectRoot $item.sourceSnapshot) -Raw
    $unlockText = Field $html 'Unlock'
    $rank = if ($unlockText -match '^Bloodline Rank (\d+)$') { [int]$Matches[1] } else { $null }
    $requirements = [ordered]@{
        checkedOn = '2026-09-23'
        purchaseRoute = 'not-verified'
        bloodlineRank = $null
        sourceUnlockText = $unlockText
        explicitArsenalUnlockConfirmation = $false
        eventUnlockConfirmation = $false
        ownedEquippableInstanceRequired = $false
        excludedUntilReviewed = $false
        equipmentSlots = $(if ($item.kind -eq 'weapon') { 0 } else { 1 })
        maxIdenticalToolCopies = $(if ($item.kind -eq 'tool') { 1 } else { $null })
        sources = @($item.sourceUrl)
        evidence = @()
    }
    switch ($item.availability) {
        'standard-candidate' {
            if ($item.kind -eq 'weapon') {
                # Wiki URL families are not reliable unlock trees (e.g. Bomb Lance).
                # Never infer rank-1 availability just because a URL has no variant suffix.
                $requirements.purchaseRoute = 'arsenal-unlock-confirmation'
                $requirements.explicitArsenalUnlockConfirmation = $true
                $requirements.sources += 'https://huntshowdown.wiki.gg/wiki/Weapons'
                $requirements.evidence += 'Base weapons and variants differ in unlock requirements. Confirm this exact item in the player arsenal; per-variant XP thresholds are not verified.'
            } else {
                if ($null -eq $rank) { throw "Missing Bloodline requirement for $($item.name)" }
                $requirements.purchaseRoute = 'bloodline-rank'
                $requirements.bloodlineRank = $rank
                if ($bloodlineRanks.ContainsKey($item.sourceUrl)) {
                    if ($bloodlineRanks[$item.sourceUrl] -ne $rank) { throw "Conflicting Bloodline rank for $($item.name)" }
                    $requirements.sources += 'https://huntshowdown.wiki.gg/wiki/Bloodline'
                    $requirements.evidence += 'Rank agrees between item infobox and Bloodline overview.'
                } else {
                    $requirements.evidence += 'Rank from current item infobox only; item is absent from the Bloodline overview.'
                }
            }
        }
        'event-unlock-required' {
            $requirements.purchaseRoute = 'event-unlock'
            $requirements.explicitArsenalUnlockConfirmation = $true
            $requirements.eventUnlockConfirmation = $true
            $requirements.sources += 'https://www.huntshowdown.com/releasenotes/en_US/update-29-patch-notes1788874685'
            $requirements.evidence += 'Burgess family requires its Blood Testament Battle Pass unlock during the event. This is not a claim that the paid pass is required.'
        }
        'scarce-owned-only' {
            $requirements.purchaseRoute = 'not-purchasable'
            $requirements.ownedEquippableInstanceRequired = $true
            $requirements.evidence += 'Scarce: use only when the player confirms an equippable copy in the arsenal. Ownership count must cover repeated selections.'
        }
        default {
            $requirements.purchaseRoute = 'excluded'
            $requirements.excludedUntilReviewed = $true
            $requirements.evidence += 'Removed or unresolved event equipment is excluded, including from owned-item overrides.'
        }
    }
    if ($item.kind -eq 'tool') { $requirements.sources += 'https://huntshowdown.wiki.gg/wiki/Hunters' }
    $item.requirements = $requirements
    $item.unlockSummary = switch ($requirements.purchaseRoute) {
        'bloodline-rank' { "Bloodline rank $rank to buy" }
        'arsenal-unlock-confirmation' { 'Confirm exact weapon unlocked to buy' }
        'event-unlock' { 'Blood Testament unlock to buy' }
        'not-purchasable' { 'Owned equippable instance only' }
        default { 'Excluded pending review' }
    }
    $item.dualWield = $null
    if ($item.kind -eq 'weapon') {
        $description = Plain ([regex]::Match($html, '(?s)id="Description".*?</h2>(.*?)(?=<h2)').Groups[1].Value)
        $eligible = if ($description -match '\bCan be dual wielded\b') { $true } else { $null }
        $item.dualWield = [ordered]@{
            supportedByItemDescription=$eligible
            pairCapacity=$null
            enabledForGeneration=$false
            reason='Exact current pair capacity and matching rules are not verified; never use the single-weapon capacity for a pair.'
        }
    }
}
