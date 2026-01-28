-- ============================================
-- SCRIPT PARA CRIAR TABELA DE WEBHOOKS/APIS
-- ============================================
-- Este script cria a tabela para armazenar configurações de webhooks
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- ============================================
-- TABELA: webhooks_apis
-- ============================================
-- Descrição: Armazena configurações de webhooks/APIs que serão acionados em ações do sistema
CREATE TABLE IF NOT EXISTS webhooks_apis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  acoes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_webhooks_apis_usuario_id ON webhooks_apis(usuario_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_apis_ativo ON webhooks_apis(ativo);
CREATE INDEX IF NOT EXISTS idx_webhooks_apis_created_at ON webhooks_apis(created_at DESC);

-- ============================================
-- TRIGGER PARA ATUALIZAR updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_webhooks_apis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_webhooks_apis_updated_at ON webhooks_apis;
CREATE TRIGGER update_webhooks_apis_updated_at
  BEFORE UPDATE ON webhooks_apis
  FOR EACH ROW
  EXECUTE FUNCTION update_webhooks_apis_updated_at();

-- ============================================
-- HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE webhooks_apis ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS RLS PARA webhooks_apis
-- ============================================

-- Usuários podem ver apenas seus próprios webhooks
CREATE POLICY "Usuários veem apenas seus próprios webhooks"
  ON webhooks_apis FOR SELECT
  USING (usuario_id = (SELECT auth.uid()));

-- Usuários podem criar webhooks para si mesmos
CREATE POLICY "Usuários criam webhooks para si mesmos"
  ON webhooks_apis FOR INSERT
  WITH CHECK (usuario_id = (SELECT auth.uid()));

-- Usuários podem atualizar apenas seus próprios webhooks
CREATE POLICY "Usuários atualizam seus próprios webhooks"
  ON webhooks_apis FOR UPDATE
  USING (usuario_id = (SELECT auth.uid()))
  WITH CHECK (usuario_id = (SELECT auth.uid()));

-- Usuários podem excluir apenas seus próprios webhooks
CREATE POLICY "Usuários excluem apenas seus próprios webhooks"
  ON webhooks_apis FOR DELETE
  USING (usuario_id = (SELECT auth.uid()));

-- ============================================
-- COMENTÁRIOS SOBRE A ESTRUTURA JSONB
-- ============================================
-- O campo 'acoes' é um JSONB que armazena as ações selecionadas
-- Estrutura esperada:
-- {
--   "tarefas": ["criar", "atualizar", "excluir", "concluir"],
--   "clientes": ["criar", "atualizar", "excluir"],
--   "agendamentos": ["criar", "atualizar", "excluir", "confirmar", "cancelar"],
--   "atendimentos": ["criar", "atualizar", "excluir", "atualizar_status"]
-- }
