# Apply server updates without stopping the Dungeon Master or changing the tunnel.
# CheckOnly validates the running process identities without changing anything.
param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$questRoot = $PSScriptRoot
. (Join-Path $questRoot 'restart-service-rules.ps1')
$questNode = (Get-Command node -ErrorAction Stop).Source
$questPidFile = Join-Path $questRoot '.questbound-logs\pids.json'
$questPids = Get-Content -LiteralPath $questPidFile -Raw | ConvertFrom-Json
$questPlan = @()
$questTargets = @(
    @{Name='table'; Port=8086; Script='sync-server.cjs'},
    @{Name='desktop'; Port=8081; Script='desktop-server.cjs'},
    @{Name='share'; Port=8087; Script='phone-server.cjs'},
    @{Name='phone'; Port=8085; Script='phone-server.cjs'}
)
# Validate every target before stopping any service. A reused PID is not enough.
$questListeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop)
foreach ($questTarget in $questTargets) {
    $questListener = @($questListeners | Where-Object LocalPort -eq $questTarget.Port)
    if (-not $questListener.Count) { continue }
    $questIds = @($questListener.OwningProcess | Select-Object -Unique)
    if ($questIds.Count -ne 1) { throw "More than one listener on $($questTarget.Port); nothing was stopped." }
    $questProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($questIds[0])"
    $questScript = Join-Path $questRoot $questTarget.Script
    $questSession = $null
    $questSessionWritten = [datetime]::MinValue
    if ($questTarget.Name -in @('share','phone')) {
        $questSessionFile = Join-Path $questRoot ('.questbound-' + $questTarget.Name + '-session.json')
        if (Test-Path -LiteralPath $questSessionFile) {
            $questSession = Get-Content -LiteralPath $questSessionFile -Raw | ConvertFrom-Json
            $questSessionWritten = (Get-Item -LiteralPath $questSessionFile).LastWriteTimeUtc
        }
    }
    if (-not (Test-QuestboundServiceOwner -Process $questProcess -Root $questRoot -NodePath $questNode -Role $questTarget.Name -Script $questTarget.Script -LauncherPid $questPids.($questTarget.Name) -Session $questSession -SessionWrittenAt $questSessionWritten)) {
        throw "Cannot verify $($questTarget.Name) belongs to this Questbound folder. Nothing was stopped."
    }
    $questArguments = @(('"' + $questScript + '"'))
    if ($questTarget.Name -eq 'share') {
        $questArguments += @('--public', ('"' + $questSession.link + '"'))
    }
    $questPlan += @{Name=$questTarget.Name; Port=$questTarget.Port; Id=$questProcess.ProcessId; Created=$questProcess.CreationDate; Arguments=$questArguments}
}
if ($CheckOnly) { $questPlan | ForEach-Object { Write-Output "Verified $($_.Name) on port $($_.Port)." }; return }
foreach ($questTask in $questPlan) {
    $questCurrent = Get-CimInstance Win32_Process -Filter "ProcessId = $($questTask.Id)"
    if ($questCurrent.CreationDate -ne $questTask.Created) { throw 'A service changed while preparing the update. Restart cancelled.' }
    Stop-Process -Id $questTask.Id -ErrorAction Stop
    if ($questTask.Name -eq 'phone') { Write-Output 'Stopped the retired HTTP phone gateway. Use the HTTPS link.'; continue }
    $questStarted = Start-Process -FilePath $questNode -ArgumentList $questTask.Arguments -WorkingDirectory $questRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $questRoot ".questbound-logs\$($questTask.Name)-security.log") -RedirectStandardError (Join-Path $questRoot ".questbound-logs\$($questTask.Name)-security.err.log") -PassThru
    $questPids | Add-Member -NotePropertyName $questTask.Name -NotePropertyValue $questStarted.Id -Force
    $questPids | ConvertTo-Json | Set-Content -LiteralPath $questPidFile -Encoding ASCII
    $questReady = $false
    for ($questTry = 0; $questTry -lt 20; $questTry++) {
        Start-Sleep -Milliseconds 500
        $questListening = @(Get-NetTCPConnection -State Listen -LocalPort $questTask.Port -ErrorAction SilentlyContinue | Where-Object OwningProcess -eq $questStarted.Id)
        if ($questListening.Count) { $questReady = $true; break }
        if ($questStarted.HasExited) { break }
    }
    if (-not $questReady) { throw "$($questTask.Name) did not restart. Check .questbound-logs\$($questTask.Name)-security.err.log." }
    Write-Output "Updated $($questTask.Name)."
}
if ($questPlan.Count) { Write-Output 'Server updates applied. Refresh Questbound. Your Dungeon Master and tunnel were left running.' }
else { Write-Output 'No game services were running. Start Questbound normally to use the updates.' }
