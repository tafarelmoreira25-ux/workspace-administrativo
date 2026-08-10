# System Rules — Workspace Administrativo Platino

Estas regras são determinísticas e pertencem ao software e ao banco. A IA não pode substituí-las.

## Hierarquia de dados

`Cliente 1 → N Tratativas 1 → N Tarefas 1 → N Eventos/Documentos/Notificações`.

Uma tarefa nunca representa o cliente. Uma tratativa reúne tarefas de um mesmo objetivo operacional.

## Papéis

- Supervisores: Tafarel e Nicolas. Podem delegar, transferir, conferir, solicitar correção, cancelar e consultar toda a auditoria.
- Usuário da equipe: pode delegar uma tarefa para outro usuário; o sistema registra automaticamente sua identidade como solicitante.
- Executor: usuário designado. Pode aceitar, iniciar, aguardar informação, responder/devolver e devolver para conferência.
- Solicitante: autor da delegação. Recebe a devolutiva e as notificações de conferência.
- IA: auxilia preenchimento, classificação, resumo e detecção de inconsistências; nunca aceita evidência nem aprova conclusão.

## Campos obrigatórios

Cliente, tipo, título, solicitação, resultado esperado, setor solicitante, setor executor, responsável, prioridade e prazo com data/hora. `OUTROS` exige descrição específica.

## Máquina de estados

`RASCUNHO → DELEGADA → RECEBIDA → EM EXECUÇÃO → DEVOLVIDA PARA CONFERÊNCIA → CONCLUÍDA`.

Transições auxiliares:

- `RECEBIDA/EM EXECUÇÃO → AGUARDANDO INFORMAÇÃO → EM EXECUÇÃO`;
- `DELEGADA/RECEBIDA/EM EXECUÇÃO → DEVOLVIDA AO SOLICITANTE`;
- `DEVOLVIDA PARA CONFERÊNCIA → DEVOLVIDA PARA CORREÇÃO → EM EXECUÇÃO`;
- tarefa não concluída pode ser `BLOQUEADA` ou `CANCELADA` pela supervisão.

O executor nunca conclui diretamente. Ele devolve para conferência. Somente a aprovação humana da supervisão conclui.

## Aceite e execução

O aceite grava autor e horário. O início grava o primeiro horário de execução. Espera exige motivo com ao menos 10 caracteres e não apaga o prazo.

## Entrega e conferência

Para devolver para conferência, todos os critérios devem estar marcados, com devolutiva, arquivo no padrão `DATA_CLIENTE_TIPO_STATUS_RESPONSAVEL.extensão`, link do Drive, CRM e Planilha Geral confirmados.

O Workspace não recebe o PDF como anexo da tarefa. O executor salva o documento no Drive e cola o link compartilhável no campo próprio. Esse link é a evidência documental oficial da entrega.

A supervisão pode aprovar ou solicitar correção justificada. Depois de concluída, a tarefa é somente leitura para o executor.

## Prazo, prioridade e SLA

Prazo e prioridade são independentes. Prioridades: baixa, normal, alta e crítica. Cada tipo possui SLA padrão, mas toda delegação confirma uma data/hora limite. O sistema calcula normal, vence em 30 minutos e atrasada; atraso não apaga o status operacional.

## Auditoria e segurança

Criação, delegação, aceite, início, espera, devolução, correção, aprovação, cancelamento e mudança estrutural geram eventos append-only com autor e horário. Usuários comuns não possuem permissão de apagar ou alterar eventos.

## Notificações

Gerar notificação para nova tarefa, prazo próximo, atraso, devolução, conferência, correção e conclusão. Notificação não substitui o registro de auditoria.

## Regra documental

Contrato assinado é requisito para avançar do Comercial. Os cinco documentos iniciais são uma pendência controlada na esteira, não um bloqueio para criar a pasta do cliente.

## Arquivo morto

Distrato, desistência, fim de serviço ou encerramento exigem documentos finais, provas sociais, CRM e Planilha atualizados antes da movimentação para `02_ARQUIVO_MORTO`.
