$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$catalog = Get-Content (Join-Path $root 'data/equipment.json') -Raw -Encoding utf8 | ConvertFrom-Json
$weapons = [ordered]@{}
$slots = [ordered]@{}
foreach ($item in $catalog.items | Where-Object { $_.kind -eq 'weapon' -and $_.availability -eq 'standard-candidate' }) {
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
    if ($options.Count) {
        $weapons[$item.id] = @($options | ForEach-Object { [pscustomobject]$_ } | Sort-Object id -Unique)
        if ($item.family -in @('LeMat','Drilling','Haymaker')) {
            $shells = @('dragon-breath','slug','starshell','flechette','penny-shot-ammo')
            $slots[$item.id] = @(
                [ordered]@{name='Bullets'; options=@($options | Where-Object { $_.id -notin $shells } | ForEach-Object { $_.id })},
                [ordered]@{name='Shells'; options=@($options | Where-Object { $_.id -in $shells } | ForEach-Object { $_.id })}
            )
        } elseif ($html -match 'per slot') {
            # The current Ammo Types section already quotes the per-slot price.
            $ids = @($options | ForEach-Object { $_.id })
            $slots[$item.id] = @([ordered]@{name='Ammo 1';options=$ids},[ordered]@{name='Ammo 2';options=$ids})
        } else {
            $slots[$item.id] = @([ordered]@{name='Ammo';options=@($options | ForEach-Object { $_.id })})
        }
    }
}
$result = [ordered]@{checked='2026-09-24';rulesSource='https://www.huntshowdown.com/releasenotes/en_US/update-281781019648';scope='Priced, purchasable ammunition from cached weapon pages, including separate split-reserve and combination-barrel slots. Prices are per slot as listed. Custom ammo unlocks must be confirmed by the player.';weapons=$weapons;slots=$slots}
[IO.File]::WriteAllText((Join-Path $root 'data/custom-ammo.json'),($result|ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))
Write-Output "Compiled custom ammo for $($weapons.Count) weapon variants."
