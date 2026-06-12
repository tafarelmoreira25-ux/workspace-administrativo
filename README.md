# Workspace Administrativo Platino

## Como abrir o sistema

Este projeto usa React com Vite. A extensão **Go Live / Live Server** não
processa arquivos JSX e, por isso, não deve ser usada na pasta do código-fonte.

No terminal, dentro da pasta `tafa-performance`, execute:

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

## Permissão para concluir tarefas

O frontend confirma se o Supabase realmente atualizou a tarefa antes de mostrar
sucesso. Para permitir a persistência por funcionária, execute uma vez no SQL
Editor do Supabase o arquivo:

`supabase/corrigir_conclusao_tarefas.sql`

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
atualizado
