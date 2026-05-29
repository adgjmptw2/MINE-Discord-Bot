# youtube-plugin JAR — PowerShell로 받아 Java(Maven) SSL 문제를 피함
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$jarDir = if ($env:LAVALINK_JAR_DIR) { $env:LAVALINK_JAR_DIR } else { Join-Path $root "lavalink" }
$pluginsDir = Join-Path $jarDir "plugins"
$version = "1.18.1"
$url = "https://github.com/lavalink-devs/youtube-source/releases/download/$version/youtube-plugin-$version.jar"
$out = Join-Path $pluginsDir "youtube-plugin-$version.jar"

New-Item -ItemType Directory -Force -Path $pluginsDir | Out-Null
Write-Host "Downloading $url"
Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
Write-Host "Saved: $out ($((Get-Item $out).Length) bytes)"
