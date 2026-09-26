$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$catalog = Get-Content (Join-Path $root 'data/equipment.json') -Raw -Encoding utf8 | ConvertFrom-Json
$rules = Get-Content (Join-Path $root 'data/loadout-rules.json') -Raw -Encoding utf8 | ConvertFrom-Json
$traits = Get-Content (Join-Path $root 'data/traits.json') -Raw -Encoding utf8 | ConvertFrom-Json
function Slug([string]$s) { return ([regex]::Replace($s.ToLower(), '[^a-z0-9]+', '-')).Trim('-') }
$appItems = foreach ($item in $catalog.items) {
    $html = Get-Content (Join-Path $root $item.sourceSnapshot) -Raw -Encoding utf8
    $section = [regex]::Match($html, '(?s)id="Recommended_Traits".*?</h2>(.*?)(?=<h2)').Groups[1].Value
    $synergies = @([regex]::Matches($section, 'href="/wiki/Traits/([^"#]+)"') | ForEach-Object { Slug ([Uri]::UnescapeDataString($_.Groups[1].Value).Replace('_',' ')) } | Sort-Object -Unique)
    $melee = $item.group -in @('Melee','Throwable Melee') -or ($item.kind -eq 'weapon' -and ($item.ammoType -eq $null -or $item.name -match 'Bayonet|Riposte|Talon|Trauma|Mace|Claw|Striker|Brawler|Hatchet|Bomb Lance'))
    $limitedTool = $item.kind -eq 'tool' -and $item.group -notin @('Melee') -and $item.id -ne 'spyglass'
    if ($limitedTool) { $synergies += 'frontiersman' }
    # Match current trait-wide descriptions where individual item recommendations lag.
    if ($item.kind -eq 'weapon' -and $item.family -in @('Conversion','Nagant M1895','Pax','Scottfield','Uppercut','Haymaker')) { $synergies += 'fanning' }
    if ($item.family -eq 'LeMat' -and $item.name -notmatch 'Carbine') { $synergies += 'fanning' }
    if ($item.id -eq '1890-cavalry') { $synergies += 'fast-fingers' }
    if ($item.id -eq 'first-aid-kit') { $synergies += @('doctor','physician') }
    if ($item.id -in @('throwing-knives','throwing-axes')) { $synergies += 'assailant' }
    if ($item.group -eq 'Traps') { $synergies += 'poacher' }
    if ($item.group -eq 'Distraction' -and $item.kind -eq 'tool') { $synergies += 'decoy-supply' }
    # Current trait pages explicitly exclude these items; old item recommendations can lag.
    if ($item.id -eq 'dark-dynamite-satchel') { $synergies = @($synergies | Where-Object { $_ -ne 'poacher' }) }
    if ($item.id -eq 'throwing-spear') { $synergies = @($synergies | Where-Object { $_ -ne 'assailant' }) }
    [ordered]@{
        id=$item.id; name=$item.name; kind=$item.kind; family=$item.family
        capacity=$item.capacity; ammo=$item.ammoType; price=$item.priceHuntDollars
        availability=$item.availability; category=$item.consumableLimitCategory
        group=$item.group; melee=[bool]$melee; limitedTool=[bool]$limitedTool
        synergies=@($synergies | Where-Object { $_ -in $traits.id -and $_ -ne 'quartermaster' } | Sort-Object -Unique)
        requirements=$item.requirements; source=$item.sourceUrl
        image='data:image/png;base64,' + [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $root ('assets/equipment/' + $item.id + '.png'))))
    }
}
foreach ($trait in $traits) {
    $pageName = $trait.name.Replace(' ','_')
    $trait | Add-Member -NotePropertyName source -NotePropertyValue "https://huntshowdown.wiki.gg/wiki/Traits/$pageName"
}
$cleanTraits = @($traits | ForEach-Object { [ordered]@{id=$_.id; name=$_.name; effect=$_.effect; kind=$_.kind; source=$_.source} })
$ammo = Get-Content (Join-Path $root 'data/custom-ammo.json') -Raw -Encoding utf8 | ConvertFrom-Json
$bundle = [ordered]@{version='2.9-2026-09-23'; items=@($appItems); rules=$rules; traits=$cleanTraits;ammo=$ammo}
$dataJs = 'window.HUNT_DATA = ' + ($bundle | ConvertTo-Json -Depth 16 -Compress) + ';'
[IO.File]::WriteAllText((Join-Path $root 'app/catalog.js'), $dataJs, [Text.UTF8Encoding]::new($false))
$html = Get-Content (Join-Path $root 'app/index.template.html') -Raw -Encoding utf8
$html = $html.Replace('__STYLES__', (Get-Content (Join-Path $root 'app/styles.css') -Raw -Encoding utf8))
$html = $html.Replace('__DATA__', $dataJs).Replace('__ENGINE__', (Get-Content (Join-Path $root 'app/engine.js') -Raw -Encoding utf8)).Replace('__APP__', (Get-Content (Join-Path $root 'app/app.js') -Raw -Encoding utf8))
$html = $html.Replace('__EXPANSION__', (Get-Content (Join-Path $root 'app/expansion.js') -Raw -Encoding utf8))
[IO.File]::WriteAllText((Join-Path $root 'Chaos-Loadout.html'), $html, [Text.UTF8Encoding]::new($false))
Write-Output "Built Chaos-Loadout.html with $($appItems.Count) equipment records and $($traits.Count) traits."
