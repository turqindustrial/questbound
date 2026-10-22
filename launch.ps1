# Questbound launcher: starts the private AI Dungeon Master, the shared table, the desktop game and phone access.
# Double-click Questbound.cmd to run it. Services already running are reused, never duplicated.
#   -Stop            stop everything this launcher started
#   -Dev             serve the desktop game with the live-reloading Expo dev server instead of the finished build
#   -NoBrowser       do not open the browser
#   -ForgetKey       delete the remembered (encrypted) API key
#   -Models          choose the AI models (one for play, optionally a separate story writer) without re-entering the key
#   -InstallStartup  start Questbound in the background when you sign in to Windows (requires a remembered key)
#   -RemoveStartup   undo -InstallStartup
#   -Share           also share the game with playtesters over the internet: a secure Cloudflare link plus an invite code
#   -SetupTunnel     remember a permanent link for -Share from your own free Cloudflare account (a named tunnel's token,
#                    stored encrypted to your Windows account, and its public hostname)
#   -ForgetTunnel    forget the permanent link; -Share goes back to a temporary link
#   -TrustNetwork    retained for compatibility; remote HTTP play is disabled
#   -PauseGuests     refuse every guest's AI at once (turns, new tales, new pictures) until -ResumeGuests; no restart
#   -ResumeGuests    let guests play again
#   -PauseLibrary    stop the Dungeon Master writing new ready journeys (those written stay on offer) until -ResumeLibrary
#   -ResumeLibrary   let the journey library write new journeys again; no restart for either
param([switch]$PauseGuests,[switch]$ResumeGuests,[switch]$PauseLibrary,[switch]$ResumeLibrary,[switch]$Stop,[switch]$Dev,[switch]$NoBrowser,[switch]$ForgetKey,[switch]$Models,[switch]$InstallStartup,[switch]$RemoveStartup,[switch]$Share,[switch]$SetupTunnel,[switch]$ForgetTunnel,[switch]$TrustNetwork,[switch]$SetupDiscord,[switch]$ForgetDiscord,[switch]$AnnounceLink)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$logs = Join-Path $root '.questbound-logs'
$pidFile = Join-Path $logs 'pids.json'
$keyFile = Join-Path $root '.questbound-key.dpapi'
$modelFile = Join-Path $root '.questbound-model'
$storyModelFile = Join-Path $root '.questbound-story-model'
$sessionFile = Join-Path $root '.questbound-phone-session.json'
$shareFile = Join-Path $root '.questbound-share-session.json'
$tunnelTokenFile = Join-Path $root '.questbound-tunnel.dpapi'
$tunnelHostFile = Join-Path $root '.questbound-tunnel-host'
$discordFile = Join-Path $root '.questbound-discord.dpapi'
$discordLastFile = Join-Path $root '.questbound-discord-last'
$pauseFile = Join-Path $root '.questbound-guests-paused'
$libraryPauseFile = Join-Path $root '.questbound-library-paused'
New-Item -ItemType Directory -Force $logs | Out-Null

function Say($text, $color = 'Gray') { Write-Host $text -ForegroundColor $color }
function Test-Up($url) { try { (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 } catch { $false } }
function Get-Pids { if (Test-Path $pidFile) { try { return (Get-Content $pidFile -Raw | ConvertFrom-Json) } catch {} }; return New-Object PSObject }
function Save-Pid($name, $id) { $p = Get-Pids; $p | Add-Member -NotePropertyName $name -NotePropertyValue $id -Force; $p | ConvertTo-Json | Set-Content $pidFile -Encoding ASCII }
# Each service gets its own hidden console, so closing this window never stops it.
# It inherits this process's environment (how the key reaches the Dungeon Master without touching disk or the command line).
function Start-Hidden($name, $file, $arguments) {
  $out = Join-Path $logs "$name.log"; $err = Join-Path $logs "$name.err.log"
  $proc = Start-Process -FilePath 'cmd.exe' -ArgumentList "/d /s /c `"$file $arguments 1> `"$out`" 2> `"$err`"`"" -WorkingDirectory $root -WindowStyle Hidden -PassThru
  Save-Pid $name $proc.Id
  return $proc
}
function Wait-Up($url, $seconds) { for ($i = 0; $i -lt $seconds * 2; $i++) { if (Test-Up $url) { return $true }; Start-Sleep -Milliseconds 500 }; return $false }
# The models: one answers every turn (fast and cheap, no thinking), and another may write new adventures and heroes.
function Read-Models($model, $storyModel) {
  Say '  The play model answers every turn, so it should be fast and cheap: gpt-6-luna is suggested.' 'Cyan'
  $typed = Read-Host "  Play model ID (press Enter for $model)"
  if (-not [string]::IsNullOrWhiteSpace($typed)) { $model = $typed.Trim() }
  Say '  The story writer writes new adventures and heroes (a few times a session), so it may be a stronger, slower model.' 'Cyan'
  $prompt = if ($storyModel) { "  Story writer model ID (press Enter for $storyModel, or type same to use the play model)" } else { '  Story writer model ID (press Enter to use the play model for stories too)' }
  $typed = Read-Host $prompt
  if ($typed.Trim() -eq 'same') { $storyModel = '' } elseif (-not [string]::IsNullOrWhiteSpace($typed)) { $storyModel = $typed.Trim() }
  return @($model, $storyModel)
}
function Save-Models($model, $storyModel) {
  Set-Content $modelFile $model -Encoding ASCII
  if ($storyModel) { Set-Content $storyModelFile $storyModel -Encoding ASCII } else { Remove-Item $storyModelFile -ErrorAction SilentlyContinue }
}
function Find-Cloudflared {
  $c = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  foreach ($p in @("${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe", "$env:ProgramFiles\cloudflared\cloudflared.exe", "$env:LOCALAPPDATA\Microsoft\WinGet\Links\cloudflared.exe")) { if ($p -and (Test-Path $p)) { return $p } }
  return $null
}

if ($Stop) {
  $p = Get-Pids
  foreach ($prop in $p.PSObject.Properties) {
    if (Get-Process -Id $prop.Value -ErrorAction SilentlyContinue) { & taskkill.exe /PID $prop.Value /T /F | Out-Null; Say "Stopped $($prop.Name)." }
  }
  Remove-Item $pidFile, $shareFile -ErrorAction SilentlyContinue
  Say 'Questbound services started by this launcher are stopped.' 'Green'
  return
}
# The host's switch for guests: the share gateway and the Dungeon Master refuse all guest AI while the file exists.
if ($PauseGuests) { Set-Content $pauseFile ("Paused by the host at " + (Get-Date).ToString('s')) -Encoding ASCII; Say '  Guests are paused: every guest request to the Dungeon Master is refused. Your own play on this PC goes on.' 'Yellow'; Say '  Let them play again with: Questbound.cmd -ResumeGuests' 'DarkGray'; return }
if ($ResumeGuests) { Remove-Item $pauseFile -ErrorAction SilentlyContinue; Say '  Guests may play again.' 'Green'; return }
# The host's switch for the ready-journey library: while the file exists the Dungeon Master writes no new journey (read
# live, no restart); the journeys already written are still offered and started.
if ($PauseLibrary) { Set-Content $libraryPauseFile ('Paused by the host at ' + (Get-Date).ToString('s')) -Encoding ASCII; Say '  The journey library is paused: no new ready journey is written. Journeys already written stay on offer.' 'Yellow'; Say '  Let it write again with: Questbound.cmd -ResumeLibrary' 'DarkGray'; return }
if ($ResumeLibrary) { Remove-Item $libraryPauseFile -ErrorAction SilentlyContinue; Say '  The journey library may write new journeys again.' 'Green'; return }
if ($ForgetKey) { Remove-Item $keyFile, $modelFile, $storyModelFile -ErrorAction SilentlyContinue; Say 'The remembered API key was deleted from this PC.' 'Green'; return }
if ($Models) {
  $model = if (Test-Path $modelFile) { (Get-Content $modelFile -Raw).Trim() } else { 'gpt-6-luna' }
  $storyModel = if (Test-Path $storyModelFile) { (Get-Content $storyModelFile -Raw).Trim() } else { '' }
  $chosen = Read-Models $model $storyModel
  Save-Models $chosen[0] $chosen[1]
  $summary = if ($chosen[1]) { "$($chosen[0]) for play and $($chosen[1]) for stories and heroes" } else { "$($chosen[0]) for everything" }
  Say "  Saved: $summary. A running Dungeon Master uses them from its next reply; no restart is needed." 'Green'
  return
}
# Discord: the playtest link and invite code are posted to a channel of the host's own Discord server through a
# webhook (Server Settings > Integrations > Webhooks). The webhook address is a secret: it is kept DPAPI-encrypted
# like the API key, never printed, and never passed on a command line. A link is posted once, when it changes.
function Get-DiscordHook {
  if (-not (Test-Path $discordFile)) { return $null }
  try { $sec = (Get-Content $discordFile -Raw).Trim() | ConvertTo-SecureString } catch { Say '  The saved Discord webhook could not be unlocked on this Windows account. Run Connect-Discord.cmd again.' 'Red'; return $null }
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b).Trim() } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}
function Send-Discord($hook, $text) {
  $body = @{ content = $text; allowed_mentions = @{ parse = @() } } | ConvertTo-Json -Depth 4
  Invoke-RestMethod -Method Post -Uri $hook -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 15 | Out-Null
}
function Announce-Share($share, [switch]$Force) {
  if (-not $share -or -not (Test-Path $discordFile)) { return }
  $stamp = "$($share.link) $($share.inviteCode)"
  if (-not $Force -and (Test-Path $discordLastFile) -and (Get-Content $discordLastFile -Raw).Trim() -eq $stamp) { return }
  $hook = Get-DiscordHook; if (-not $hook) { return }
  $until = ([datetime]$share.expiresAt).ToLocalTime().ToString('dddd MMMM d')
  $text = "**Questbound** playtest link:`n$($share.link)`nInvite code: **$($share.inviteCode)** (good until $until)`nOpen it on your phone or computer. No sign-in needed."
  try { Send-Discord $hook $text; Set-Content $discordLastFile $stamp -Encoding ASCII; Say '  Posted the link to your Discord channel.' 'DarkGray' }
  catch { Say '  Could not post the link to Discord (the webhook may have been deleted). Run Connect-Discord.cmd again.' 'Yellow' }
}
if ($ForgetDiscord) { Remove-Item $discordFile, $discordLastFile -ErrorAction SilentlyContinue; Say '  Discord posting is off and the webhook was forgotten.' 'Green'; return }
if ($SetupDiscord) {
  Say '  Post playtest links to Discord. In your Discord server: Server Settings > Integrations > Webhooks >' 'Cyan'
  Say '  New Webhook, choose the channel for links, then Copy Webhook URL and paste it here.' 'Cyan'
  $hookSecure = Read-Host '  Webhook URL (typing is hidden)' -AsSecureString
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($hookSecure)
  try { $hook = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b).Trim() } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
  if ($hook -notmatch '^https://(ptb\.|canary\.)?(discord|discordapp)\.com/api/webhooks/\d+/[A-Za-z0-9_-]+$') { Say '  That is not a Discord webhook URL. Nothing was saved.' 'Red'; return }
  try { Send-Discord $hook 'Questbound will post new playtest links in this channel.' } catch { Say '  Discord did not accept that webhook. Nothing was saved.' 'Red'; return }
  $hookSecure | ConvertFrom-SecureString | Set-Content $discordFile -Encoding ASCII
  Remove-Item $discordLastFile -ErrorAction SilentlyContinue
  Say '  Saved. New playtest links will be posted to that channel automatically.' 'Green'
  if (Test-Path $shareFile) { try { Announce-Share (Get-Content $shareFile -Raw | ConvertFrom-Json) -Force } catch {} }
  return
}
if ($AnnounceLink) {
  if (-not (Test-Path $discordFile)) { Say '  Discord is not set up yet. Run Connect-Discord.cmd first.' 'Yellow'; return }
  if (-not (Test-Path $shareFile)) { Say '  Sharing is not running, so there is no link to post.' 'Yellow'; return }
  Announce-Share (Get-Content $shareFile -Raw | ConvertFrom-Json) -Force; return
}
if ($TrustNetwork) { Say 'Use Questbound-Share.cmd for encrypted phone play.' 'Yellow'; return }
if ($ForgetTunnel) { Remove-Item $tunnelTokenFile, $tunnelHostFile -ErrorAction SilentlyContinue; Say 'The permanent link was forgotten. -Share uses a temporary link again.' 'Green'; return }
# A permanent link: in the Cloudflare dashboard (Zero Trust > Networks > Tunnels) create a tunnel, give it a public
# hostname that points to http://127.0.0.1:8087, and paste its token here. The token never touches disk in plain text.
if ($SetupTunnel) {
  Say '  Permanent link for -Share. In your Cloudflare dashboard (Zero Trust > Networks > Tunnels) create a tunnel,' 'Cyan'
  Say '  add a public hostname for it that points to http://127.0.0.1:8087, then copy the tunnel token.' 'Cyan'
  $hostName = ((Read-Host '  Public hostname (for example play.example.com)').Trim().ToLower() -replace '^https?://', '') -replace '/.*$', ''
  if ($hostName -notmatch '^[a-z0-9-]+(\.[a-z0-9-]+)+$') { Say '  That does not look like a hostname. Nothing was saved.' 'Red'; return }
  $tokenSecure = Read-Host '  Tunnel token (typing is hidden)' -AsSecureString
  if ($tokenSecure.Length -lt 20) { Say '  That token looks too short. Nothing was saved.' 'Red'; return }
  $tokenSecure | ConvertFrom-SecureString | Set-Content $tunnelTokenFile -Encoding ASCII
  Set-Content $tunnelHostFile $hostName -Encoding ASCII
  Say "  Saved. Questbound.cmd -Share now uses https://$hostName/ (if sharing is running, stop it first with Questbound.cmd -Stop)." 'Green'
  return
}
$startupLink = Join-Path ([Environment]::GetFolderPath('Startup')) 'Questbound.lnk'
if ($RemoveStartup) { Remove-Item $startupLink -ErrorAction SilentlyContinue; Say 'Questbound will no longer start when you sign in.' 'Green'; return }
if ($InstallStartup) {
  if (-not (Test-Path $keyFile)) { Say 'Run Questbound once and choose to remember your API key first; background start cannot ask for it.' 'Yellow'; return }
  $shell = New-Object -ComObject WScript.Shell
  $link = $shell.CreateShortcut($startupLink)
  $link.TargetPath = 'powershell.exe'
  $link.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$root\launch.ps1`" -NoBrowser"
  $link.WorkingDirectory = $root
  $link.WindowStyle = 7
  $link.Save()
  Say 'Questbound will start in the background when you sign in to Windows. Undo with: Questbound.cmd -RemoveStartup' 'Green'
  return
}

Say ''
Say '  Q U E S T B O U N D' 'Yellow'
Say '  Starting your table...' 'DarkYellow'
Say ''

# 0. First run on a new PC: Node.js must be installed; the game's components are installed once.
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Say '  Questbound needs Node.js. Install the LTS version from https://nodejs.org and run this again.' 'Red'; return }
if (-not (Test-Path (Join-Path $root 'node_modules'))) {
  Say '  First run: installing the game components (a few minutes)...'
  & cmd.exe /c "npm.cmd ci > `"$logs\install.log`" 2>&1"
  if ($LASTEXITCODE -ne 0) { Say '  Installing failed. See .questbound-logs\install.log' 'Red'; return }
}

# 1. Keep the desktop and phone copies on the current source version.
if (-not $Dev) {
  $dist = Join-Path $root 'dist-phone\index.html'
  $built = if (Test-Path $dist) { (Get-Item $dist).LastWriteTime } else { [datetime]::MinValue }
  $newest = Get-ChildItem -Path (Join-Path $root '*') -File -Include *.js, *.json | Where-Object { $_.Name -notmatch '^\.|REPORT|COVERAGE|package-lock' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  $assets = Get-ChildItem -Path (Join-Path $root 'assets') -File -Recurse | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not (Test-Path $dist) -or $newest.LastWriteTime -gt $built -or ($assets -and $assets.LastWriteTime -gt $built)) {
    Say '  Building the latest version of the game (about a minute)...'
    & cmd.exe /c "npm.cmd run build:web > `"$logs\build.log`" 2>&1"
    if ($LASTEXITCODE -ne 0) { Say '  The build failed. See .questbound-logs\build.log' 'Red'; return }
  }
}

# 2. The private AI Dungeon Master (loopback only). The key never touches disk in plain text.
if (Test-Up 'http://localhost:8084/health') { Say '  Dungeon Master    already running' 'DarkGray' }
else {
  $secure = $null
  if (Test-Path $keyFile) { try { $secure = (Get-Content $keyFile -Raw).Trim() | ConvertTo-SecureString } catch { Say '  The remembered key could not be unlocked on this Windows account.' 'Yellow' } }
  $model = if (Test-Path $modelFile) { (Get-Content $modelFile -Raw).Trim() } else { 'gpt-6-luna' }
  $storyModel = if (Test-Path $storyModelFile) { (Get-Content $storyModelFile -Raw).Trim() } else { '' }
  $fresh = $false
  if (-not $secure) {
    Say '  The Dungeon Master needs your OpenAI API key. It stays private on this PC; typing is hidden.' 'Cyan'
    $secure = Read-Host '  OpenAI API key' -AsSecureString
    $chosen = Read-Models $model $storyModel
    $model = $chosen[0]; $storyModel = $chosen[1]
    $fresh = $true
  }
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $env:OPENAI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim()
    $env:OPENAI_MODEL = $model
    if ($storyModel) { $env:OPENAI_STORY_MODEL = $storyModel } else { Remove-Item Env:OPENAI_STORY_MODEL -ErrorAction SilentlyContinue }
    $env:QUESTBOUND_DM_PORT = '8084'
    if ($fresh) {
      Say '  Checking the key with one small live reply...'
      & node (Join-Path $root 'check-dm-setup.cjs')
      if ($LASTEXITCODE -ne 0) { Say '  The key check failed, so nothing was saved. Run Questbound again to retry.' 'Red'; return }
      $remember = Read-Host '  Remember this key on this PC, encrypted to your Windows account? [Y/n]'
      if ($remember -notmatch '^[nN]') { $secure | ConvertFrom-SecureString | Set-Content $keyFile -Encoding ASCII; Save-Models $model $storyModel; Say '  Saved. Only your Windows account on this PC can unlock it. Forget it with: Questbound.cmd -ForgetKey; change the models with: Questbound.cmd -Models' 'Green' }
    }
    Start-Hidden 'dm' 'node' 'dm-server.cjs' | Out-Null
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    Remove-Item Env:OPENAI_API_KEY, Env:OPENAI_MODEL, Env:OPENAI_STORY_MODEL, Env:QUESTBOUND_DM_PORT -ErrorAction SilentlyContinue
  }
  if (Wait-Up 'http://localhost:8084/health' 15) { Say '  Dungeon Master    started' 'Green' } else { Say '  The Dungeon Master did not start. See .questbound-logs\dm.err.log' 'Red' }
}

# 3. The shared table (loopback only).
if (Test-Up 'http://localhost:8086/health') { Say '  Shared table      already running' 'DarkGray' }
else { Start-Hidden 'table' 'node' 'sync-server.cjs' | Out-Null; if (Wait-Up 'http://localhost:8086/health' 10) { Say '  Shared table      started' 'Green' } else { Say '  The shared table did not start. See .questbound-logs\table.err.log' 'Red' } }

# 4. The desktop game.
if (Test-Up 'http://localhost:8081/') { Say '  Desktop game      already running' 'DarkGray' }
else {
  if ($Dev) { Start-Hidden 'desktop' 'npx.cmd' 'expo start --web --port 8081' | Out-Null; $wait = 90 }
  else { Start-Hidden 'desktop' 'node' 'desktop-server.cjs' | Out-Null; $wait = 10 }
  if (Wait-Up 'http://localhost:8081/' $wait) { Say '  Desktop game      started' 'Green' } else { Say '  The desktop game did not start. See .questbound-logs\desktop.err.log' 'Red' }
}

# 5. Remote play now requires the encrypted link, including on home Wi-Fi.
$session = $null
Say '  Phone access      uses the HTTPS playtest link (Questbound-Share.cmd)' 'DarkGray'

# 6. Sharing with playtesters over the internet (only with -Share): a Cloudflare tunnel to a loopback-only gateway
#    that asks for an invite code. A quick tunnel's link lasts as long as the tunnel; a permanent link (-SetupTunnel)
#    never changes, and its invite code survives restarts. The invite code lasts a week.
$shared = $null
if (-not $Share -and (Test-Path $shareFile)) { try { $candidateShare = Get-Content $shareFile -Raw | ConvertFrom-Json; if (Get-Process -Id $candidateShare.pid -ErrorAction SilentlyContinue) { $shared = $candidateShare } } catch {} }
$named = (Test-Path $tunnelTokenFile) -and (Test-Path $tunnelHostFile)
if ($Share) {
  if (Test-Path $shareFile) { try { $shared = Get-Content $shareFile -Raw | ConvertFrom-Json } catch {} }
  $p = Get-Pids
  $tunnelAlive = $p.tunnel -and (Get-Process -Id $p.tunnel -ErrorAction SilentlyContinue)
  $shareAlive = $shared -and (Get-Process -Id $shared.pid -ErrorAction SilentlyContinue) -and ([datetime]$shared.expiresAt).ToUniversalTime() -gt (Get-Date).ToUniversalTime().AddHours(12)
  if ($tunnelAlive -and $shareAlive) { Say '  Sharing           already running' 'DarkGray' }
  else {
    $shared = $null
    $cf = Find-Cloudflared
    if (-not $cf) { Say '  Sharing needs the free Cloudflare tunnel tool. Install it once, then run this again:' 'Yellow'; Say '    winget install --id Cloudflare.cloudflared -e' 'White' }
    else {
      foreach ($name in 'tunnel', 'share') { if ($p.$name -and (Get-Process -Id $p.$name -ErrorAction SilentlyContinue)) { & taskkill.exe /PID $p.$name /T /F | Out-Null } }
      if (-not $named) { Remove-Item $shareFile -ErrorAction SilentlyContinue }
      $tunnelLog = Join-Path $logs 'tunnel.err.log'
      Remove-Item $tunnelLog -ErrorAction SilentlyContinue
      $url = $null
      if ($named) {
        # The token reaches cloudflared through its environment, never the command line.
        $tunnelSecure = $null
        try { $tunnelSecure = (Get-Content $tunnelTokenFile -Raw).Trim() | ConvertTo-SecureString } catch { Say '  The saved tunnel token could not be unlocked on this Windows account. Run Questbound.cmd -SetupTunnel again.' 'Red' }
        if ($tunnelSecure) {
          $tb = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($tunnelSecure)
          try { $env:TUNNEL_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tb).Trim(); Start-Hidden 'tunnel' "`"$cf`"" 'tunnel --no-autoupdate run' | Out-Null }
          finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tb); Remove-Item Env:TUNNEL_TOKEN -ErrorAction SilentlyContinue }
          for ($i = 0; $i -lt 40; $i++) { Start-Sleep -Milliseconds 500; if ((Test-Path $tunnelLog) -and ([string](Get-Content $tunnelLog -Raw -ErrorAction SilentlyContinue)) -match 'Registered tunnel connection') { break } }
          $url = 'https://' + (Get-Content $tunnelHostFile -Raw).Trim()
        }
      } else {
        Start-Hidden 'tunnel' "`"$cf`"" 'tunnel --no-autoupdate --url http://127.0.0.1:8087' | Out-Null
        for ($i = 0; $i -lt 80 -and -not $url; $i++) {
          Start-Sleep -Milliseconds 500
          if (Test-Path $tunnelLog) { $m = [regex]::Match("$(Get-Content $tunnelLog -Raw -ErrorAction SilentlyContinue)", 'https://[a-z0-9-]+\.trycloudflare\.com'); if ($m.Success) { $url = $m.Value } }
        }
      }
      if (-not $url) { Say '  The secure link did not start. See .questbound-logs\tunnel.err.log' 'Red' }
      else {
        Start-Hidden 'share' 'node' "phone-server.cjs --public $url" | Out-Null
        for ($i = 0; $i -lt 20 -and -not (Test-Path $shareFile); $i++) { Start-Sleep -Milliseconds 500 }
        if (Test-Path $shareFile) { $shared = Get-Content $shareFile -Raw | ConvertFrom-Json; Say '  Sharing           started' 'Green' }
        else { Say '  Sharing did not start. See .questbound-logs\share.err.log' 'Red' }
      }
    }
  }
}

Say ''
Say '  Desktop:  http://localhost:8081/' 'White'
if ($session) {
  Say "  Phone:    $($session.phone)" 'White'
  Say "  Pairing code: $($session.pairingCode)   (valid until $(([datetime]$session.expiresAt).ToLocalTime().ToString('ddd MMM d, h:mm tt')))" 'White'
  Say '  Phones need the same Wi-Fi as this PC.' 'DarkGray'
}
if ($shared) {
  Say ''
  Say "  Phone / playtest link:  $($shared.link)" 'Yellow'
  Say "  Invite code:    $($shared.inviteCode)   (valid until $(([datetime]$shared.expiresAt).ToLocalTime().ToString('ddd MMM d, h:mm tt')))" 'Yellow'
  Say '  Send both to your testers. Their play uses your OpenAI key; keep this PC awake while they play.' 'DarkGray'
  if ($named) { Say '  This link stays the same, and so does the invite code until it expires.' 'DarkGray' }
  else { Say '  The link changes if sharing restarts (for example after a reboot). For a permanent link see Questbound.cmd -SetupTunnel' 'DarkGray' }
  Announce-Share $shared
  try { Set-Clipboard -Value ("Questbound playtest: $($shared.link)  Invite code: $($shared.inviteCode)"); Say '  (Link and code copied to your clipboard.)' 'DarkGray' } catch {}
}
# Playtest notes not yet read (feedback-report.cjs keeps the marker; only its --mark moves it).
try {
  $unread = [int]((& node (Join-Path $root 'feedback-report.cjs') --count 2>$null | Select-Object -Last 1))
  if ($unread -gt 0) { Say ''; Say "  $unread new playtest note(s): node feedback-report.cjs" 'Yellow' }
} catch {}
# What the AI has cost today and this month against the ceilings (dm-report.cjs, spending.cjs).
try {
  $spent = (& node (Join-Path $root 'dm-report.cjs') --status 2>$null | Select-Object -Last 1)
  if ($spent) { $tone = if ($spent -match 'PAUSED') { 'Yellow' } else { 'DarkGray' }; Say "  $spent" $tone }
} catch {}
# Anonymous play counts and session ratings, the last 7 days (play-report.cjs; all of it: node play-report.cjs).
try {
  $play = (& node (Join-Path $root 'play-report.cjs') --brief --days 7 2>$null | Select-Object -Last 1)
  if ($play) { Say "  $play" 'DarkGray' }
} catch {}
Say ''
Say '  Everything keeps running in the background after you close this window.' 'DarkGray'
Say '  Stop it all with: Questbound.cmd -Stop' 'DarkGray'
if (-not $NoBrowser) { Start-Process 'http://localhost:8081/' }
