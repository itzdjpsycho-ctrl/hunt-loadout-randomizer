$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$catalog = Get-Content (Join-Path $projectRoot 'data/equipment.json') -Raw | ConvertFrom-Json
$rules = Get-Content (Join-Path $projectRoot 'data/loadout-rules.json') -Raw | ConvertFrom-Json
$csv = @(Import-Csv (Join-Path $projectRoot 'data/equipment.csv'))
function Assert($condition, [string]$message) { if (!$condition) { throw $message } }
Assert ($catalog.schemaVersion -eq 2) 'Expected requirements schema version 2'
Assert ($csv.Count -eq $catalog.items.Count) 'CSV and JSON count mismatch'
Assert (@($catalog.items | Group-Object id | Where-Object Count -gt 1).Count -eq 0) 'Duplicate item IDs'
Assert ($rules.weaponPositions -eq 2 -and $rules.weaponCapacity.default -eq 5 -and $rules.weaponCapacity.withQuartermaster -eq 6) 'Weapon limits differ from official guide'
Assert ($rules.equipmentPositions -eq 8 -and $rules.uniqueToolsOnly) 'Equipment or uniqueness rules missing'
Assert ($rules.quartermaster.upgradePointCost -eq 8 -and $rules.quartermaster.mustBeEquippedOnHunter) 'Quartermaster purchase/equip requirement missing'
foreach ($category in @('throwables','placeables','shots','tarot-cards')) { Assert ($rules.consumableCategoryLimits.$category -eq 4) "Incorrect cap: $category" }
$byId = @{}
$sizeChecks = 0
$rankChecks = 0
$corroboratedRanks = 0
foreach ($item in $catalog.items) {
    $byId[$item.id] = $item
    Assert ($null -ne $item.requirements -and $item.sourceRevision -and $item.sourceUrl) "Missing evidence or requirements: $($item.id)"
    $html = Get-Content (Join-Path $projectRoot $item.sourceSnapshot) -Raw
    $csvItem = @($csv | Where-Object id -eq $item.id)
    Assert ($csvItem.Count -eq 1 -and $csvItem[0].unlockSummary -eq $item.unlockSummary) "CSV requirement mismatch: $($item.id)"
    if ($item.kind -eq 'weapon') {
        $sizeMatch = [regex]::Match($html, '(?s)druid-data-Size druid-data-nonempty">(.*?)</div>')
        $sourceSize = [regex]::Replace($sizeMatch.Groups[1].Value, '<[^>]+>', ' ').Trim()
        Assert ($sourceSize -match '^[1-5]$' -and [int]$sourceSize -eq $item.capacity) "Size mismatch: $($item.id)"
        Assert (!$item.dualWield.enabledForGeneration -and $null -eq $item.dualWield.pairCapacity) "Unverified dual pair enabled: $($item.id)"
        $sizeChecks++
    }
    if ($item.kind -eq 'tool') { Assert ($item.requirements.maxIdenticalToolCopies -eq 1) "Duplicate tool allowed: $($item.id)" }
    if ($item.requirements.purchaseRoute -eq 'bloodline-rank') {
        $unlockMatch = [regex]::Match($html, '(?s)druid-data-Unlock druid-data-nonempty">(.*?)</div>')
        $unlockText = [regex]::Replace($unlockMatch.Groups[1].Value, '<[^>]+>', ' ').Trim()
        Assert ($unlockText -match '^Bloodline Rank (\d+)$') "Missing source rank: $($item.id)"
        $sourceRank = [int]$Matches[1]
        Assert ($item.requirements.bloodlineRank -eq $sourceRank) "Rank mismatch: $($item.id)"
        $rankChecks++
        if ($item.requirements.sources -contains 'https://huntshowdown.wiki.gg/wiki/Bloodline') { $corroboratedRanks++ }
    }
    if ($item.kind -eq 'consumable' -and $item.availability -eq 'standard-candidate') {
        Assert ($item.consumableLimitCategory -in @('throwables','placeables','shots','tarot-cards')) "Missing consumable category: $($item.id)"
    }
    if ($item.availability -in @('removed','event-review-required')) {
        Assert ($item.requirements.excludedUntilReviewed -and $item.requirements.purchaseRoute -eq 'excluded') "Restricted item enabled: $($item.id)"
    }
    if ($item.availability -eq 'scarce-owned-only') {
        Assert ($item.requirements.ownedEquippableInstanceRequired -and $item.requirements.purchaseRoute -eq 'not-purchasable') "Scarce item buyable: $($item.id)"
    }
}
Assert ($rankChecks -eq 51 -and $corroboratedRanks -eq 50) 'Unexpected Bloodline audit coverage'
Assert ($sizeChecks -eq 150) 'Unexpected weapon size coverage'
Assert ($byId['throwing-spear'].requirements.bloodlineRank -eq 33) 'Throwing Spear must unlock at rank 33'
Assert ($byId['tool-box'].requirements.bloodlineRank -eq 55) 'Tool Box must unlock at rank 55'
Assert ($byId['recovery-shot'].requirements.bloodlineRank -eq 1) 'Recovery Shot rank missing'
Assert ($byId['bomb-lance'].requirements.explicitArsenalUnlockConfirmation) 'Standalone wiki page must not imply rank-1 unlock'
foreach ($id in @('burgess','burgess-bayonet','burgess-trauma')) { Assert ($byId[$id].requirements.eventUnlockConfirmation) "Event unlock missing: $id" }
Assert (!$rules.proposedDefaults.enableDualWieldRandomization -and !$rules.proposedDefaults.enableCustomAmmoRandomization) 'Unverified options must remain disabled'
Write-Output "PASS: $($catalog.items.Count) requirement records and CSV rows; $sizeChecks weapon sizes; $rankChecks purchase ranks ($corroboratedRanks corroborated); restricted gear and default rules."
