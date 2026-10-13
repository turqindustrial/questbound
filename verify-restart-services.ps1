# Synthetic identities only. This check never starts or stops a service.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'restart-service-rules.ps1')
$testRoot = 'C:\Test Space\Questbound'
$testNode = 'C:\Program Files\nodejs\node.exe'
$testStarted = [datetime]'2026-10-08T00:00:00Z'
$testSession = [pscustomobject]@{pid=1234; link='https://game.example/'; phone='http://10.0.0.5:8085/'}
function Assert-Owner {
    param([string]$Label,[bool]$Expected,[string]$Command,[hashtable]$Changes=@{})
    $testProcess = [pscustomobject]@{Name='node.exe'; ExecutablePath=$testNode; ProcessId=1234; ParentProcessId=9876; CreationDate=$testStarted; CommandLine=$Command}
    $testOptions = @{Process=$testProcess; Root=$testRoot; NodePath=$testNode; Role='share'; Script='phone-server.cjs'; LauncherPid=9999; Session=$testSession; SessionWrittenAt=$testStarted.AddSeconds(1)}
    foreach($testChange in $Changes.GetEnumerator()) {
        if ($testChange.Key -in @('Name','ExecutablePath','ProcessId','ParentProcessId','CreationDate')) { $testProcess.($testChange.Key) = $testChange.Value }
        else { $testOptions[$testChange.Key] = $testChange.Value }
    }
    $testActual = Test-QuestboundServiceOwner @testOptions
    if ($testActual -ne $Expected) { throw "$Label failed: expected $Expected; got $testActual" }
    Write-Output "PASS $Label"
}
$testRelative = '"C:\Program Files\nodejs\node.exe" phone-server.cjs --public "https://game.example/"'
Assert-Owner 'manual sharing server with matching session' $true $testRelative
Assert-Owner 'optional URL trailing slash' $true 'node phone-server.cjs --public https://game.example'
Assert-Owner 'explicit relative script' $true 'node .\phone-server.cjs --public https://game.example/'
Assert-Owner 'absolute script' $true 'node "C:\Test Space\Questbound\phone-server.cjs" --public https://game.example/' @{SessionWrittenAt=$testStarted.AddDays(-2)}
Assert-Owner 'forward slash absolute script' $true 'node "C:/Test Space/Questbound/phone-server.cjs" --public https://game.example/'
Assert-Owner 'launcher parent' $true $testRelative @{ParentProcessId=9999;SessionWrittenAt=$testStarted.AddDays(-2)}
Assert-Owner 'stale session PID' $false $testRelative @{ProcessId=4321}
Assert-Owner 'reused PID' $false $testRelative @{CreationDate=$testStarted.AddHours(1)}
Assert-Owner 'old session timestamp' $false $testRelative @{SessionWrittenAt=$testStarted.AddDays(-1)}
Assert-Owner 'wrong node executable' $false $testRelative @{ExecutablePath='C:\Other\node.exe'}
Assert-Owner 'different program' $false $testRelative @{Name='other.exe'}
Assert-Owner 'wrong sharing origin' $false 'node phone-server.cjs --public https://other.example/'
Assert-Owner 'origin prefix trick' $false 'node phone-server.cjs --public https://game.example.attacker.test/'
Assert-Owner 'URL credentials rejected' $false 'node phone-server.cjs --public https://user@game.example/'
Assert-Owner 'URL paths rejected' $false 'node phone-server.cjs --public https://game.example/other'
Assert-Owner 'wrong workspace' $false 'node "C:\Other\phone-server.cjs" --public https://game.example/'
Assert-Owner 'relative parent path rejected' $false 'node ..\phone-server.cjs --public https://game.example/'
Assert-Owner 'script path supplied as data' $false 'node other.cjs "C:\Test Space\Questbound\phone-server.cjs" --public https://game.example/'
Assert-Owner 'unexpected node options' $false 'node --eval code phone-server.cjs --public https://game.example/'
Assert-Owner 'extra arguments' $false ($testRelative+' extra')
Assert-Owner 'broken quotes' $false 'node "phone-server.cjs --public https://game.example/'
Assert-Owner 'manual phone' $true 'node phone-server.cjs' @{Role='phone'}
Assert-Owner 'private table from launcher' $true 'node sync-server.cjs' @{Role='table';Script='sync-server.cjs';ParentProcessId=9999;Session=$null}
Assert-Owner 'unknown private table rejected' $false 'node sync-server.cjs' @{Role='table';Script='sync-server.cjs';Session=$null}
Write-Output 'Restart identity checks passed. No live processes were changed.'
