# Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

# Prepare the Windows x64 build without requiring the optional Visual Studio ATL component.
# Only the two unmodified native dependencies are reused from the matching official release.
param([switch]$NativeOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture -ne 'X64') {
    throw 'This bootstrap is for Windows x64. Other architectures require the normal upstream native build.'
}
if (-not $NativeOnly) {
    & npm.cmd ci --ignore-scripts --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
    & npx.cmd patch-package
    if ($LASTEXITCODE -ne 0) { throw 'patch-package failed' }
    & node node_modules/electron/install.js
    if ($LASTEXITCODE -ne 0) { throw 'Electron installation failed' }
}
$archivePath = Join-Path $env:TEMP 'mattermost-stock-6.3.0-win-x64.zip'
$expectedHash = '4019d863492271b44ae8de02bc5506ea9602abadec1c9e56651bac47c054344c'
if (-not (Test-Path -LiteralPath $archivePath)) {
    & curl.exe -L --fail --silent --show-error 'https://github.com/mattermost/desktop/releases/download/v6.3.0/mattermost-desktop-6.3.0-win-x64.zip' -o $archivePath
    if ($LASTEXITCODE -ne 0) { throw 'Official release download failed' }
}
$hashStream = [IO.File]::OpenRead($archivePath)
$sha256 = [Security.Cryptography.SHA256]::Create()
try {
    $archiveHash = [BitConverter]::ToString($sha256.ComputeHash($hashStream)).Replace('-', '')
} finally {
    $hashStream.Dispose()
    $sha256.Dispose()
}
if ($archiveHash -ne $expectedHash) {
    throw 'Official release SHA256 mismatch; no binaries were installed.'
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    foreach ($relative in @('registry-js/build/Release/registry.node', 'windows-focus-assist/build/Release/focusassist.node')) {
        $entry = $archive.GetEntry("resources/app.asar.unpacked/node_modules/$relative")
        if (-not $entry) { throw "Missing official native dependency: $relative" }
        $destination = Join-Path $projectRoot "node_modules/$relative"
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
        [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destination, $true)
        Write-Output "Prepared $relative from verified Mattermost Desktop 6.3.0"
    }
} finally {
    $archive.Dispose()
}
