[CmdletBinding()]
param([Parameter(Mandatory)][string]$ScriptPath)
$ErrorActionPreference = 'Stop'
$credential = & (Join-Path $PSScriptRoot 'Get-RemotePcCredential.ps1') -Target 'OneTeamBooster/jenkins/wonix-cicd.ips.co.kr'
$oldUser = $env:OTB_JENKINS_USER
$oldPassword = $env:OTB_JENKINS_PASSWORD
try {
    $env:OTB_JENKINS_USER = $credential.UserName
    $env:OTB_JENKINS_PASSWORD = $credential.GetNetworkCredential().Password
    & node $ScriptPath
    if ($LASTEXITCODE -ne 0) { throw 'Jenkins operation failed; see the redacted error code.' }
} finally {
    $env:OTB_JENKINS_USER = $oldUser
    $env:OTB_JENKINS_PASSWORD = $oldPassword
    $credential.Password.Dispose()
}
