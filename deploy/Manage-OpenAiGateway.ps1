# Project-scoped management using an existing Supabase CLI credential.
# Never print credentials, headers, upstream bodies, or environment values.
[CmdletBinding()]
param([ValidateSet('Inspect','Initialize','Deploy','Check','Generate')][string]$Action='Inspect')
$ErrorActionPreference='Stop'
$project='uadmxxpoxaukuwwvfdpr'
$api="https://api.supabase.com/v1/projects/$project"
$endpoint="https://$project.supabase.co/functions/v1/openai-gateway"
$target="OneTeamBooster/openai-gateway/$project"
$root=Split-Path $PSScriptRoot -Parent
$credential=& (Join-Path $root 'Get-RemotePcCredential.ps1') -Target 'Supabase CLI:supabase'
# Go's credential store uses UTF-8 bytes; our Windows helper uses UTF-16.
$managementToken=[Text.Encoding]::UTF8.GetString([Text.Encoding]::Unicode.GetBytes($credential.GetNetworkCredential().Password)).TrimEnd([char]0)
if($managementToken -notmatch '^sbp_[A-Za-z0-9]+$'){throw 'Unsupported Supabase CLI credential format.'}
$headers=@{Authorization=('Bearer '+$managementToken)}
function Read-GatewayToken {
    $userName=''
    $secret=[OtbRemote.CredentialStore]::Read($target,[ref]$userName)
    try { return [Net.NetworkCredential]::new('', $secret).Password }
    finally { $secret.Dispose() }
}
try {
    if($Action -eq 'Inspect'){
        $functions=Invoke-RestMethod -Uri "$api/functions" -Headers $headers
        $secrets=Invoke-RestMethod -Uri "$api/secrets" -Headers $headers
        [pscustomobject]@{project=$project;functions=@($functions|Select-Object slug,status,version);secretNames=@($secrets|ForEach-Object{$_.name})}|ConvertTo-Json -Depth 4
    }
    elseif($Action -eq 'Initialize'){
        $secrets=Invoke-RestMethod -Uri "$api/secrets" -Headers $headers
        if(@($secrets.name) -contains 'OTB_GATEWAY_TOKEN'){
            $gatewayToken=Read-GatewayToken
            Write-Output 'Existing gateway secret preserved; local caller credential is available.'
        } else {
            try { $gatewayToken=Read-GatewayToken } catch {
                $bytes=New-Object byte[] 32
                $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
                try{$rng.GetBytes($bytes)}finally{$rng.Dispose()}
                $gatewayToken=([BitConverter]::ToString($bytes)).Replace('-','').ToLowerInvariant()
                $secure=ConvertTo-SecureString $gatewayToken -AsPlainText -Force
                try{[OtbRemote.CredentialStore]::Save($target,'otb-backend',$secure)}finally{$secure.Dispose()}
                if((Read-GatewayToken) -cne $gatewayToken){throw 'Gateway credential verification failed.'}
            }
            $body=ConvertTo-Json -InputObject @(@{name='OTB_GATEWAY_TOKEN';value=$gatewayToken}) -Compress
            $null=Invoke-RestMethod -Method Post -Uri "$api/secrets" -Headers $headers -ContentType 'application/json' -Body $body
            Write-Output 'Gateway token saved in Supabase Secrets and Windows Credential Manager; values not displayed.'
        }
    }
    elseif($Action -eq 'Deploy'){
        $secrets=Invoke-RestMethod -Uri "$api/secrets" -Headers $headers
        if(@($secrets.name) -notcontains 'OTB_GATEWAY_TOKEN'){throw 'Initialize gateway authentication before deploying.'}
        $metadata=@{name='openai-gateway';entrypoint_path='index.ts';verify_jwt=$false}|ConvertTo-Json -Compress
        $functionRoot=Join-Path $root 'supabase/functions/openai-gateway'
        $files=@('index.ts','handler.js','options.js','praise-prompt.js')|ForEach-Object{Get-Item -LiteralPath (Join-Path $functionRoot $_)}
        $result=Invoke-RestMethod -Method Post -Uri "$api/functions/deploy?slug=openai-gateway" -Headers $headers -Form @{metadata=$metadata;file=$files} -TimeoutSec 120
        $result|Select-Object slug,status,version,verify_jwt|ConvertTo-Json
    }
    elseif($Action -eq 'Check'){
        $unauth=Invoke-WebRequest -Uri "$endpoint/health" -SkipHttpErrorCheck -TimeoutSec 30
        if([int]$unauth.StatusCode -ne 401){throw 'Unauthenticated request was not rejected with 401.'}
        $gatewayToken=Read-GatewayToken
        $health=Invoke-RestMethod -Uri "$endpoint/health" -Headers @{Authorization=('Bearer '+$gatewayToken)} -TimeoutSec 30
        [pscustomobject]@{unauthenticatedStatus=[int]$unauth.StatusCode;health=$health}|ConvertTo-Json -Depth 3
    }
    elseif($Action -eq 'Generate'){
        $gatewayToken=Read-GatewayToken
        $body=@{projectName='가상 문서 검토';partner='동료';missions=@('문서 작성');boosts=@('정보 공유');impacts=@('품질 향상')}|ConvertTo-Json -Compress
        $result=Invoke-WebRequest -Method Post -Uri $endpoint -Headers @{Authorization=('Bearer '+$gatewayToken)} -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -SkipHttpErrorCheck -TimeoutSec 35
        $data=$result.Content|ConvertFrom-Json
        # Output only contract fields; never any arbitrary returned exception/body.
        if([int]$result.StatusCode -ne 200){[pscustomobject]@{status=[int]$result.StatusCode;code=$data.error}|ConvertTo-Json;exit 1}
        if($data.source -ne 'openai' -or $data.message.Length -gt 500 -or $data.message -notmatch '[가-힣]'){throw 'Unexpected gateway response.'}
        [pscustomobject]@{status=200;source=$data.source;model=$data.model;promptVersion=$data.promptVersion;messageLength=$data.message.Length}|ConvertTo-Json
    }
} catch {
    if($_.Exception.Response){Write-Error ('GATEWAY_OPERATION_FAILED HTTP '+[int]$_.Exception.Response.StatusCode)}
    else{Write-Error ('GATEWAY_OPERATION_FAILED '+$Action)}
    exit 1
} finally {
    $managementToken=$null;$gatewayToken=$null;$credential=$null;$headers=$null;$body=$null
}
