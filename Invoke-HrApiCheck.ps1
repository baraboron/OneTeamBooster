# Reads the API key privately and prints only aggregate validation results, never employee rows.
$ErrorActionPreference = 'Stop'
$credential = & (Join-Path $PSScriptRoot 'Get-RemotePcCredential.ps1') -Target 'OneTeamBooster/hr-api/ax.ips.co.kr'
$previousKey = $env:DATA_API_KEY
try {
    $env:DATA_API_KEY = $credential.GetNetworkCredential().Password
    & node (Join-Path $PSScriptRoot 'backend/scripts/check-hr.js')
    if ($LASTEXITCODE -ne 0) { throw 'HR API verification failed; see the redacted error code.' }
} finally {
    $env:DATA_API_KEY = $previousKey
    $credential.Password.Dispose()
}
