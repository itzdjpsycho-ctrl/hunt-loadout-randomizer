$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$folder = Join-Path $root 'assets/equipment'
New-Item $folder -ItemType Directory -Force | Out-Null
Add-Type -AssemblyName System.Drawing
$catalog = Get-Content (Join-Path $root 'data/equipment.json') -Raw -Encoding utf8 | ConvertFrom-Json
$manifest = foreach ($item in $catalog.items) {
    $html = Get-Content (Join-Path $root $item.sourceSnapshot) -Raw -Encoding utf8
    $tag = [regex]::Matches($html, '<img[^>]+>') | Where-Object { $_.Value -match 'src="/images/' } | Select-Object -First 1
    $src = [regex]::Match($tag.Value, 'src="([^"]+)"').Groups[1].Value
    $alt = [Net.WebUtility]::HtmlDecode([regex]::Match($tag.Value, 'alt="([^"]+)"').Groups[1].Value)
    if (!$src -or $alt -notmatch '^(Weapon|Tool|Consumable) ') { throw "No equipment image found for $($item.id): $alt" }
    $url = 'https://huntshowdown.wiki.gg' + [Net.WebUtility]::HtmlDecode($src)
    $relative = 'assets/equipment/' + $item.id + '.png'
    $target = Join-Path $root $relative
    if (!(Test-Path $target)) { Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $target }
    $img = [Drawing.Image]::FromFile($target)
    $width=$img.Width; $height=$img.Height; $img.Dispose()
    [ordered]@{id=$item.id; path=$relative; source=$url; page=$item.sourceUrl; originalName=$alt; width=$width; height=$height; sha256=(Get-FileHash $target -Algorithm SHA256).Hash}
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $root 'assets/equipment-manifest.json') -Encoding utf8
Write-Output "Verified $($manifest.Count) equipment images."
