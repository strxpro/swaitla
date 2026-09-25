# Creates "Lumo" shortcuts on the desktop and in the Start menu.
# Used by instaluj.bat;  -Remove deletes them (odinstaluj.bat).
param(
    [string]$Target = "",
    [string]$Icon = "",
    [switch]$Remove
)
$ErrorActionPreference = "Stop"
$name = "Lumo.lnk"
$old = "PHOTON HAND.lnk"                  # name used before version 4
$dirs = @([Environment]::GetFolderPath("Desktop"), (Join-Path ([Environment]::GetFolderPath("Programs")) ""))
if ($env:PH_SHORTCUT_DIR) { $dirs = @($env:PH_SHORTCUT_DIR) }   # tests
foreach ($d in $dirs) {
    $lnk = Join-Path $d $name
    $oldLnk = Join-Path $d $old
    if (Test-Path $oldLnk) { Remove-Item $oldLnk -Force }
    if ($Remove) {
        if (Test-Path $lnk) { Remove-Item $lnk -Force }
        continue
    }
    $sh = New-Object -ComObject WScript.Shell
    $s = $sh.CreateShortcut($lnk)
    $s.TargetPath = $Target
    $s.WorkingDirectory = Split-Path $Target
    if ($Icon -and (Test-Path $Icon)) { $s.IconLocation = "$Icon,0" }
    $s.Description = "Lumo - swiatlo sterowane dlonia"
    $s.WindowStyle = 7
    $s.Save()
    Write-Host "        $lnk"
}
