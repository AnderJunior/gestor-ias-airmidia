-- ============================================
-- SCRIPT PARA CRIAR TABELA DE TAREFAS
-- ============================================
-- Este script cria a tabela de tarefas vinculadas aos clientes
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- ============================================
-- TABELA: tarefas
-- ============================================
-- Descrição: Armazena tarefas vinculadas aos clientes
CREATE TABLE IF NOT EXISTS tarefas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  data_vencimento TIMESTAMP WITH TIME ZONE,
  responsavel_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tarefas_cliente_id ON tarefas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_status ON tarefas(status);
CREATE INDEX IF NOT EXISTS idx_tarefas_responsavel_id ON tarefas(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_data_vencimento ON tarefas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_tarefas_created_at ON tarefas(created_at DESC);

-- ============================================
-- TRIGGER PARA ATUALIZAR updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_tarefas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tarefas_updated_at ON tarefas;
CREATE TRIGGER update_tarefas_updated_at
  BEFORE UPDATE ON tarefas
  FOR EACH ROW
  EXECUTE FUNCTION update_tarefas_updated_at();

-- ============================================
-- HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE tarefas ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS RLS PARA tarefas
-- ============================================

-- Administradores podem ver todas as tarefas
-- Usuários podem ver tarefas de seus próprios clientes
CREATE POLICY "Administradores veem todas as tarefas ou usuários veem tarefas de seus clientes"
  ON tarefas FOR SELECT
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (select auth.uid()) 
      AND u.id = tarefas.cliente_id
    )
  );

-- Administradores podem criar tarefas para qualquer cliente
-- Usuários podem criar tarefas apenas para seus próprios clientes
CREATE POLICY "Administradores criam tarefas para qualquer cliente ou usuários criam para seus clientes"
  ON tarefas FOR INSERT
  WITH CHECK (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (select auth.uid()) 
      AND u.id = tarefas.cliente_id
    )
  );

-- Administradores podem atualizar qualquer tarefa
-- Usuários podem atualizar tarefas de seus próprios clientes
CREATE POLICY "Administradores atualizam qualquer tarefa ou usuários atualizam tarefas de seus clientes"
  ON tarefas FOR UPDATE
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (select auth.uid()) 
      AND u.id = tarefas.cliente_id
    )
  )
  WITH CHECK (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (select auth.uid()) 
      AND u.id = tarefas.cliente_id
    )
  );

-- Administradores podem excluir qualquer tarefa
-- Usuários podem excluir tarefas de seus próprios clientes
CREATE POLICY "Administradores excluem qualquer tarefa ou usuários excluem tarefas de seus clientes"
  ON tarefas FOR DELETE
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (select auth.uid()) 
      AND u.id = tarefas.cliente_id
    )
  );

-- ============================================
-- HABILITAR REALTIME (OPCIONAL)
-- ============================================
-- Descomente as linhas abaixo se quiser habilitar realtime para tarefas
-- ALTER PUBLICATION supabase_realtime ADD TABLE tarefas;
