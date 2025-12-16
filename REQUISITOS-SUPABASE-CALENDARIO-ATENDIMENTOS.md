# Requisitos do Supabase para Calendário de Agendamentos

## 📋 Nova Tabela: `agendamentos`

A aba de calendário agora exibe **agendamentos feitos pela IA** na agenda do usuário, não mais atendimentos. É necessário criar uma nova tabela no Supabase.

## 🗄️ Estrutura da Tabela

### Script SQL Completo

Execute o arquivo `create-table-agendamentos.sql` no SQL Editor do Supabase para criar a tabela completa com:
- Estrutura da tabela
- Índices para performance
- Triggers para atualização automática
- Políticas RLS (Row Level Security)

### Campos da Tabela `agendamentos`

```sql
CREATE TABLE agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  data_e_hora TIMESTAMP WITH TIME ZONE NOT NULL,
  resumo_conversa VARCHAR,
  status TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'confirmado', 'cancelado', 'concluido')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

### Descrição dos Campos:

- **`id`** - Identificador único do agendamento (UUID)
- **`cliente_id`** - Referência ao cliente (FK para tabela `clientes`)
- **`usuario_id`** - Referência ao usuário dono do agendamento (FK para tabela `usuarios`)
- **`data_e_hora`** - Data e hora do agendamento (TIMESTAMP WITH TIME ZONE) - **Campo principal usado no calendário**
- **`resumo_conversa`** - Resumo da conversa que gerou o agendamento (VARCHAR, opcional)
- **`status`** - Status do agendamento:
  - `agendado` - Agendamento criado pela IA
  - `confirmado` - Agendamento confirmado pelo usuário
  - `cancelado` - Agendamento cancelado
  - `concluido` - Agendamento concluído
- **`created_at`** - Data de criação do registro
- **`updated_at`** - Data da última atualização (atualizado automaticamente via trigger)

## 🔍 Índices Criados

Para otimizar as consultas do calendário, os seguintes índices são criados:

```sql
-- Índice para buscar agendamentos por usuário
CREATE INDEX idx_agendamentos_usuario_id ON agendamentos(usuario_id);

-- Índice para buscar agendamentos por cliente
CREATE INDEX idx_agendamentos_cliente_id ON agendamentos(cliente_id);

-- Índice para ordenação por data e hora (usado no calendário)
CREATE INDEX idx_agendamentos_data_e_hora ON agendamentos(data_e_hora DESC);

-- Índice para filtrar por status
CREATE INDEX idx_agendamentos_status ON agendamentos(status);

-- Índice composto para consultas do calendário (usuario + data)
CREATE INDEX idx_agendamentos_usuario_data ON agendamentos(usuario_id, data_e_hora DESC);
```

## 🔐 Políticas RLS (Row Level Security)

As seguintes políticas são criadas para garantir segurança:

### SELECT
```sql
CREATE POLICY "Usuários podem ver seus próprios agendamentos"
ON agendamentos FOR SELECT
USING (usuario_id = auth.uid());
```

### INSERT
```sql
CREATE POLICY "Usuários podem criar seus próprios agendamentos"
ON agendamentos FOR INSERT
WITH CHECK (usuario_id = auth.uid());
```

### UPDATE
```sql
CREATE POLICY "Usuários podem atualizar seus próprios agendamentos"
ON agendamentos FOR UPDATE
USING (usuario_id = auth.uid());
```

### DELETE
```sql
CREATE POLICY "Usuários podem deletar seus próprios agendamentos"
ON agendamentos FOR DELETE
USING (usuario_id = auth.uid());
```

## 🔄 Relacionamentos

A tabela `agendamentos` se relaciona com:

- **`clientes`** - Via `cliente_id` (ON DELETE CASCADE)
- **`usuarios`** - Via `usuario_id` (ON DELETE CASCADE)

## 📊 Como os Dados são Usados no Calendário

### Visualização no Calendário:

1. **Data e Hora**: O campo `data_e_hora` é usado para posicionar o evento no calendário
2. **Cliente**: O nome do cliente é obtido via JOIN com a tabela `clientes`
3. **Status**: O status determina a cor do evento:
   - `agendado` → Azul (#3B82F6)
   - `confirmado` → Verde (#10B981)
   - `cancelado` → Vermelho (#EF4444)
   - `concluido` → Cinza (#6B7280)
4. **Resumo**: O campo `resumo_conversa` pode ser exibido em tooltips ou detalhes do evento

## 🚀 Como Criar a Tabela

### Opção 1: Executar Script Completo (Recomendado)

1. Abra o SQL Editor no Supabase
2. Copie e cole o conteúdo do arquivo `create-table-agendamentos.sql`
3. Execute o script

### Opção 2: Executar Manualmente

Execute os comandos na seguinte ordem:

1. Criar a tabela
2. Criar os índices
3. Criar os triggers
4. Habilitar RLS
5. Criar as políticas RLS

## 📝 Exemplo de Inserção de Dados

```sql
-- Exemplo de como a IA pode criar um agendamento
INSERT INTO agendamentos (
  cliente_id,
  usuario_id,
  data_e_hora,
  resumo_conversa,
  status
) VALUES (
  'uuid-do-cliente',
  'uuid-do-usuario',
  '2024-12-25 14:30:00+00',
  'Cliente solicitou agendamento para consulta sobre novo projeto',
  'agendado'
);
```

## 🔔 Realtime (Opcional)

O sistema já está configurado para escutar mudanças em tempo real na tabela `agendamentos` através do hook `useAgendamentos`. Isso significa que:

- Novos agendamentos aparecem automaticamente no calendário
- Atualizações de status são refletidas imediatamente
- Mudanças em dados do cliente são sincronizadas

## ✅ Checklist de Implementação

- [ ] Executar script `create-table-agendamentos.sql` no Supabase
- [ ] Verificar se os índices foram criados corretamente
- [ ] Verificar se as políticas RLS estão ativas
- [ ] Testar inserção de um agendamento de teste
- [ ] Verificar se o calendário está exibindo os agendamentos corretamente

## 📌 Notas Importantes

1. **Data e Hora**: O campo `data_e_hora` deve estar no formato ISO 8601 (TIMESTAMP WITH TIME ZONE)
2. **Cliente**: O `cliente_id` deve referenciar um cliente existente na tabela `clientes`
3. **Usuário**: O `usuario_id` deve referenciar um usuário existente na tabela `usuarios`
4. **Status Padrão**: Se não especificado, o status padrão é `'agendado'`
5. **Cascata**: Se um cliente ou usuário for deletado, os agendamentos relacionados também serão deletados (ON DELETE CASCADE)

## 🔧 Manutenção Futura

### Possíveis Melhorias:

1. **Campo `duracao`**: Adicionar campo para duração do agendamento em minutos
2. **Campo `notas`**: Adicionar campo para notas adicionais do usuário
3. **Campo `lembrete`**: Adicionar campo para configurar lembretes antes do agendamento
4. **View Materializada**: Criar view materializada para melhor performance em grandes volumes
5. **Índice GIN**: Criar índice GIN para busca full-text no campo `resumo_conversa`

## 📚 Referências

- Arquivo SQL: `create-table-agendamentos.sql`
- Hook: `src/hooks/useAgendamentos.ts`
- API: `src/lib/api/agendamentos.ts`
- Tipo TypeScript: `src/types/domain.ts` (interface `Agendamento`)
