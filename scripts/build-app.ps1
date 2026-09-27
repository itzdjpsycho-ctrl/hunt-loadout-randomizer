$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
if (!(Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 24 or newer is required. Install Node.js, then reopen your terminal.' }
& node (Join-Path $root 'scripts/build-web.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Node frontend build failed.' }
