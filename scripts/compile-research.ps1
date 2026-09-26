$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$sourceRoot = Join-Path $projectRoot 'sources'
$itemRoot = Join-Path $sourceRoot 'items'
New-Item -ItemType Directory -Force -Path $itemRoot | Out-Null
function Plain([string]$html) {
    return [regex]::Replace([System.Net.WebUtility]::HtmlDecode([regex]::Replace($html, '<[^>]+>', ' ')), '\s+', ' ').Trim()
}
function Field([string]$html, [string]$key) {
    $m = [regex]::Match($html, '(?s)<div class="druid-data druid-data-' + [regex]::Escape($key) + ' druid-data-nonempty">(.*?)</div>')
    if ($m.Success) { return Plain $m.Groups[1].Value }
    return $null
}
function Slug([string]$name) { return ([regex]::Replace($name.ToLower(), '[^a-z0-9]+', '-')).Trim('-') }
$items = [ordered]@{}
foreach ($size in 1..5) {
    $html = Get-Content (Join-Path $sourceRoot "size-$size.html") -Raw
    foreach ($m in [regex]::Matches($html, '<li><a href="(/wiki/Weapons/[^"#]+)"[^>]*>([^<]+)</a></li>')) {
        $path = $m.Groups[1].Value
        $name = (Plain $m.Groups[2].Value).Replace('Weapons/', '').Replace('/', ' ')
        $items[$path] = [ordered]@{id=Slug $name; name=$name; kind='weapon'; capacity=$size; sourceUrl="https://huntshowdown.wiki.gg$path"; availability='standard-candidate'; group=$null}
    }
}
foreach ($kind in @('tool','consumable')) {
    $html = Get-Content (Join-Path $sourceRoot "$($kind)s.html") -Raw
    $tokens = [regex]::Matches($html, '(?s)<h[234]\b[^>]*>.*?</h[234]>|<div class="gallerytext">.*?</div>')
    $group = ''
    $availability = 'standard-candidate'
    foreach ($token in $tokens) {
        if ($token.Value -match '^<h') {
            $group = Plain $token.Value
            if ($group -match 'Removed') { $availability = 'removed' }
            elseif ($group -eq 'Tarot Cards') { $availability = 'scarce-owned-only' }
            elseif ($group -match 'Event specific') { $availability = 'event-review-required' }
            elseif ($group -match 'Currently available') { $availability = 'standard-candidate' }
            continue
        }
        $m = [regex]::Match($token.Value, '<a href="(/wiki/[^"#]+)"[^>]*>(.*?)</a>')
        if (!$m.Success) { continue }
        $path = $m.Groups[1].Value
        $name = Plain $m.Groups[2].Value
        $items[$path] = [ordered]@{id=Slug $name; name=$name; kind=$kind; capacity=$null; sourceUrl="https://huntshowdown.wiki.gg$path"; availability=$availability; group=$group}
    }
}
$counter = 0
foreach ($item in $items.Values) {
    $counter++
    $file = Join-Path $itemRoot "$($item.kind)-$($item.id).html"
    try {
        if (!(Test-Path $file)) { (Invoke-WebRequest -UseBasicParsing -Uri $item.sourceUrl -TimeoutSec 30).Content | Set-Content -Encoding utf8 $file }
        $html = Get-Content $file -Raw
        $price = Field $html 'Price'
        $item.priceHuntDollars = if ($price -match '^\d+$') { [int]$price } else { $null }
        $item.priceSourceText = $price
        $item.ammoType = Field $html 'AmmoType'
        $categoryMatch = [regex]::Match($html, '"wgCategories":(\[[^\]]*\])')
        $item.wikiCategories = [string[]]@()
        if ($categoryMatch.Success) { $item.wikiCategories = [string[]]($categoryMatch.Groups[1].Value | ConvertFrom-Json) }
        $item.consumableLimitCategory = $null
        if ($item.kind -eq 'consumable') {
            if ($item.wikiCategories -contains 'Tarot Cards' -or $item.group -eq 'Tarot Cards') { $item.consumableLimitCategory = 'tarot-cards' }
            elseif ($item.name -match 'Shot(?: \(Weak\))?$') { $item.consumableLimitCategory = 'shots' }
            elseif ($item.wikiCategories -contains 'Placeable Consumables') { $item.consumableLimitCategory = 'placeables' }
            elseif ($item.wikiCategories -contains 'Throwable Consumables') { $item.consumableLimitCategory = 'throwables' }
        }
        $item.family = if ($item.kind -eq 'weapon') { [Uri]::UnescapeDataString(($item.sourceUrl -split '/wiki/Weapons/')[1].Split('/')[0]).Replace('_',' ') } else { $null }
        $item.sourceRevision = [regex]::Match($html, '"wgRevisionId":(\d+)').Groups[1].Value
        $item.researchedOn = '2026-09-23'
        $item.sourceSnapshot = "sources/items/$($item.kind)-$($item.id).html"
        $item.verification = 'wiki-snapshot; not checked in game'
        $item.notes = @()
        if ($item.priceSourceText -eq 'Scarce' -and $item.availability -eq 'standard-candidate') { $item.availability = 'scarce-owned-only' }
        if ($item.kind -eq 'weapon') {
            $pageSize = Field $html 'Size'
            if ($pageSize -match '^[1-5]$' -and [int]$pageSize -ne $item.capacity) {
                $item.notes += "Size category says $($item.capacity), item page says $pageSize; review required."
                $item.availability = 'conflict-review-required'
            }
        }
        if ($item.name -match '^Burgess') { $item.availability = 'event-unlock-required'; $item.notes += 'Blood Testament Battle Pass unlock required during the event; normal progression afterward (official Update 2.9).' }
        if ($item.priceHuntDollars -eq $null -and $item.availability -eq 'standard-candidate') { $item.availability = 'availability-review-required' }
        $patchPrices = @{'Tool Box'=25; 'Medical Pack'=15; 'Throwing Spear'=145; 'Throwing Axes'=80; 'Derringer Pennyshot'=100; 'Decoy Fuses'=15; 'Bear Traps'=35}
        if ($patchPrices.ContainsKey($item.name)) {
            $item.priceHuntDollars = $patchPrices[$item.name]
            $item.priceOverrideSource = 'https://www.huntshowdown.com/releasenotes/en_US/update-29-patch-notes1788874685'
            $item.notes += 'Price confirmed against official Update 2.9 notes; priceSourceText retains the wiki value.'
        }
    } catch {
        $item.verification = 'fetch-failed'
        $item.notes = @($_.Exception.Message)
    }
    if ($counter % 25 -eq 0) { Write-Output "Researched $counter / $($items.Count) items" }
}
. (Join-Path $PSScriptRoot 'add-requirements.ps1')
$catalog = [ordered]@{
    schemaVersion=2
    researchedOn='2026-09-23'
    targetPatch='2.9'
    status='Research catalog, not a certified complete in-game database. Review flagged entries before enabling them.'
    sourceLicense='Wiki source content: CC BY-SA 4.0 unless otherwise noted. Game assets have separate rights; no images bundled in app data.'
    items=@($items.Values | ForEach-Object { [pscustomobject]$_ })
}
$catalog | ConvertTo-Json -Depth 12 | Set-Content -Encoding utf8 (Join-Path $projectRoot 'data/equipment.json')
$catalog.items | Select-Object id,name,kind,family,capacity,ammoType,priceHuntDollars,availability,consumableLimitCategory,unlockSummary,@{n='bloodlineRank';e={$_.requirements.bloodlineRank}},group,sourceUrl | Export-Csv -NoTypeInformation -Encoding utf8 (Join-Path $projectRoot 'data/equipment.csv')
$catalog.items | Group-Object kind | Select-Object Name,Count
$lines = @('# Equipment catalog', '', 'Research snapshot: 23 September 2026. Prices are Hunt Dollars for the item alone; unknown prices are shown as a dash. Availability flags are explained in the README. Includes historical and restricted items for reference, not just a default randomization pool.', '')
foreach ($kind in @('weapon','tool','consumable')) {
    $lines += "## $kind"
    $lines += ''
    $lines += '| Name | Capacity | Base ammo / reference group | Price | Availability | Access requirement |'
    $lines += '| --- | --- | --- | --- | --- | --- |'
    foreach ($item in ($catalog.items | Where-Object kind -eq $kind | Sort-Object name)) {
        $size = if ($null -eq $item.capacity) { '-' } else { $item.capacity }
        $price = if ($null -eq $item.priceHuntDollars) { '-' } else { $item.priceHuntDollars }
        $group = if ($kind -eq 'weapon') { $item.ammoType } else { $item.group }
        $lines += "| [$($item.name)]($($item.sourceUrl)) | $size | $group | $price | $($item.availability) | $($item.unlockSummary) |"
    }
    $lines += ''
}
$lines | Set-Content -Encoding utf8 (Join-Path $projectRoot 'research/equipment-catalog.md')
