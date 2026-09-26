$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
& (Join-Path $PSScriptRoot 'build-app.ps1')
$site = Join-Path $root 'site'
New-Item -ItemType Directory -Force -Path $site | Out-Null
Copy-Item -LiteralPath (Join-Path $root 'Chaos-Loadout.html') -Destination (Join-Path $site 'index.html') -Force
[IO.File]::WriteAllText((Join-Path $site '.nojekyll'), '')
Write-Output "Website built in $site. Publish this directory as the site root."
