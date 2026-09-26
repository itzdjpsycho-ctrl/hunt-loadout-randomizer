$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$catalog = Get-Content (Join-Path $root 'data/equipment.json') -Raw -Encoding utf8 | ConvertFrom-Json
# Split reserves and combination barrels need separate pool pricing. Keep these
# on standard ammo until that accounting is audited instead of guessing a price.
$splitFamilies = @('Hand Crossbow','LeMat','Sparks','Bomb Launcher','Drilling','Haymaker','Romero 77','Springfield 1866','1890 Cavalry','Berthier 1892','Bomb Lance','Hunting Bow','Crossbow','Martini-Henry','Maynard Sniper')
$weapons = [ordered]@{}
foreach ($item in $catalog.items | Where-Object { $_.kind -eq 'weapon' -and $_.availability -eq 'standard-candidate' }) {
    if ($item.family -in $splitFamilies) { continue }
    $html = Get-Content (Join-Path $root $item.sourceSnapshot) -Raw -Encoding utf8
    $section = [regex]::Match($html, '(?s)id="Ammo_Types".*?</h2>(.*?)(?=<h2)').Groups[1].Value
    $options = @()
    foreach ($paragraph in [regex]::Matches($section, '(?s)<p>.*?</p>')) {
        $text = [Net.WebUtility]::HtmlDecode(([regex]::Replace($paragraph.Value, '<[^>]+>', '')).Trim())
        $match = [regex]::Match($text, '^(.+?)\s+-\s+(\d+)\s*$')
        if (!$match.Success -or $text -match 'Scarce|Dumdum|Explosive|Spitzer|Frag' -or ($item.family -eq 'Dolch 96' -and $text -match 'FMJ')) { continue }
        $name = $match.Groups[1].Value.Trim()
        $options += [ordered]@{id=([regex]::Replace($name.ToLower(),'[^a-z0-9]+','-')).Trim('-');name=$name;cost=[int]$match.Groups[2].Value;source=$item.sourceUrl}
    }
    if ($options.Count) { $weapons[$item.id] = @($options | Sort-Object id -Unique) }
}
$result = [ordered]@{checked='2026-09-24';rulesSource='https://www.huntshowdown.com/releasenotes/en_US/update-281781019648';scope='Priced, purchasable ammunition for verified single-pool weapons. Split-reserve and combination weapons use standard ammo. Custom ammo unlocks must be confirmed by the player.';weapons=$weapons}
[IO.File]::WriteAllText((Join-Path $root 'data/custom-ammo.json'),($result|ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))
Write-Output "Compiled custom ammo for $($weapons.Count) weapon variants."
