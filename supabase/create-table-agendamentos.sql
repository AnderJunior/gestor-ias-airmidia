-- Script para criar tabela de agendamentos
-- Execute este script no SQL Editor do Supabase

-- ============================================
-- TABELA: agendamentos
-- ============================================
-- Descrição: Armazena agendamentos feitos pela IA na agenda do usuário
CREATE TABLE IF NOT EXISTS agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  data_e_hora TIMESTAMP WITH TIME ZONE NOT NULL,
  resumo_conversa VARCHAR,
  status TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'confirmado', 'cancelado', 'concluido')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================
-- ÍNDICES
-- ============================================
-- Índices para melhorar performance das consultas

-- Índice para buscar agendamentos por usuário
CREATE INDEX IF NOT EXISTS idx_agendamentos_usuario_id ON agendamentos(usuario_id);

-- Índice para buscar agendamentos por cliente
CREATE INDEX IF NOT EXISTS idx_agendamentos_cliente_id ON agendamentos(cliente_id);

-- Índice para ordenação por data e hora (usado no calendário)
CREATE INDEX IF NOT EXISTS idx_agendamentos_data_e_hora ON agendamentos(data_e_hora DESC);

-- Índice para filtrar por status
CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON agendamentos(status);

-- Índice composto para consultas do calendário (usuario + data)
CREATE INDEX IF NOT EXISTS idx_agendamentos_usuario_data ON agendamentos(usuario_id, data_e_hora DESC);

-- ============================================
-- TRIGGERS
-- ============================================
-- Trigger para atualizar updated_at automaticamente

-- Criar função se não existir
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_agendamentos_updated_at ON agendamentos;
CREATE TRIGGER update_agendamentos_updated_at
  BEFORE UPDATE ON agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
-- Habilitar RLS na tabela
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

-- Política para SELECT (usuários veem apenas seus agendamentos)
DROP POLICY IF EXISTS "Usuários podem ver seus próprios agendamentos" ON agendamentos;
CREATE POLICY "Usuários podem ver seus próprios agendamentos"
ON agendamentos
FOR SELECT
USING (usuario_id = auth.uid());

-- Política para INSERT (usuários podem criar agendamentos para si mesmos)
DROP POLICY IF EXISTS "Usuários podem criar seus próprios agendamentos" ON agendamentos;
CREATE POLICY "Usuários podem criar seus próprios agendamentos"
ON agendamentos
FOR INSERT
WITH CHECK (usuario_id = auth.uid());

-- Política para UPDATE (usuários podem atualizar seus próprios agendamentos)
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios agendamentos" ON agendamentos;
CREATE POLICY "Usuários podem atualizar seus próprios agendamentos"
ON agendamentos
FOR UPDATE
USING (usuario_id = auth.uid());

-- Política para DELETE (usuários podem deletar seus próprios agendamentos)
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios agendamentos" ON agendamentos;
CREATE POLICY "Usuários podem deletar seus próprios agendamentos"
ON agendamentos
FOR DELETE
USING (usuario_id = auth.uid());

-- ============================================
-- COMENTÁRIOS
-- ============================================
COMMENT ON TABLE agendamentos IS 'Armazena agendamentos feitos pela IA na agenda do usuário';
COMMENT ON COLUMN agendamentos.cliente_id IS 'ID do cliente relacionado ao agendamento';
COMMENT ON COLUMN agendamentos.usuario_id IS 'ID do usuário dono do agendamento';
COMMENT ON COLUMN agendamentos.data_e_hora IS 'Data e hora do agendamento';
COMMENT ON COLUMN agendamentos.resumo_conversa IS 'Resumo da conversa que gerou o agendamento';
COMMENT ON COLUMN agendamentos.status IS 'Status do agendamento: agendado, confirmado, cancelado, concluido';

