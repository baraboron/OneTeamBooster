# Run from the Windows user account that owns the saved credential.
# Example: .\Invoke-RemotePc.ps1 -RemoteCommand 'hostname'
[CmdletBinding(DefaultParameterSetName = 'Command')]
param(
    [Parameter(ParameterSetName = 'Command')]
    [string]$RemoteCommand = 'hostname',
    [Parameter(ParameterSetName = 'Command')]
    [switch]$Sudo,
    [Parameter(Mandatory, ParameterSetName = 'Upload')]
    [string]$UploadFile,
    [Parameter(Mandatory, ParameterSetName = 'Upload')]
    [ValidatePattern('^/[a-zA-Z0-9_./-]+$')]
    [string]$DestinationPath,
    [Parameter(Mandatory, ParameterSetName = 'Download')]
    [ValidatePattern('^/[a-zA-Z0-9_./-]+$')]
    [string]$DownloadFile,
    [Parameter(Mandatory, ParameterSetName = 'Download')]
    [string]$LocalPath
)

$ErrorActionPreference = 'Stop'
$credentialHelper = Join-Path $PSScriptRoot 'Get-RemotePcCredential.ps1'
$null = & $credentialHelper -Verify
$askPassFile = Join-Path ([IO.Path]::GetTempPath()) ('otb-ssh-askpass-' + [guid]::NewGuid().ToString('N') + '.cmd')
$environmentNames = @('SSH_ASKPASS', 'SSH_ASKPASS_REQUIRE', 'DISPLAY', 'OTB_SSH_ASKPASS_ACTIVE')
$previousEnvironment = @{}
foreach ($name in $environmentNames) { $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }

try {
    # The temporary launcher contains a helper path only, never the password.
    $launcher = '@echo off' + "`r`n" + 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + $credentialHelper + '" -SshAskPass -PromptText %1' + "`r`n"
    [IO.File]::WriteAllText($askPassFile, $launcher, [Text.Encoding]::Default)
    $env:SSH_ASKPASS = $askPassFile
    $env:SSH_ASKPASS_REQUIRE = 'force'
    $env:DISPLAY = 'otb-credential-helper'
    $env:OTB_SSH_ASKPASS_ACTIVE = '1'
    # Accept a first-seen host key; changed host keys remain blocked by OpenSSH.
    if ($PSCmdlet.ParameterSetName -eq 'Upload') {
        $sourceFile = (Resolve-Path -LiteralPath $UploadFile).Path
        if (-not (Test-Path -LiteralPath $sourceFile -PathType Leaf)) { throw 'UploadFile must be a file.' }
        & scp.exe -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -o NumberOfPasswordPrompts=1 $sourceFile ('admin@192.168.20.72:' + $DestinationPath)
    } elseif ($PSCmdlet.ParameterSetName -eq 'Download') {
        & scp.exe -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -o NumberOfPasswordPrompts=1 ('admin@192.168.20.72:' + $DownloadFile) $LocalPath
    } else {
        if ($Sudo) {
            $sudoCredential = & $credentialHelper
            try {
                $quotedCommand = "'" + $RemoteCommand.Replace("'", "'\''") + "'"
                $sudoCredential.GetNetworkCredential().Password | & ssh.exe -T -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -o NumberOfPasswordPrompts=1 'admin@192.168.20.72' ("sudo -S -p '' -- sh -c " + $quotedCommand)
            } finally { $sudoCredential.Password.Dispose() }
        } else {
            & ssh.exe -T -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -o NumberOfPasswordPrompts=1 'admin@192.168.20.72' $RemoteCommand
        }
    }
    if ($LASTEXITCODE -ne 0) { throw "SSH operation failed (exit code $LASTEXITCODE)." }
} finally {
    foreach ($name in $environmentNames) { [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], 'Process') }
    if (Test-Path -LiteralPath $askPassFile) { Remove-Item -LiteralPath $askPassFile -Force }
}
