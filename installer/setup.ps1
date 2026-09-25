# Lumo - graphical installer (Windows 10 / 11, Windows PowerShell 5.1, no extra tools).
# Packed by make_package.py with IExpress into Lumo-Setup.exe together with app.zip and lumo.ico.
# Steps: welcome -> folder and shortcuts -> install (files, Python, packages, shortcuts, Apps & features) -> finish.
param([switch]$Quiet, [string]$Dir = "")

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$ErrorActionPreference = "Stop"
$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$zip = Join-Path $here "app.zip"
$ico = Join-Path $here "lumo.ico"
$version = "4.8"

# ------------------------------------------------------------------ texts (Polish / Italian by Windows language)
$it = (Get-Culture).TwoLetterISOLanguageName -eq "it"
$T = if ($it) { @{
    title = "Installazione di Lumo"; welcome = "Benvenuto!"; intro = "Lumo controlla le luci DMX con la mano, la musica e un mixer semplice.`r`n`r`nL'installazione richiede qualche minuto e internet (pacchetti Python)."
    next = "Avanti"; back = "Indietro"; cancel = "Annulla"; install = "Installa"; finish = "Fine"; browse = "Sfoglia..."
    where = "Dove installare Lumo?"; desk = "Collegamento sul desktop"; menu = "Collegamento nel menu Start"; runafter = "Avvia Lumo alla fine"
    working = "Installazione in corso..."; s1 = "Copio i file"; s2 = "Cerco Python 3.10+"; s3 = "Preparo l'ambiente"; s4 = "Installo i pacchetti (qualche minuto)"
    s5 = "Creo i collegamenti"; s6 = "Registro il programma"; done = "Fatto! Lumo e' installato."; doneS = "Trovi Lumo sul desktop e nel menu Start."
    nopy = "Python 3.10 o piu' recente non e' installato. Installarlo adesso (winget, circa 30 MB)?"; nopy2 = "Installa Python da python.org (spunta 'Add python.exe to PATH') e riavvia l'installazione."
    fail = "Installazione non riuscita"; keep = "Le tue impostazioni (luci, spettacoli) restano." } } else { @{
    title = "Instalacja Lumo"; welcome = "Witaj!"; intro = "Lumo steruje swiatlami DMX dlonia, muzyka i prostym mikserem.`r`n`r`nInstalacja potrwa kilka minut i potrzebuje internetu (pakiety Pythona)."
    next = "Dalej"; back = "Wstecz"; cancel = "Anuluj"; install = "Instaluj"; finish = "Zakoncz"; browse = "Przegladaj..."
    where = "Gdzie zainstalowac Lumo?"; desk = "Skrot na pulpicie"; menu = "Skrot w menu Start"; runafter = "Uruchom Lumo na koniec"
    working = "Instaluje..."; s1 = "Kopiuje pliki"; s2 = "Szukam Pythona 3.10+"; s3 = "Przygotowuje srodowisko"; s4 = "Instaluje pakiety (kilka minut)"
    s5 = "Tworze skroty"; s6 = "Rejestruje program"; done = "Gotowe! Lumo jest zainstalowane."; doneS = "Lumo znajdziesz na pulpicie i w menu Start."
    nopy = "Nie ma Pythona 3.10 lub nowszego. Zainstalowac go teraz (winget, ok. 30 MB)?"; nopy2 = "Zainstaluj Pythona ze strony python.org (zaznacz 'Add python.exe to PATH') i uruchom instalator jeszcze raz."
    fail = "Instalacja nie powiodla sie"; keep = "Twoje ustawienia (lampy, pokazy) zostaja." } }
# Polish letters in the UI (the file stays ASCII so every Windows code page reads it)
if (-not $it) {
    $fix = @{ "swiatlami" = "światłami"; "dlonia" = "dłonią"; "muzyka" = "muzyką"; "potrwa" = "potrwa"; "zainstalowac" = "zainstalować"; "Skrot" = "Skrót"
        "Przegladaj" = "Przeglądaj"; "Zakoncz" = "Zakończ"; "Instaluje..." = "Instaluję..."; "Kopiuje" = "Kopiuję"; "Szukam Pythona" = "Szukam Pythona"
        "Przygotowuje srodowisko" = "Przygotowuję środowisko"; "Instaluje pakiety" = "Instaluję pakiety"; "Tworze skroty" = "Tworzę skróty"; "Rejestruje" = "Rejestruję"
        "skroty" = "skróty"; "Gotowe!" = "Gotowe!"; "sa zainstalowane" = "są zainstalowane"; "powiodla sie" = "powiodła się"; "zostaja" = "zostają" }
    foreach ($k in @($T.Keys)) { foreach ($f in $fix.Keys) { $T[$k] = $T[$k].Replace($f, $fix[$f]) } }
}

$default = if ($Dir) { $Dir } else { Join-Path $env:LOCALAPPDATA "Programs\Lumo" }

# ------------------------------------------------------------------ window
$violet = [System.Drawing.Color]::FromArgb(123, 63, 242)
$form = New-Object System.Windows.Forms.Form
$form.Text = $T.title; $form.Size = New-Object System.Drawing.Size(640, 440); $form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"; $form.MaximizeBox = $false; $form.BackColor = [System.Drawing.Color]::White
$form.Font = New-Object System.Drawing.Font("Segoe UI", 10)
if (Test-Path $ico) { $form.Icon = New-Object System.Drawing.Icon($ico) }

$side = New-Object System.Windows.Forms.Panel
$side.Dock = "Left"; $side.Width = 190
$side.Add_Paint({
    param($s, $e)
    $r = $s.ClientRectangle
    $br = New-Object System.Drawing.Drawing2D.LinearGradientBrush($r, [System.Drawing.Color]::FromArgb(123, 63, 242), [System.Drawing.Color]::FromArgb(31, 182, 201), 60)
    $e.Graphics.FillRectangle($br, $r)
    if (Test-Path $ico) {
        $big = New-Object System.Drawing.Icon($ico, 96, 96)
        $e.Graphics.DrawIcon($big, 47, 60)
    }
    $f = New-Object System.Drawing.Font("Segoe UI", 22, [System.Drawing.FontStyle]::Bold)
    $e.Graphics.DrawString("Lumo", $f, [System.Drawing.Brushes]::White, 52, 170)
    $f2 = New-Object System.Drawing.Font("Segoe UI", 9)
    $e.Graphics.DrawString("v$version", $f2, [System.Drawing.Brushes]::White, 80, 212)
})
$form.Controls.Add($side)

$body = New-Object System.Windows.Forms.Panel
$body.Location = New-Object System.Drawing.Point(210, 20); $body.Size = New-Object System.Drawing.Size(400, 320)
$form.Controls.Add($body)

function Lbl($text, $y, $size = 10, $bold = $false, $h = 30) {
    $l = New-Object System.Windows.Forms.Label
    $l.Text = $text; $l.Location = New-Object System.Drawing.Point(0, $y); $l.Size = New-Object System.Drawing.Size(395, $h)
    $style = if ($bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
    $l.Font = New-Object System.Drawing.Font("Segoe UI", $size, $style)
    return $l
}
function Btn($text, $x, $primary = $false) {
    $b = New-Object System.Windows.Forms.Button
    $b.Text = $text; $b.Size = New-Object System.Drawing.Size(110, 34); $b.Location = New-Object System.Drawing.Point($x, 352)
    $b.FlatStyle = "Flat"
    if ($primary) { $b.BackColor = $violet; $b.ForeColor = [System.Drawing.Color]::White; $b.FlatAppearance.BorderSize = 0 }
    $form.Controls.Add($b); return $b
}
$bBack = Btn $T.back 250; $bNext = Btn $T.next 380 $true; $bCancel = Btn $T.cancel 510
$bCancel.Add_Click({ $form.Close() })

# pages
$p1 = New-Object System.Windows.Forms.Panel; $p1.Dock = "Fill"
$p1.Controls.Add((Lbl $T.welcome 10 20 $true 44)); $p1.Controls.Add((Lbl $T.intro 64 10 $false 200))
$p2 = New-Object System.Windows.Forms.Panel; $p2.Dock = "Fill"
$p2.Controls.Add((Lbl $T.where 10 13 $true 34))
$tb = New-Object System.Windows.Forms.TextBox; $tb.Location = New-Object System.Drawing.Point(0, 56); $tb.Size = New-Object System.Drawing.Size(280, 28); $tb.Text = $default
$p2.Controls.Add($tb)
$bb = New-Object System.Windows.Forms.Button; $bb.Text = $T.browse; $bb.Location = New-Object System.Drawing.Point(290, 54); $bb.Size = New-Object System.Drawing.Size(105, 30)
$bb.Add_Click({ $d = New-Object System.Windows.Forms.FolderBrowserDialog; if ($d.ShowDialog() -eq "OK") { $tb.Text = Join-Path $d.SelectedPath "Lumo" } })
$p2.Controls.Add($bb)
function Chk($text, $y) { $c = New-Object System.Windows.Forms.CheckBox; $c.Text = $text; $c.Checked = $true; $c.Location = New-Object System.Drawing.Point(0, $y); $c.Size = New-Object System.Drawing.Size(390, 28); return $c }
$cDesk = Chk $T.desk 110; $cMenu = Chk $T.menu 142; $cRun = Chk $T.runafter 174
$p2.Controls.AddRange(@($cDesk, $cMenu, $cRun))
$p2.Controls.Add((Lbl $T.keep 220 9 $false 40))
$p3 = New-Object System.Windows.Forms.Panel; $p3.Dock = "Fill"
$p3.Controls.Add((Lbl $T.working 10 13 $true 34))
$stat = Lbl "" 50 10 $false 26; $p3.Controls.Add($stat)
$bar = New-Object System.Windows.Forms.ProgressBar; $bar.Location = New-Object System.Drawing.Point(0, 80); $bar.Size = New-Object System.Drawing.Size(395, 18); $bar.Maximum = 100
$p3.Controls.Add($bar)
$log = New-Object System.Windows.Forms.TextBox; $log.Multiline = $true; $log.ScrollBars = "Vertical"; $log.ReadOnly = $true
$log.Location = New-Object System.Drawing.Point(0, 108); $log.Size = New-Object System.Drawing.Size(395, 205); $log.Font = New-Object System.Drawing.Font("Consolas", 8.5)
$log.BackColor = [System.Drawing.Color]::FromArgb(247, 247, 250)
$p3.Controls.Add($log)
$p4 = New-Object System.Windows.Forms.Panel; $p4.Dock = "Fill"
$p4.Controls.Add((Lbl $T.done 10 17 $true 44)); $p4.Controls.Add((Lbl $T.doneS 64 10 $false 60))
$pages = @($p1, $p2, $p3, $p4)
foreach ($p in $pages) { $p.Visible = $false; $body.Controls.Add($p) }
$script:page = 0
function Show-Page($i) {
    $script:page = $i
    for ($k = 0; $k -lt $pages.Count; $k++) { $pages[$k].Visible = ($k -eq $i) }
    $bBack.Visible = ($i -eq 1); $bCancel.Visible = ($i -lt 2); $bNext.Enabled = ($i -ne 2)
    $bNext.Text = @($T.next, $T.install, $T.next, $T.finish)[$i]
}

function Say($text) { $log.AppendText($text + "`r`n"); [System.Windows.Forms.Application]::DoEvents() }
function Step($text, $pct) { $stat.Text = $text; $bar.Value = [Math]::Min(100, $pct); Say ("== " + $text); }

# run a console program, stream its output into the log without freezing the window
function Run($exe, $argList, $cwd) {
    $out = [System.IO.Path]::GetTempFileName()
    $p = Start-Process -FilePath $exe -ArgumentList $argList -WorkingDirectory $cwd -NoNewWindow -PassThru `
        -RedirectStandardOutput $out -RedirectStandardError "$out.err"
    $seen = 0
    while (-not $p.HasExited) {
        Start-Sleep -Milliseconds 200
        try { $lines = Get-Content $out -ErrorAction SilentlyContinue } catch { $lines = @() }
        if ($lines -and $lines.Count -gt $seen) { foreach ($l in $lines[$seen..($lines.Count - 1)]) { Say $l }; $seen = $lines.Count }
        [System.Windows.Forms.Application]::DoEvents()
    }
    $p.WaitForExit()
    try { $lines = Get-Content $out -ErrorAction SilentlyContinue; if ($lines -and $lines.Count -gt $seen) { foreach ($l in $lines[$seen..($lines.Count - 1)]) { Say $l } } } catch {}
    try { $err = Get-Content "$out.err" -ErrorAction SilentlyContinue; if ($p.ExitCode -ne 0 -and $err) { foreach ($l in $err | Select-Object -Last 15) { Say $l } } } catch {}
    Remove-Item $out, "$out.err" -ErrorAction SilentlyContinue
    return $p.ExitCode
}

function Find-Python {
    foreach ($c in @(@("py", "-3.13"), @("py", "-3.12"), @("py", "-3.11"), @("py", "-3.10"), @("py", "-3"), @("python"))) {
        try {
            $exe = $c[0]; $a = @(); if ($c.Count -gt 1) { $a += $c[1] }
            $a += @("-c", "import sys; print(sys.executable) if sys.version_info[:2] >= (3, 10) else sys.exit(1)")
            $r = & $exe @a 2>$null
            if ($LASTEXITCODE -eq 0 -and $r) { return ($r | Select-Object -Last 1).Trim() }
        } catch {}
    }
    foreach ($p in @("$env:LOCALAPPDATA\Programs\Python\Python313\python.exe", "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe")) { if (Test-Path $p) { return $p } }
    return $null
}

function Install-All {
    $dir = $tb.Text.Trim()
    try {
        # 1. files (settings of an earlier install stay)
        Step $T.s1 5
        $tmp = Join-Path $env:TEMP ("lumo-setup-" + [guid]::NewGuid().ToString("N"))
        Expand-Archive -Path $zip -DestinationPath $tmp -Force
        $src = Get-ChildItem $tmp | Where-Object { $_.PSIsContainer } | Select-Object -First 1
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        $keep = @("config.json", "presets.json", "my_fixtures.json")
        Get-ChildItem $src.FullName -Force | ForEach-Object {
            $dst = Join-Path $dir $_.Name
            if ($keep -contains $_.Name -and (Test-Path $dst)) { return }
            Copy-Item $_.FullName -Destination $dir -Recurse -Force
        }
        Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
        Say $dir
        # 2. python
        Step $T.s2 15
        $py = Find-Python
        if (-not $py) {
            $ans = [System.Windows.Forms.MessageBox]::Show($T.nopy, $T.title, "YesNo", "Question")
            if ($ans -eq "Yes" -and (Get-Command winget -ErrorAction SilentlyContinue)) {
                Run "winget" @("install", "-e", "--id", "Python.Python.3.12", "--scope", "user", "--accept-package-agreements", "--accept-source-agreements") $dir | Out-Null
                $py = Find-Python
            }
            if (-not $py) { throw $T.nopy2 }
        }
        Say $py
        # 3. virtual environment
        Step $T.s3 25
        $venvPy = Join-Path $dir ".venv\Scripts\python.exe"
        if (-not (Test-Path $venvPy)) {
            if ((Run $py @("-m", "venv", ".venv") $dir) -ne 0) { throw "venv" }
        }
        # 4. packages (offline wheels when the package has them)
        Step $T.s4 35
        $wheels = Join-Path $dir "wheels"
        Run $venvPy @("-m", "pip", "install", "--upgrade", "pip", "--disable-pip-version-check") $dir | Out-Null
        $bar.Value = 45
        if (Test-Path (Join-Path $wheels "*.whl")) { $code = Run $venvPy @("-m", "pip", "install", "--no-index", "--find-links", "wheels", "-r", "requirements.txt") $dir }
        else { $code = Run $venvPy @("-m", "pip", "install", "-r", "requirements.txt", "--disable-pip-version-check") $dir }
        if ($code -ne 0) { throw "pip install" }
        # 5. shortcuts
        Step $T.s5 88
        $sh = New-Object -ComObject WScript.Shell
        $targets = @()
        if ($cDesk.Checked) { $targets += [Environment]::GetFolderPath("Desktop") }
        if ($cMenu.Checked) { $targets += [Environment]::GetFolderPath("Programs") }
        foreach ($d in $targets) {
            $s = $sh.CreateShortcut((Join-Path $d "Lumo.lnk"))
            $s.TargetPath = Join-Path $dir "run.bat"; $s.WorkingDirectory = $dir; $s.WindowStyle = 7
            $s.IconLocation = (Join-Path $dir "lumo.ico") + ",0"; $s.Description = "Lumo"
            $s.Save()
        }
        # 6. Apps & features entry (uninstall from Windows settings)
        Step $T.s6 95
        $key = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Lumo"
        New-Item -Path $key -Force | Out-Null
        $size = [int]((Get-ChildItem $dir -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum / 1024)
        $vals = @{ DisplayName = "Lumo"; DisplayVersion = $version; Publisher = "Lumo"; InstallLocation = $dir
            DisplayIcon = (Join-Path $dir "lumo.ico"); UninstallString = "cmd.exe /c `"`"$dir\odinstaluj.bat`"`""; NoModify = 1; NoRepair = 1; EstimatedSize = $size }
        foreach ($k in $vals.Keys) {
            $type = if ($vals[$k] -is [int]) { "DWord" } else { "String" }
            New-ItemProperty -Path $key -Name $k -Value $vals[$k] -PropertyType $type -Force | Out-Null
        }
        $bar.Value = 100
        $script:installed = $dir
        Show-Page 3
    } catch {
        Say ("!! " + $_.Exception.Message)
        [System.Windows.Forms.MessageBox]::Show($T.fail + ":`r`n" + $_.Exception.Message, $T.title, "OK", "Error") | Out-Null
        $bNext.Enabled = $true; $bNext.Text = $T.finish; $script:page = 3; $script:failed = $true
    }
}

$bBack.Add_Click({ Show-Page 0 })
$bNext.Add_Click({
    switch ($script:page) {
        0 { Show-Page 1 }
        1 { Show-Page 2; Install-All }
        default {
            if (-not $script:failed -and $cRun.Checked -and $script:installed) { Start-Process -FilePath (Join-Path $script:installed "run.bat") -WorkingDirectory $script:installed -WindowStyle Minimized }
            $form.Close()
        }
    }
})
Show-Page 0
[void]$form.ShowDialog()
