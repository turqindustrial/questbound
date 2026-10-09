# Read-only identity checks for the server restarter. No processes are changed here.
function Get-QuestboundCommandArguments {
    param([string]$CommandLine)
    $questTokens = @()
    $questEnd = 0
    foreach ($questMatch in [regex]::Matches($CommandLine, '"([^"\r\n]*)"|([^\s"]+)')) {
        $questGap = $CommandLine.Substring($questEnd, $questMatch.Index - $questEnd)
        if ($questGap -match '\S' -or ($questEnd -gt 0 -and $questGap.Length -eq 0)) { return @() }
        $questTokens += $(if ($questMatch.Groups[1].Success) { $questMatch.Groups[1].Value } else { $questMatch.Groups[2].Value })
        $questEnd = $questMatch.Index + $questMatch.Length
    }
    if ($CommandLine.Substring($questEnd) -match '\S') { return @() }
    return $questTokens
}

function Get-QuestboundHttpsOrigin {
    param([string]$Link)
    $questParsed = $null
    if (-not [uri]::TryCreate($Link, [UriKind]::Absolute, [ref]$questParsed)) { return $null }
    if ($questParsed.Scheme -ne 'https' -or $questParsed.AbsolutePath -ne '/' -or $questParsed.Query -or $questParsed.Fragment -or $questParsed.UserInfo) { return $null }
    return $questParsed.GetLeftPart([System.UriPartial]::Authority)
}

function Test-QuestboundServiceOwner {
    param($Process, [string]$Root, [string]$NodePath, [string]$Role, [string]$Script, $LauncherPid, $Session, [datetime]$SessionWrittenAt)
    if (-not $Process -or $Process.Name -ne 'node.exe' -or -not $Process.CreationDate) { return $false }
    # Check the executable and actual script argument, not a substring elsewhere in the command.
    if (-not $Process.ExecutablePath -or $Process.ExecutablePath -ine $NodePath) { return $false }
    $questArgv = @(Get-QuestboundCommandArguments $Process.CommandLine)
    if ($questArgv.Count -lt 2) { return $false }
    if ($Role -eq 'share') {
        if ($questArgv.Count -ne 4 -or $questArgv[2] -cne '--public') { return $false }
        $questSavedOrigin = Get-QuestboundHttpsOrigin $Session.link
        if (-not $questSavedOrigin -or (Get-QuestboundHttpsOrigin $questArgv[3]) -ine $questSavedOrigin) { return $false }
    } elseif ($questArgv.Count -ne 2) { return $false }

    $questExpected = [IO.Path]::GetFullPath((Join-Path $Root $Script))
    $questArgument = $questArgv[1].Replace('/', '\')
    if ([IO.Path]::IsPathRooted($questArgument)) {
        try { return [IO.Path]::GetFullPath($questArgument) -ieq $questExpected } catch { return $false }
    }
    if ($questArgument -ine $Script -and $questArgument -ine ('.\' + $Script)) { return $false }
    if ($LauncherPid -and ($Process.ParentProcessId -eq $LauncherPid -or $Process.ProcessId -eq $LauncherPid)) { return $true }

    # A manually started gateway has no launcher parent. It writes its own PID and
    # link to this folder's session file at startup. Require both that PID and a
    # matching creation time so a stale record cannot identify a reused PID.
    if ($Role -notin @('share', 'phone') -or -not $Session -or $Session.pid -ne $Process.ProcessId) { return $false }
    if ($Role -eq 'phone') {
        $questPhoneUri = $null
        if (-not [uri]::TryCreate([string]$Session.phone, [UriKind]::Absolute, [ref]$questPhoneUri) -or $questPhoneUri.Scheme -ne 'http' -or $questPhoneUri.Port -ne 8085) { return $false }
    }
    try { $questAge = ($SessionWrittenAt.ToUniversalTime() - ([datetime]$Process.CreationDate).ToUniversalTime()).TotalSeconds } catch { return $false }
    return $questAge -ge -2 -and $questAge -le 120
}
