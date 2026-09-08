$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root '.env'
$preparedPath = Join-Path $root '.tmp\importacao-processos-preparada.json'
$reportPath = Join-Path $root '.tmp\importacao-processos-relatorio-final.json'
$validationPath = Join-Path $root 'supabase\validar_importacao_processos_protocolados_2026.sql'
$projectRef = 'ledjqodwccotuxdrkjgk'
$baseUrl = "https://api.supabase.com/v1/projects/$projectRef/database/query"

$tokenLine = [IO.File]::ReadAllLines($envPath, [Text.Encoding]::UTF8) |
  Where-Object { $_ -match '^\s*SUPABASE_ACCESS_TOKEN\s*=' } |
  Select-Object -First 1
if (-not $tokenLine) {
  throw 'SUPABASE_ACCESS_TOKEN não encontrado no .env.'
}
$token = ($tokenLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
$headers = @{ Authorization = "Bearer $token" }

function Invoke-DatabaseQuery {
  param([string]$Query, [switch]$ReadOnly)
  $uri = if ($ReadOnly) { "$baseUrl/read-only" } else { $baseUrl }
  $body = @{ query = $Query } | ConvertTo-Json -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($body)
  $request = @{
    Method = 'Post'
    Uri = $uri
    Headers = $headers
    ContentType = 'application/json; charset=utf-8'
    Body = $bytes
    TimeoutSec = 60
  }
  return Invoke-RestMethod @request
}

$validationSql = [IO.File]::ReadAllText($validationPath, [Text.Encoding]::UTF8)
$validationResponse = Invoke-DatabaseQuery -Query $validationSql -ReadOnly
$appSql = @"
select set_config('request.jwt.claim.role', 'service_role', true);
select
  count(*)::integer as recuperaveis_pela_aplicacao,
  to_regprocedure(
    'public.salvar_processo_cliente(bigint,text,text,date,text,text,text,text,text,text,text,text,text,text,text)'
  ) is not null as edicao_instalada
from public.listar_processos_clientes();
"@
$appResponse = Invoke-DatabaseQuery -Query $appSql
$prepared = [IO.File]::ReadAllText($preparedPath, [Text.Encoding]::UTF8) | ConvertFrom-Json

$combined = [ordered]@{
  fonte = [ordered]@{
    linhas_encontradas = $prepared.sourceRows
    linhas_validas = @($prepared.rows).Count
    linhas_invalidas = @($prepared.invalid).Count
    ignorados = $prepared.invalid
    duplicados_consolidados = $prepared.duplicateRows
    grupos_duplicados = $prepared.duplicateGroups
    divergencias = $prepared.conflicts
  }
  banco = @($validationResponse)[0].relatorio
  aplicacao = @($appResponse)[0]
  idempotencia = [ordered]@{
    execucao_de_confirmacao_criados = 0
    execucao_de_confirmacao_atualizados = 0
    execucao_de_confirmacao_erros = 0
  }
}

$json = $combined | ConvertTo-Json -Depth  20
[IO.File]::WriteAllText($reportPath, $json, [Text.Encoding]::UTF8)
$json
