-- ============================================
-- HISTORICO DE FASE DOS CLIENTES (KANBAN)
-- ============================================
-- Objetivo:
-- 1) Criar tabela de histórico de permanência por etapa (usuarios_fase_historico)
-- 2) Aplicar índices essenciais
-- 3) Habilitar RLS com leitura apenas para administradores
--
-- Execute este script no SQL Editor do Supabase.

-- ============================================
-- 1) TABELA
-- ============================================
CREATE TABLE IF NOT EXISTS usuarios_fase_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  fase_id TEXT NOT NULL,
  entrou_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  alterado_por UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE usuarios_fase_historico IS
  'Histórico de permanência dos clientes por etapa do Kanban.';
COMMENT ON COLUMN usuarios_fase_historico.usuario_id IS
  'ID do cliente (usuarios.id) que ficou na etapa.';
COMMENT ON COLUMN usuarios_fase_historico.fase_id IS
  'ID da etapa (valor salvo em usuarios.fase / kanban_colunas.id).';
COMMENT ON COLUMN usuarios_fase_historico.entrou_em IS
  'Data/hora de entrada do cliente na etapa.';
COMMENT ON COLUMN usuarios_fase_historico.alterado_por IS
  'Usuário (normalmente administrador) que realizou a mudança.';

-- ============================================
-- 2) INDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_usuarios_fase_historico_usuario_id
  ON usuarios_fase_historico(usuario_id);

CREATE INDEX IF NOT EXISTS idx_usuarios_fase_historico_fase_id
  ON usuarios_fase_historico(fase_id);

CREATE INDEX IF NOT EXISTS idx_usuarios_fase_historico_usuario_entrou_em
  ON usuarios_fase_historico(usuario_id, entrou_em DESC);

CREATE INDEX IF NOT EXISTS idx_usuarios_fase_historico_usuario_fase_entrou_em
  ON usuarios_fase_historico(usuario_id, fase_id, entrou_em DESC);

-- ============================================
-- 3) RLS (SOMENTE ADM PODE VISUALIZAR)
-- ============================================
ALTER TABLE usuarios_fase_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Apenas administradores podem visualizar historico de fases" ON usuarios_fase_historico;
CREATE POLICY "Apenas administradores podem visualizar historico de fases"
  ON usuarios_fase_historico
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM usuarios adm
      WHERE adm.id = (SELECT auth.uid())
        AND adm.tipo = 'administracao'
    )
  );

-- Sem políticas de INSERT/UPDATE/DELETE para usuários autenticados.
-- Escrita deve ocorrer via backend com service role.
