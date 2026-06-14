# Workspace Administrativo Platino

## Como abrir o sistema

Este projeto usa React com Vite. A extensão **Go Live / Live Server** não
processa JSX e não deve ser usada para abrir o código-fonte.

No terminal, dentro da pasta interna `tafa-performance`, execute:

```bash
npm install
npm start
```

Abra o endereço exibido pelo terminal, normalmente `http://localhost:5173`.

Para testar a versão final:

```bash
npm run build
npm run preview
```

## Configuração do Supabase

Execute uma vez no SQL Editor do Supabase:

`supabase/configurar_sistema.sql`

Depois, no menu **Authentication > Users**, crie três usuários:

- O supervisor com o e-mail `tafarel@platino.com`.
- As duas colaboradoras com os mesmos e-mails cadastrados na tabela
  `funcionarios`.

Cadastre também as duas colaboradoras na tabela `funcionarios`. Exemplo:

```sql
insert into public.funcionarios (nome, email, cargo)
values
  ('NOME DA COLABORADORA 1', 'email1@empresa.com', 'Administrativo'),
  ('NOME DA COLABORADORA 2', 'email2@empresa.com', 'Jurídico')
on conflict (email) do update
set nome = excluded.nome, cargo = excluded.cargo;
```

O script configura as permissões para o supervisor delegar tarefas e enviar
feedbacks profissionais. Cada colaboradora consulta somente as próprias
tarefas, os feedbacks destinados ao seu cadastro e as responsabilidades fixas
do mês. No acesso do supervisor, a área **Tarefas do Mês** permite substituir,
reordenar ou remover a lista mensal de cada colaboradora.

## Documentos PDF padrão

1. Converta o documento oficial para PDF mantendo logotipo e textos fixos.
2. Coloque o arquivo em `public/modelos`.
3. Cadastre os campos e coordenadas em
   `src/config/documentTemplates.js`.

O sistema também aceita PDFs com campos de formulário. Nesse caso, configure
`campoFormulario` em vez das coordenadas.

O modelo original da procuração está arquivado em:

`modelos-originais/procuracao-dra-juliane.docx`

## Segurança

O arquivo `.env` local não deve ser enviado ao Git. O projeto contém um
`.env.example` apenas com os nomes das configurações necessárias.
