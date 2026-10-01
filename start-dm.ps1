# Run this privately in a PowerShell terminal. Never paste the key into chat.
Write-Host 'Questbound private AI setup'
Write-Host 'Use your existing complete secret key, not its name or the masked dashboard entry.'
Write-Host 'The key stays private in this session. Press Ctrl+C to cancel.'
try {
    $existingService = $null
    try { $existingService = Invoke-RestMethod -Uri 'http://localhost:8084/health' -TimeoutSec 2 } catch { }
    if ($null -ne $existingService) {
        Write-Host 'A DM server is already running. Press Ctrl+C in its terminal before running this setup again.'
        return
    }
    while ($true) {
        $secureApiKey = Read-Host 'OpenAI API key (hidden)' -AsSecureString
        $apiKeyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureApiKey)
        try { $env:OPENAI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($apiKeyPointer).Trim() }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($apiKeyPointer); $secureApiKey.Dispose() }
        $env:OPENAI_MODEL = Read-Host 'Play model ID (press Enter for gpt-6-luna)'
        if ([string]::IsNullOrWhiteSpace($env:OPENAI_MODEL)) { $env:OPENAI_MODEL = 'gpt-6-luna' }
        $env:OPENAI_MODEL = $env:OPENAI_MODEL.Trim()
        $storyModel = Read-Host 'Story writer model ID for new adventures and heroes (press Enter to use the play model)'
        if ([string]::IsNullOrWhiteSpace($storyModel)) { Remove-Item Env:OPENAI_STORY_MODEL -ErrorAction SilentlyContinue } else { $env:OPENAI_STORY_MODEL = $storyModel.Trim() }
        Write-Host 'Checking one small live AI reply before starting the server...'
        & node (Join-Path $PSScriptRoot 'check-dm-setup.cjs')
        if ($LASTEXITCODE -eq 0) { break }
        Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
        $retrySetup = Read-Host 'Press Enter to retry privately, or type Q to quit'
        if ($retrySetup -match '^[qQ]$') { return }
    }
    $env:QUESTBOUND_DM_PORT = '8084'
    & node (Join-Path $PSScriptRoot 'dm-server.cjs')
}
finally { Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue; Remove-Item Env:OPENAI_MODEL -ErrorAction SilentlyContinue; Remove-Item Env:OPENAI_STORY_MODEL -ErrorAction SilentlyContinue; Remove-Item Env:QUESTBOUND_DM_PORT -ErrorAction SilentlyContinue }
