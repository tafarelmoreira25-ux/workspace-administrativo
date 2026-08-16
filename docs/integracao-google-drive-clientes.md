# Integração dos clientes com o Google Drive

## Estrutura validada em 16/08/2026

- Pasta raiz: `PLATINO - CLIENTES`
- ID da pasta raiz: `1uP4IVec5rAeda_OzQRQTpBXuVsw6aNLy`
- Clientes ativos: `01_CLIENTES_ATIVOS`
- ID dos clientes ativos: `1y2DtlTHz8LipsbzzJCLVmhrS30TWsOw7`
- Arquivo morto geral: `02_ARQUIVO_MORTO_GERAL` (sem itens visíveis)
- Arquivo antigo: `99_ARQUIVO_ANTIGO`, separado em `2024`, `2025` e `2026`

A primeira versão sincroniza somente `01_CLIENTES_ATIVOS`. As pastas históricas continuam no Drive e não aparecem como opções na delegação de novas tarefas.

## Segurança

A pasta deve permanecer com acesso restrito às contas autorizadas da equipe. A integração não altera nem amplia as permissões existentes. Para funcionar, inclua também o e-mail da conta de serviço entre as contas autorizadas da pasta `01_CLIENTES_ATIVOS`.

Antes da ativação, confirme em **Compartilhar > Acesso geral** que a opção exibida é **Restrito**. Não é necessário habilitar “Qualquer pessoa com o link”.

O sistema não lê nem copia os documentos. Ele consulta somente os metadados das pastas: ID, nome, link e data de modificação.

## Configuração do Google Cloud

1. Crie ou selecione um projeto no Google Cloud da empresa.
2. Ative a **Google Drive API**.
3. Crie uma conta de serviço exclusiva para o Platino Workspace.
4. Gere uma chave JSON para essa conta.
5. Compartilhe `01_CLIENTES_ATIVOS` com o e-mail `client_email` da conta de serviço, inicialmente como leitor.
6. Guarde o `client_email` e o `private_key`. Não envie a chave pelo chat e não coloque o arquivo JSON no GitHub.

## Supabase

Execute no SQL Editor, nesta ordem:

1. `clientes_cadastro_drive_2026.sql`, caso ainda não tenha sido executado.
2. `google_drive_clientes_2026.sql`.

Depois, em **Edge Functions > Secrets**, cadastre:

- `GOOGLE_SERVICE_ACCOUNT_JSON`: conteúdo completo do arquivo JSON baixado do Google Cloud.
- `GOOGLE_DRIVE_CLIENTS_FOLDER_ID`: `1y2DtlTHz8LipsbzzJCLVmhrS30TWsOw7`.

Não envie o JSON por e-mail, chat ou GitHub. Depois de confirmar a integração, mantenha uma cópia em local seguro ou em um gerenciador corporativo de segredos.

Faça o deploy da função:

```bash
supabase functions deploy sincronizar-clientes-drive
```

## Vercel

Nenhuma credencial do Google deve ser criada na Vercel nem em variável `VITE_*`. Basta publicar novamente o frontend depois das alterações. A chamada ao Google é feita exclusivamente pela Edge Function do Supabase.

## Operação

O gestor abre **Clientes** e clica em **Atualizar do Google Drive**. A sincronização:

- cria o índice de novas pastas;
- atualiza nomes de pastas renomeadas;
- mantém o vínculo pelo ID permanente do Drive;
- marca como ausente uma pasta que saiu da área de ativos;
- não exclui clientes nem históricos.
