# Updates the stable local launch directory; keeps the previous app as a backup.
param([Parameter(Mandatory = $true)][string]$SourceDirectory, [switch]$Inspect)
$ErrorActionPreference = 'Stop'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$releaseRoot = [IO.Path]::GetFullPath((Join-Path $workspace 'release'))
$source = (Resolve-Path -LiteralPath $SourceDirectory).Path
$target = Join-Path $releaseRoot 'win-unpacked'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stage = Join-Path $releaseRoot "update-stage-$stamp"
$backup = Join-Path $releaseRoot "backups/win-unpacked-$stamp"
$exeName = 'Mattermost Fluent.exe'
foreach ($candidate in @($source, $target, $stage, $backup)) {
    $absolute = [IO.Path]::GetFullPath($candidate)
    if (!$absolute.StartsWith($releaseRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw "Update path must be inside the workspace release directory: $absolute"
    }
}
if ($source -eq $target) { throw 'Source must be a separate completed build.' }
foreach ($file in @($exeName, 'resources/app.asar')) {
    if (!(Test-Path -LiteralPath (Join-Path $source $file))) { throw "Missing source file: $file" }
}
# Stage and verify before stopping the user's app.
Copy-Item -LiteralPath $source -Destination $stage -Recurse
foreach ($file in @($exeName, 'resources/app.asar')) {
    $expected = (Get-FileHash -LiteralPath (Join-Path $source $file) -Algorithm SHA256).Hash
    $actual = (Get-FileHash -LiteralPath (Join-Path $stage $file) -Algorithm SHA256).Hash
    if ($expected -ne $actual) { throw "Staged file does not match: $file" }
}
$targetExe = Join-Path $target $exeName
$running = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $targetExe })
foreach ($item in $running) {
    $process = Get-Process -Id $item.ProcessId -ErrorAction SilentlyContinue
    if ($process -and $process.MainWindowHandle -ne 0) { $null = $process.CloseMainWindow() }
}
if ($running.Count) { Start-Sleep -Seconds 2 }
# Closing can leave Electron in the tray. Stop only this installation's processes.
Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $targetExe } | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 700
New-Item -ItemType Directory -Force -Path (Split-Path $backup) | Out-Null
if (Test-Path -LiteralPath $target) { Move-Item -LiteralPath $target -Destination $backup }
try {
    Move-Item -LiteralPath $stage -Destination $target
} catch {
    if (!(Test-Path -LiteralPath $target) -and (Test-Path -LiteralPath $backup)) {
        Move-Item -LiteralPath $backup -Destination $target
    }
    throw
}
if ($Inspect) {
    $started = Start-Process -FilePath $targetExe -ArgumentList '--remote-debugging-port=0' -WorkingDirectory $target -PassThru
} else {
    $started = Start-Process -FilePath $targetExe -WorkingDirectory $target -PassThru
}
Start-Sleep -Seconds 3
if ($started.HasExited) { throw "Updated app exited with code $($started.ExitCode)" }
[PSCustomObject]@{Executable = $targetExe; ProcessId = $started.Id; Backup = $backup}
