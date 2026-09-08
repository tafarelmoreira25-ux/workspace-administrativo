param([int]$BatchSize = 25)

$ErrorActionPreference = 'Stop'
if ($BatchSize -lt 1 -or $BatchSize -gt 50) {
  throw 'BatchSize deve estar entre 1 e 50.'
}

$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root '.env'
$preparedPath = Join-Path $root '.tmp\importacao-processos-preparada.json'
$checkpointPath = Join-Path $root '.tmp\importacao-processos-checkpoint.json'
$resultsPath = Join-Path $root '.tmp\importacao-processos-resultados.json'
$projectRef = 'ledjqodwccotuxdrkjgk'
$sourceKey = 'google-sheets:1wHKxXyz3RZf72tgvMHR9W5LhWeuMu9K9k5TbfRiRloA:PROCESSOS'
$apiBase = "https://api.supabase.com/v1/projects/$projectRef/database/query"

$tokenLine = [IO.File]::ReadAllLines($envPath, [Text.Encoding]::UTF8) |
  Where-Object { $_ -match '^\s*SUPABASE_ACCESS_TOKEN\s*=' } |
  Select-Object -First 1
if (-not $tokenLine) {
  throw 'SUPABASE_ACCESS_TOKEN não encontrado no .env.'
}
$token = ($tokenLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
if (-not $token) {
  throw 'SUPABASE_ACCESS_TOKEN está vazio.'
}

$headers = @{ Authorization = "Bearer $token" }
$prepared = [IO.File]::ReadAllText($preparedPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
$rows = @($prepared.rows)
$batchCount = [Math]::Ceiling($rows.Count / $BatchSize)
$allResults = New-Object System.Collections.ArrayList

for ($batchIndex = 0; $batchIndex -lt $batchCount; $batchIndex++) {
  $offset = $batchIndex * $BatchSize
  $lastIndex = [Math]::Min($offset + $BatchSize - 1, $rows.Count - 1)
  $batch = @($rows[$offset..$lastIndex])
  $json = $batch | ConvertTo-Json -Depth 12 -Compress
  $escapedJson = $json.Replace("'", "''")
  $query = @"
select set_config('request.jwt.claim.role', 'service_role', true);
select public.importar_processos_protocolados_lote(
  '$escapedJson'::jsonb,
  '$sourceKey'
) as resultado;
"@
  $body = @{ query = $query } | ConvertTo-Json -Compress
  $bodyBytes = [Text.Encoding]::UTF8.GetBytes($body)
  $response = Invoke-RestMethod -Method Post -Uri $apiBase -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $bodyBytes -TimeoutSec 90
  $responseRows = @($response)
  if ($responseRows.Count -eq 0 -or -not $responseRows[0].resultado) {
    throw "Lote $($batchIndex + 1) retornou resposta inesperada."
  }
  $batchResults = @($responseRows[0].resultado.resultados)
  foreach ($item in $batchResults) {
    [void]$allResults.Add($item)
  }
  $checkpoint = [ordered]@{
    fonte = $sourceKey
    lote_concluido = $batchIndex + 1
    lotes_totais = $batchCount
    linhas_concluidas = $lastIndex + 1
    atualizado_em = [DateTime]::UtcNow.ToString('o')
  }
  [IO.File]::WriteAllText($checkpointPath, ($checkpoint | ConvertTo-Json -Depth 5), [Text.Encoding]::UTF8)
  Write-Output "Lote $($batchIndex + 1)/$batchCount persistido - $($lastIndex + 1)/$($rows.Count) linhas válidas."
}

[IO.File]::WriteAllText($resultsPath, ($allResults | ConvertTo-Json -Depth 12), [Text.Encoding]::UTF8)
[pscustomobject]@{
  linhas_enviadas = $rows.Count
  resultados = $allResults.Count
  acoes_criado = @($allResults | Where-Object { $_.processo_acao -eq 'criado' }).Count
  acoes_atualizado = @($allResults | Where-Object { $_.processo_acao -eq 'atualizado' }).Count
  erros = @($allResults | Where-Object { $_.erro }).Count
} | ConvertTo-Json -Compress
