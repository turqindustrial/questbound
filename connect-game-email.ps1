$ErrorActionPreference='Stop'
$questMailAddress=(Read-Host 'Dedicated Questbound Gmail address').Trim().ToLowerInvariant()
if($questMailAddress -notmatch '^[a-z0-9._%+-]+@gmail\.com$'){throw 'Enter the dedicated Gmail address.'}
Write-Host 'Use a Google app password, not your ordinary Google password. Nothing is shown or sent to chat.'
$questMailSecret=Read-Host 'Gmail app password (hidden)' -AsSecureString
if($questMailSecret.Length -lt 16){throw 'The app password is incomplete. Nothing was saved.'}
$questMailSecret | ConvertFrom-SecureString | Set-Content -LiteralPath (Join-Path $PSScriptRoot '.questbound-mail.dpapi')
@{sender=$questMailAddress;feedback=$true} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot '.questbound-mail.json') -Encoding utf8
Write-Host 'Mailbox settings saved locally. Test a verification email and feedback delivery in the game. Restart the table and gateways after the update.'
