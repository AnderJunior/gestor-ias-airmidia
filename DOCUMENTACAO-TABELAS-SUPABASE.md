# Documentação das Tabelas do Supabase

Este documento descreve todas as tabelas do banco de dados Supabase e seus relacionamentos, refletindo o estado atual do sistema.

**Última atualização:** Fevereiro 2026

---

## 📊 Diagrama de Relacionamentos

```
auth.users (1) ──> (1) usuarios

usuarios (1) ──┬──> (N) clientes
               ├──> (N) whatsapp_instances
               ├──> (N) atendimentos_solicitado
               ├──> (N) agendamentos
               ├──> (N) webhooks_apis
               ├──> (N) tarefas (via cliente_id = dono da tarefa)
               └──> (N) usuarios_fase_historico

clientes (1) ──┬──> (N) atendimentos_solicitado
               └──> (N) agendamentos

whatsapp_instances (1) ──> (N) atendimentos_solicitado

atendimentos_solicitado (1) ──> (N) mensagens

kanban_colunas ── (tabela global, gerenciada por admins)
```

---

## 📋 Tabelas

### 1. `usuarios`

Armazena informações dos usuários do sistema (integração com Supabase Auth).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID (PK) | Identificador único, referência a `auth.users.id` |
| `nome` | TEXT | Nome do usuário |
| `telefone_ia` | TEXT | Telefone da IA do usuário |
| `tipo_marcacao` | TEXT | Tipo de marcação: 'atendimento', 'agendamento' ou 'administracao' |
| `tipo` | TEXT | Tipo de usuário: 'cliente' ou 'administracao' |
| `fase` | TEXT | Fase do cliente: 'teste', 'producao' ou valor de `kanban_colunas` |
| `ativo` | BOOLEAN | Se o usuário está ativo (default: true) |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data da última atualização |
| `admin_responsavel` | UUID | Ligação com id de usuarios para atrellar o responsavel do clinte |

**Relacionamentos:**
- Pertence a `auth.users` (ON DELETE CASCADE)
- Um usuário pode ter múltiplos clientes
- Um usuário pode ter múltiplas instâncias WhatsApp
- Um usuário pode ter múltiplos atendimentos
- Um usuário pode ter múltiplos agendamentos
- Um usuário pode ter múltiplos webhooks
- Um usuário pode ter múltiplas tarefas (como dono)

---

### 2. `clientes`

Armazena informações dos clientes (contatos do WhatsApp).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID (PK) | Identificador único do cliente |
| `nome` | TEXT | Nome do cliente |
| `telefone` | TEXT | Telefone do cliente (UNIQUE) |
| `foto_perfil` | VARCHAR | URL ou caminho da foto de perfil |
| `usuario_id` | UUID (FK) | Referência ao usuário dono (pode ser NULL se admin excluído) |
| `atendimento_atual` | TEXT | Tipo de atendimento atual: 'ia', 'humano' ou 'pausa' |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data da última atualização |

**Relacionamentos:**
- Pertence a um usuário (`usuario_id` -> `usuarios.id`)
- Pode ter múltiplos atendimentos
- Pode ter múltiplos agendamentos

---

### 3. `whatsapp_instances`

Armazena informações sobre instâncias do WhatsApp conectadas via Evolution API.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID (PK) | Identificador único da instância |
| `usuario_id` | UUID (FK) | Referência ao usuário dono da instância |
| `telefone` | TEXT | Telefone da instância WhatsApp (UNIQUE) |
| `instance_name` | TEXT | Nome da instância |
| `evolution_api_instance_id` | TEXT | ID da instância na Evolution API |
| `status` | TEXT | Status: 'conectado', 'desconectado', 'conectando', 'erro' |
| `qr_code` | VARCHAR/TEXT | Código QR para conexão |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data da última atualização |

**Relacionamentos:**
- Pertence a um usuário (`usuario_id` -> `usuarios.id`)
- Pode ter múltiplos atendimentos

---

### 4. `atendimentos_solicitado`

Armazena solicitações de atendimento recebidas dos clientes.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID (PK) | Identificador único do atendimento |
| `usuario_id` | UUID (FK) | Referência ao usuário |
| `cliente_id` | UUID (FK) | Referência ao cliente |
| `whatsapp_instance_id` | UUID (FK) | Referência à instância WhatsApp |
| `resumo_conversa` | VARCHAR | Resumo da conversa |
| `status` | TEXT | Status: 'aberto', 'em_andamento', 'encerrado' |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data da última atualização |

**Relacionamentos:**
- Pertence a um usuário (`usuario_id` -> `usuarios.id`)
- Pertence a um cliente (`cliente_id` -> `clientes.id`)
- Pertence a uma instância WhatsApp (`whatsapp_instance_id` -> `whatsapp_instances.id`)
- Pode ter múltiplas mensagens

---

### 5. `mensagens`

Armazena as mensagens trocadas nas conversas. Pode estar ligada a `atendimento_id` (atendimentos_solicitado) ou diretamente a `cliente_id` e `usuario_id`.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID (PK) | Identificador único da mensagem |
| `atendimento_id` | UUID (FK) | Referência ao atendimento (quando via atendimentos_solicitado) |
| `cliente_id` | UUID (FK) | Referência ao cliente (quando busca direta) |
| `usuario_id` | UUID (FK) | Referência ao usuário (quando busca direta) |
| `conteudo` | TEXT | Conteúdo da mensagem |
| `tipo` | TEXT | Tipo: 'humano' ou 'bot' |
| `telefone_remetente` | TEXT | Número que enviou |
| `telefone_destinatario` | TEXT | Número que recebeu |
| `message_id` | TEXT | ID da mensagem na Evolution API |
| `data_e_hora` | TIMESTAMPTZ | Data e hora da mensagem |
| `base64_audio` | TEXT | Base64 do áudio (opcional) |
| `base64_imagem` | TEXT | Base64 da imagem (opcional) |
| `created_at` | TIMESTAMPTZ | Data de criação |

**Nota:** A estrutura pode variar conforme a evolução do schema. Alguns cenários usam `cliente_id`/`usuario_id` diretamente, outros usam `atendimento_id` referenciando `atendimentos_solicitado`.

---

### 6. `agendamentos`

Armazena agendamentos feitos pela IA na agenda do usuário.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID (PK) | Identificador único do agendamento |
| `cliente_id` | UUID (FK) | Referência ao cliente |
| `usuario_id` | UUID (FK) | Referência ao usuário dono do agendamento |
| `data_e_hora` | TIMESTAMPTZ | Data e hora do agendamento |
| `resumo_conversa` | VARCHAR | Resumo da conversa que gerou o agendamento |
| `link_agendamento` | VARCHAR | Link da reunião/agendamento (opcional) |
| `status` | TEXT | Status: 'agendado', 'confirmado', 'cancelado', 'concluido' |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data da última atualização |

**Relacionamentos:**
- Pertence a um cliente (`cliente_id` -> `clientes.id`)
- Pertence a um usuário (`usuario_id` -> `usuarios.id`)

---

### 7. `tarefas`

Armazena tarefas vinculadas aos usuários (clientes da plataforma).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID (PK) | Identificador único da tarefa |
| `cliente_id` | UUID (FK) | Referência ao usuário dono da tarefa (`usuarios.id`) |
| `nome` | TEXT | Nome da tarefa |
| `status` | TEXT | Status: 'pendente', 'em_andamento', 'concluida', 'cancelada' |
| `data_vencimento` | TIMESTAMPTZ | Data de vencimento |
| `responsavel_id` | UUID (FK) | Referência ao responsável (`usuarios.id`) |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data da última atualização |

**Relacionamentos:**
- Pertence a um usuário como dono (`cliente_id` -> `usuarios.id`)
- Responsável opcional (`responsavel_id` -> `usuarios.id`)

---

### 8. `webhooks_apis`

Armazena configurações de webhooks/APIs acionados em ações do sistema.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID (PK) | Identificador único |
| `usuario_id` | UUID (FK) | Referência ao usuário |
| `nome` | TEXT | Nome do webhook |
| `webhook_url` | TEXT | URL do webhook |
| `acoes` | JSONB | Ações configuradas (tarefas, clientes, agendamentos, atendimentos) |
| `ativo` | BOOLEAN | Se o webhook está ativo |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data da última atualização |

**Estrutura do campo `acoes`:**
```json
{
  "tarefas": ["criar", "atualizar", "excluir", "concluir"],
  "clientes": ["criar", "atualizar", "excluir"],
  "agendamentos": ["criar", "atualizar", "excluir", "confirmar", "cancelar"],
  "atendimentos": ["criar", "atualizar", "excluir", "atualizar_status"]
}
```

---

### 9. `kanban_colunas`

Armazena as colunas do Kanban na área administrativa (fases dos clientes). Compartilhada entre administradores.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | TEXT (PK) | Identificador único (usado como valor em `usuarios.fase`) |
| `name` | TEXT | Nome da coluna |
| `color` | TEXT | Cor da coluna |
| `ordem` | INT | Ordem de exibição |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data da última atualização |

**Nota:** Apenas administradores podem gerenciar. O `usuarios.fase` pode receber valores customizados das colunas do Kanban.

---

### 10. `usuarios_fase_historico`

Armazena o histórico de permanência dos clientes por etapa no Kanban.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID (PK) | Identificador único do histórico |
| `usuario_id` | UUID (FK) | Referência ao cliente da plataforma (`usuarios.id`) |
| `fase_id` | TEXT | Identificador da etapa (mesmo valor usado em `usuarios.fase`) |
| `entrou_em` | TIMESTAMPTZ | Data e hora de entrada na etapa |
| `alterado_por` | UUID (FK) | Usuário que realizou a alteração da etapa |
| `created_at` | TIMESTAMPTZ | Data de criação do registro |

**Regras importantes:**
- Cada mudança de fase gera um novo registro (histórico de eventos)
- O campo `entrou_em` representa o momento da troca para a fase registrada

**Relacionamentos:**
- `usuario_id` -> `usuarios.id` (ON DELETE CASCADE)
- `alterado_por` -> `usuarios.id` (ON DELETE SET NULL)

---


## 🔄 Políticas RLS (Row Level Security)

Todas as tabelas têm RLS habilitado. Em geral:
- **Usuários comuns:** veem e editam apenas seus próprios dados
- **Administradores (`tipo = 'administracao'`):** podem ver e gerenciar dados de todos os usuários (com restrições em certas tabelas)

No caso da tabela `usuarios_fase_historico`:
- Apenas usuários com `tipo = 'administracao'` podem fazer `SELECT`
- Não há políticas de `INSERT/UPDATE/DELETE` para usuários autenticados comuns


**Função auxiliar:** `is_admin()` retorna true se o usuário atual tem `tipo = 'administracao'` em `usuarios`.

---

## 🔔 Realtime

Tabelas habilitadas para Realtime:
- `usuarios`
- `clientes`
- `whatsapp_instances`
- `atendimentos_solicitado`
- `agendamentos`
- `mensagens`

---

## 📝 Notas Importantes

1. **Foreign Keys:** A maioria usa `ON DELETE CASCADE`. Para exclusão de administradores, a função `atualizar_foreign_keys_antes_excluir_admin()` atualiza FKs para NULL antes da exclusão.

2. **Triggers:** Todas as tabelas têm trigger para atualizar `updated_at` automaticamente.

3. **Índices:** Existem índices em campos frequentemente consultados (status, usuario_id, cliente_id, datas, etc.).

4. **Tabela `atendimentos`:** O sistema evoluiu para `atendimentos_solicitado`. A tabela `atendimentos` pode existir em instalações antigas; a principal em uso é `atendimentos_solicitado`.

---

## 🚀 Scripts Relacionados

| Script | Descrição |
|--------|-----------|
| `schema-completo-supabase.sql` | Schema base das tabelas principais |
| `schema-atual.sql` | Schema documentado a partir do Supabase |
| `add-admin-fields.sql` | Campos tipo, fase e políticas de admin |
| `add-campo-ativo.sql` | Campo ativo em usuarios |
| `add-atendimento-atual-column.sql` | Campo atendimento_atual em clientes |
| `add-link-agendamento-column.sql` | Campo link_agendamento em agendamentos |
| `add-base64-mensagens.sql` | Campos base64 em mensagens |
| `update-tipo-marcacao-admin.sql` | Inclusão de 'administracao' em tipo_marcacao |
| `create-table-tarefas.sql` | Criação da tabela tarefas |
| `create-table-kanban-colunas.sql` | Criação da tabela kanban_colunas |
| `create-table-usuarios-fase-historico.sql` | Criação da tabela usuarios_fase_historico e RLS de leitura para administradores |
| `create-table-webhooks-apis.sql` | Criação da tabela webhooks_apis |
| `enable-realtime.sql` | Habilita Realtime nas tabelas |
| `update-foreign-keys-on-admin-delete.sql` | Função para exclusão de admins |
