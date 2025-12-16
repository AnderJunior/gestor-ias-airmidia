# Documentação das Tabelas do Supabase

Este documento descreve todas as tabelas do banco de dados Supabase e seus relacionamentos.

## 📊 Diagrama de Relacionamentos

```
usuarios (1) ──┬──> (N) clientes
               ├──> (N) whatsapp_instances
               ├──> (N) atendimentos_solicitado
               └──> (N) agendamentos

clientes (1) ──┬──> (N) atendimentos_solicitado
               └──> (N) agendamentos

whatsapp_instances (1) ──> (N) atendimentos_solicitado
```

## 📋 Tabelas

### 1. `usuarios`

Armazena informações dos usuários do sistema.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID (PK) | Identificador único do usuário |
| `nome` | TEXT | Nome do usuário |
| `telefone_ia` | TEXT | Telefone da IA do usuário |
| `tipo_marcacao` | TEXT | Tipo de marcação: 'atendimento' ou 'agendamento' |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data da última atualização |

**Relacionamentos:**
- Um usuário pode ter múltiplos clientes
- Um usuário pode ter múltiplas instâncias WhatsApp
- Um usuário pode ter múltiplos atendimentos
- Um usuário pode ter múltiplos agendamentos

---

### 2. `clientes`

Armazena informações dos clientes.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID (PK) | Identificador único do cliente |
| `nome` | TEXT | Nome do cliente |
| `telefone` | TEXT | Telefone do cliente |
| `foto_perfil` | VARCHAR | URL ou caminho da foto de perfil |
| `usuario_id` | UUID (FK) | Referência ao usuário dono do cliente |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data da última atualização |

**Relacionamentos:**
- Pertence a um usuário (`usuario_id` -> `usuarios.id`)
- Pode ter múltiplos atendimentos
- Pode ter múltiplos agendamentos

---

### 3. `whatsapp_instances`

Armazena informações sobre instâncias do WhatsApp conectadas.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID (PK) | Identificador único da instância |
| `usuario_id` | UUID (FK) | Referência ao usuário dono da instância |
| `telefone` | TEXT | Telefone da instância WhatsApp |
| `instance_name` | TEXT | Nome da instância |
| `evolution_api_instance_id` | TEXT | ID da instância na Evolution API |
| `status` | TEXT | Status: 'conectado', 'desconectado', 'conectando', 'erro' |
| `qr_code` | VARCHAR | Código QR para conexão |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data da última atualização |

**Relacionamentos:**
- Pertence a um usuário (`usuario_id` -> `usuarios.id`)
- Pode ter múltiplos atendimentos

---

### 4. `atendimentos_solicitado`

Armazena solicitações de atendimento recebidas.

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

---

### 5. `agendamentos`

Armazena agendamentos feitos pela IA na agenda do usuário.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID (PK) | Identificador único do agendamento |
| `cliente_id` | UUID (FK) | Referência ao cliente |
| `usuario_id` | UUID (FK) | Referência ao usuário dono do agendamento |
| `data_e_hora` | TIMESTAMPTZ | Data e hora do agendamento |
| `resumo_conversa` | VARCHAR | Resumo da conversa que gerou o agendamento |
| `status` | TEXT | Status: 'agendado', 'confirmado', 'cancelado', 'concluido' |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data da última atualização |

**Relacionamentos:**
- Pertence a um cliente (`cliente_id` -> `clientes.id`)
- Pertence a um usuário (`usuario_id` -> `usuarios.id`)

---

## 🔄 Políticas RLS (Row Level Security)

Todas as tabelas devem ter políticas RLS configuradas para garantir que:
- Usuários só vejam seus próprios dados
- Usuários só possam criar/editar/deletar seus próprios registros

### Exemplo de Política para `agendamentos`:

```sql
-- Usuários podem ver seus próprios agendamentos
CREATE POLICY "Usuários podem ver seus próprios agendamentos"
ON agendamentos FOR SELECT
USING (auth.uid() = usuario_id);

-- Usuários podem criar seus próprios agendamentos
CREATE POLICY "Usuários podem criar seus próprios agendamentos"
ON agendamentos FOR INSERT
WITH CHECK (auth.uid() = usuario_id);

-- Usuários podem atualizar seus próprios agendamentos
CREATE POLICY "Usuários podem atualizar seus próprios agendamentos"
ON agendamentos FOR UPDATE
USING (auth.uid() = usuario_id);

-- Usuários podem deletar seus próprios agendamentos
CREATE POLICY "Usuários podem deletar seus próprios agendamentos"
ON agendamentos FOR DELETE
USING (auth.uid() = usuario_id);
```

---

## 🔔 Realtime

Todas as tabelas estão habilitadas para Realtime no Supabase:
- `usuarios`
- `clientes`
- `whatsapp_instances`
- `atendimentos_solicitado`
- `agendamentos`

Isso permite que a aplicação receba atualizações em tempo real quando dados são inseridos, atualizados ou deletados.

---

## 📝 Notas Importantes

1. **Foreign Keys**: Todas as foreign keys usam `ON DELETE CASCADE`, o que significa que quando um registro pai é deletado, todos os registros filhos também são deletados.

2. **Triggers**: Todas as tabelas têm um trigger que atualiza automaticamente o campo `updated_at` quando um registro é modificado.

3. **Índices**: Índices foram criados em campos frequentemente consultados para melhorar a performance das queries.

4. **Tipos de Status**: Os campos `status` usam CHECK constraints para garantir que apenas valores válidos sejam inseridos.

---

## 🚀 Scripts Relacionados

- `schema-completo-supabase.sql` - Script completo para criar todas as tabelas
- `enable-realtime.sql` - Script para habilitar Realtime nas tabelas
- `create-table-agendamentos.sql` - Script específico para criar a tabela de agendamentos

