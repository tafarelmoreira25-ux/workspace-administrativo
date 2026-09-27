param(
  [string]$WorkbookPath = '',
  [string]$OutputPath = (Join-Path $PSScriptRoot '..\supabase\20260927_import_homologacao_backup.sql')
)

$ErrorActionPreference = 'Stop'

if (-not $WorkbookPath) {
  $WorkbookPath = (Get-ChildItem 'C:\Users\User\Downloads' -Filter '*BACKUP.xlsx' | Where-Object { $_.Name -like 'HOMOLOGA*' } | Select-Object -First 1).FullName
}
if (-not $WorkbookPath) { throw 'Planilha de homologacao nao encontrada na pasta Downloads.' }

function SqlText([object]$Value) {
  $text = [string]$Value
  if ([string]::IsNullOrWhiteSpace($text)) { return 'null' }
  return "'" + $text.Trim().Replace("'", "''") + "'"
}

function SqlNumber([object]$Value) {
  $text = ([string]$Value).Trim()
  if (-not $text) { return 'null' }
  $text = $text -replace '[^0-9,.-]', ''
  if ($text -match ',') { $text = ($text -replace '\.', '') -replace ',', '.' }
  $number = 0.0
  if (-not [double]::TryParse($text, [Globalization.NumberStyles]::Any, [Globalization.CultureInfo]::InvariantCulture, [ref]$number)) { return 'null' }
  return $number.ToString('0.##', [Globalization.CultureInfo]::InvariantCulture)
}

function SqlInteger([object]$Value) {
  $number = SqlNumber $Value
  if ($number -eq 'null') { return 'null' }
  return ([int][double]::Parse($number, [Globalization.CultureInfo]::InvariantCulture)).ToString()
}

function SqlDate([object]$Value) {
  if ($Value -is [datetime]) {
    if ($Value.Year -lt 2000 -or $Value.Year -gt ((Get-Date).Year + 1)) { return 'null' }
    return "'" + $Value.ToString('yyyy-MM-dd') + "'::date"
  }
  if ($Value -is [double] -or $Value -is [int] -or $Value -is [long] -or $Value -is [decimal]) {
    try {
      $date = [datetime]::FromOADate([double]$Value)
      if ($date.Year -lt 2000 -or $date.Year -gt ((Get-Date).Year + 1)) { return 'null' }
      return "'" + $date.ToString('yyyy-MM-dd') + "'::date"
    } catch { return 'null' }
  }
  $text = ([string]$Value).Trim()
  if (-not $text) { return 'null' }
  $date = [datetime]::MinValue
  if ([datetime]::TryParse($text, [Globalization.CultureInfo]::GetCultureInfo('pt-BR'), [Globalization.DateTimeStyles]::None, [ref]$date)) {
    if ($date.Year -lt 2000 -or $date.Year -gt ((Get-Date).Year + 1)) { return 'null' }
    return "'" + $date.ToString('yyyy-MM-dd') + "'::date"
  }
  return 'null'
}

function MapStatus([string]$Status) {
  switch (($Status.Trim()).ToUpperInvariant()) {
    'NEGOCIANDO' { 'Em negociação' }
    'QUITADO' { 'Contrato quitado' }
    'MINUTA' { 'Minuta recebida' }
    'CANCELADO' { 'Cancelado' }
    'DISTRATO' { 'Cancelado' }
    'AÇÃO JUDICIAL' { 'Encaminhado ao Processual' }
    'RECUSA DE PAGAMENTO' { 'Negociação sem acordo' }
    'EM ABERTO' { 'Contato iniciado' }
    'PENDÊNCIA' { 'Aguardando retorno da instituição' }
    'ANTIGO' { 'Suspenso' }
    'APREENDIDO' { 'Suspenso' }
    'VENDIDO' { 'Suspenso' }
    default { 'Aguardando primeiro contato' }
  }
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$workbook = $null

try {
  $workbook = $excel.Workbooks.Open($WorkbookPath, 0, $true)
  $sheet = $workbook.Worksheets.Item('Base Consolidada')
  $used = $sheet.UsedRange
  $headers = @()
  for ($column = 1; $column -le 36; $column++) { $headers += [string]$sheet.Cells.Item(4, $column).Text }

  $rows = New-Object System.Collections.Generic.List[string]
  for ($row = 5; $row -le $used.Rows.Count; $row++) {
    $id = [string]$sheet.Cells.Item($row, 1).Text
    if ([string]::IsNullOrWhiteSpace($id)) { continue }

    $raw = [ordered]@{}
    for ($column = 1; $column -le 36; $column++) {
      $raw[$headers[$column - 1]] = [string]$sheet.Cells.Item($row, $column).Text
    }
    $rawJson = ($raw | ConvertTo-Json -Compress -Depth 4)
    $originalStatus = [string]$sheet.Cells.Item($row, 14).Text
    $observations = [string]$sheet.Cells.Item($row, 32).Text
    $different = [string]$sheet.Cells.Item($row, 36).Text
    $pending = @($observations, $(if ($different) { "Campos divergentes na origem: $different" })) | Where-Object { $_ }

    $values = @(
      (SqlText $id),
      (SqlText ([string]$sheet.Cells.Item($row, 2).Text)),
      (SqlText ([string]$sheet.Cells.Item($row, 3).Text)),
      (SqlText ([string]$sheet.Cells.Item($row, 4).Text)),
      (SqlText ([string]$sheet.Cells.Item($row, 11).Text)),
      (SqlText ([string]$sheet.Cells.Item($row, 7).Text)),
      (SqlText ([string]$sheet.Cells.Item($row, 30).Text)),
      (SqlText ([string]$sheet.Cells.Item($row, 8).Text)),
      (SqlText ([string]$sheet.Cells.Item($row, 9).Text)),
      (SqlText ([string]$sheet.Cells.Item($row, 10).Text)),
      (SqlInteger ([string]$sheet.Cells.Item($row, 25).Text)),
      (SqlNumber ([string]$sheet.Cells.Item($row, 20).Text)),
      (SqlNumber ([string]$sheet.Cells.Item($row, 18).Text)),
      (SqlNumber ([string]$sheet.Cells.Item($row, 22).Text)),
      (SqlText ([string]$sheet.Cells.Item($row, 31).Text)),
      (SqlDate $raw['Data de início']),
      (SqlText (MapStatus $originalStatus)),
      (SqlText ($pending -join "`n")),
      (SqlText $originalStatus),
      (SqlText ([string]$sheet.Cells.Item($row, 33).Text)),
      (SqlInteger ([string]$sheet.Cells.Item($row, 34).Text)),
      $(if (([string]$sheet.Cells.Item($row, 35).Text).Trim().ToUpperInvariant() -eq 'SIM') { 'true' } else { 'false' }),
      (SqlText $different),
      ((SqlText $rawJson) + '::jsonb')
    )
    $rows.Add('  (' + ($values -join ', ') + ')')
  }

  $sql = @"
-- Importacao idempotente de HOMOLOGACAO BACKUP.xlsx.
-- Gerado automaticamente; uma linha por caso consolidado.
begin;

alter table public.homologacoes
  alter column data_inicio drop not null,
  add column if not exists import_codigo text,
  add column if not exists status_origem text,
  add column if not exists fontes_importacao text,
  add column if not exists quantidade_registros_fonte integer,
  add column if not exists duplicidade_origem boolean not null default false,
  add column if not exists campos_divergentes text,
  add column if not exists dados_importados jsonb not null default '{}'::jsonb,
  add column if not exists valor_quitacao_hoje numeric(14,2),
  add column if not exists link_minuta_homologacao text;

create unique index if not exists homologacoes_import_codigo_uidx
  on public.homologacoes (import_codigo) where import_codigo is not null;

create table if not exists public.homologacao_atualizacoes_contrato (
  id uuid primary key default gen_random_uuid(),
  homologacao_id uuid not null references public.homologacoes(id) on delete cascade,
  data_atualizacao timestamptz not null default now(),
  saldo_devedor_atual numeric(14,2),
  parcelas_em_atraso integer,
  valor_quitacao_hoje numeric(14,2),
  percentual_desconto numeric(8,2),
  validade_proposta date,
  protocolo text,
  observacoes text,
  comprovante_url text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_nome text,
  created_at timestamptz not null default now()
);

alter table public.homologacao_atualizacoes_contrato enable row level security;
revoke all on public.homologacao_atualizacoes_contrato from anon;
grant select, insert, update, delete on public.homologacao_atualizacoes_contrato to authenticated;
drop policy if exists "Equipe gerencia homologacao_atualizacoes_contrato" on public.homologacao_atualizacoes_contrato;
create policy "Equipe gerencia homologacao_atualizacoes_contrato"
  on public.homologacao_atualizacoes_contrato for all to authenticated using (true) with check (true);
create index if not exists homologacao_atualizacoes_contrato_idx
  on public.homologacao_atualizacoes_contrato (homologacao_id, data_atualizacao desc);

insert into public.homologacoes (
  import_codigo, cliente_nome, cpf_cnpj, telefone, numero_contrato,
  instituicao_financeira, assessoria_banco, representante_contato, veiculo, placa,
  parcelas_atraso, saldo_devedor_atualizado, valor_previsto_minuta, valor_quitacao_hoje,
  negociador_responsavel, data_inicio, status, motivo_pendencia, status_origem,
  fontes_importacao, quantidade_registros_fonte, duplicidade_origem, campos_divergentes,
  dados_importados
)
values
$($rows -join ",`r`n")
on conflict (import_codigo) where import_codigo is not null do update set
  cliente_nome = excluded.cliente_nome,
  cpf_cnpj = excluded.cpf_cnpj,
  telefone = excluded.telefone,
  numero_contrato = excluded.numero_contrato,
  instituicao_financeira = excluded.instituicao_financeira,
  assessoria_banco = excluded.assessoria_banco,
  representante_contato = excluded.representante_contato,
  veiculo = excluded.veiculo,
  placa = excluded.placa,
  parcelas_atraso = excluded.parcelas_atraso,
  saldo_devedor_atualizado = excluded.saldo_devedor_atualizado,
  valor_previsto_minuta = excluded.valor_previsto_minuta,
  valor_quitacao_hoje = excluded.valor_quitacao_hoje,
  negociador_responsavel = excluded.negociador_responsavel,
  data_inicio = excluded.data_inicio,
  status = excluded.status,
  motivo_pendencia = excluded.motivo_pendencia,
  status_origem = excluded.status_origem,
  fontes_importacao = excluded.fontes_importacao,
  quantidade_registros_fonte = excluded.quantidade_registros_fonte,
  duplicidade_origem = excluded.duplicidade_origem,
  campos_divergentes = excluded.campos_divergentes,
  dados_importados = excluded.dados_importados;

update public.homologacoes
set data_inicio = to_date(dados_importados ->> 'Data de início', 'DD/MM/YYYY')
where import_codigo is not null
  and coalesce(dados_importados ->> 'Data de início', '') ~ '^\d{1,2}/\d{1,2}/\d{4}$';

update public.homologacoes set data_inicio = current_date where data_inicio is null;
alter table public.homologacoes alter column data_inicio set not null;

commit;
"@

  $absoluteOutput = [IO.Path]::GetFullPath($OutputPath)
  [IO.File]::WriteAllText($absoluteOutput, $sql, [Text.UTF8Encoding]::new($false))
  Write-Output "Gerados $($rows.Count) registros em $absoluteOutput"
}
finally {
  if ($workbook) { $workbook.Close($false) }
  $excel.Quit()
  if ($workbook) { [Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) | Out-Null }
  [Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
}
