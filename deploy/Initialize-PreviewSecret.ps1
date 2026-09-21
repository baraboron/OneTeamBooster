# Creates the preview namespace's first runtime Secret. Never prints secret values.
# Refuses to replace an existing Secret; database password rotation is a separate operation.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$credentialHelper = Join-Path $projectRoot 'Get-RemotePcCredential.ps1'
$remoteHelper = Join-Path $projectRoot 'Invoke-RemotePc.ps1'
$hrCredential = & $credentialHelper -Target 'OneTeamBooster/hr-api/ax.ips.co.kr'
$dbPassword = $null
$secretFile = Join-Path $projectRoot ('tmp/otb-runtime-' + [guid]::NewGuid().ToString('N') + '.env')
try {
    $existingSecret = & $remoteHelper -RemoteCommand "if kubectl get namespace oneteambooster-preview >/dev/null 2>&1; then kubectl -n oneteambooster-preview get secret otb-runtime --ignore-not-found -o name; fi"
    if ($existingSecret) { throw 'otb-runtime already exists. Use an explicit credential rotation procedure.' }
    $bytes = New-Object byte[] 32
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $random.GetBytes($bytes) } finally { $random.Dispose() }
    $dbPassword = ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
    $content = 'DATA_API_KEY=' + $hrCredential.GetNetworkCredential().Password + "`nPGPASSWORD=" + $dbPassword + "`n"
    [IO.File]::WriteAllText($secretFile, $content, [Text.UTF8Encoding]::new($false))
    & $remoteHelper -UploadFile $secretFile -DestinationPath '/home/admin/tmp/otb-preview-20260918-v2/runtime.env'
    & $remoteHelper -RemoteCommand "set -eu; cd /home/admin/tmp/otb-preview-20260918-v2; trap 'rm -f -- runtime.env' EXIT; chmod 600 runtime.env; kubectl get namespace oneteambooster-preview >/dev/null 2>&1 || kubectl create namespace oneteambooster-preview; kubectl -n oneteambooster-preview create secret generic otb-runtime --from-env-file=runtime.env"
    $securePassword = ConvertTo-SecureString -String $dbPassword -AsPlainText -Force
    try { [OtbRemote.CredentialStore]::Save('OneTeamBooster/postgres/oneteambooster-preview', 'otb', $securePassword) }
    finally { $securePassword.Dispose() }
} finally {
    if (Test-Path -LiteralPath $secretFile) { Remove-Item -LiteralPath $secretFile -Force }
    $hrCredential.Password.Dispose()
    $content = $null
    $dbPassword = $null
}
