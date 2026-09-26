param([string]$OutputName = 'Dead-Mans-Hand.exe')
$ErrorActionPreference = 'Stop'
if ([IO.Path]::GetFileName($OutputName) -ne $OutputName -or $OutputName -notlike '*.exe') { throw 'OutputName must be an EXE filename.' }
$root = Split-Path $PSScriptRoot -Parent
$sdkVersion = '1.0.4191.47'
$vendor = Join-Path $root "desktop/vendor/webview2-$sdkVersion"
if (!(Test-Path (Join-Path $vendor 'lib/net462/Microsoft.Web.WebView2.Core.dll'))) {
    New-Item -ItemType Directory -Force -Path (Split-Path $vendor -Parent) | Out-Null
    $archive = "$vendor.zip"
    Invoke-WebRequest -UseBasicParsing -Uri "https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/$sdkVersion/microsoft.web.webview2.$sdkVersion.nupkg" -OutFile $archive
    Expand-Archive -LiteralPath $archive -DestinationPath $vendor -Force
}
& (Join-Path $PSScriptRoot 'build-app.ps1')
New-Item -ItemType Directory -Force -Path (Join-Path $root 'dist') | Out-Null
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (!(Test-Path $compiler)) { throw 'The Windows .NET Framework C# compiler is required.' }
# Code-drawn native app icon; no external image dependency.
Add-Type -AssemblyName System.Drawing
$bitmap = New-Object Drawing.Bitmap 64,64
$graphics = [Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([Drawing.Color]::FromArgb(21,22,19))
$gold = New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(194,173,122))
$font = New-Object Drawing.Font 'Georgia',42,([Drawing.FontStyle]::Regular),([Drawing.GraphicsUnit]::Pixel)
$format = New-Object Drawing.StringFormat
$format.Alignment = [Drawing.StringAlignment]::Center
$format.LineAlignment = [Drawing.StringAlignment]::Center
$graphics.DrawString([string][char]0x2660,$font,$gold,(New-Object Drawing.RectangleF 0,0,64,64),$format)
$icon = [Drawing.Icon]::FromHandle($bitmap.GetHicon())
$iconPath = Join-Path $root 'desktop/app.ico'
$stream = [IO.File]::Create($iconPath)
$icon.Save($stream)
$stream.Dispose(); $graphics.Dispose(); $bitmap.Dispose(); $font.Dispose(); $gold.Dispose(); $format.Dispose()
$exe = Join-Path (Join-Path $root 'dist') $OutputName
$argsList = @('/nologo','/target:winexe','/platform:x64','/optimize+',('/out:'+$exe),('/win32manifest:'+(Join-Path $root 'desktop/app.manifest')),('/win32icon:'+$iconPath),'/reference:System.dll','/reference:System.Core.dll','/reference:System.Drawing.dll','/reference:System.Windows.Forms.dll')
foreach ($name in @('Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.WinForms.dll')) {
    $file = Join-Path $vendor "lib/net462/$name"
    $argsList += '/reference:'+$file
    $argsList += '/resource:'+$file+','+$name
}
$resources = @{
    'Chaos-Loadout.html' = (Join-Path $root 'Chaos-Loadout.html')
    'WebView2Loader.dll' = (Join-Path $vendor 'runtimes/win-x64/native/WebView2Loader.dll')
    'WebView2-LICENSE.txt' = (Join-Path $vendor 'LICENSE.txt')
    'WebView2-NOTICE.txt' = (Join-Path $vendor 'NOTICE.txt')
    'engine-tests.js' = (Join-Path $root 'tests/engine-tests.js')
    'desktop-smoke.js' = (Join-Path $root 'desktop/desktop-smoke.js')
}
foreach ($name in $resources.Keys) { $argsList += '/resource:'+$resources[$name]+','+$name }
$argsList += Join-Path $root 'desktop/Program.cs'
& $compiler @argsList
if ($LASTEXITCODE -ne 0) { throw "EXE compiler failed with exit code $LASTEXITCODE" }
Copy-Item -LiteralPath (Join-Path $vendor 'LICENSE.txt') -Destination (Join-Path $root 'dist/WebView2-LICENSE.txt') -Force
Copy-Item -LiteralPath (Join-Path $vendor 'NOTICE.txt') -Destination (Join-Path $root 'dist/WebView2-NOTICE.txt') -Force
Get-FileHash -LiteralPath $exe -Algorithm SHA256 | ForEach-Object { "$($_.Hash)  $OutputName" } | Set-Content -Encoding ascii (Join-Path $root ('dist/'+[IO.Path]::GetFileNameWithoutExtension($OutputName)+'.sha256.txt'))
Get-Item -LiteralPath $exe | Select-Object FullName,Length
