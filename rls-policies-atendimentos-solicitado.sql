-- Script para criar políticas RLS (Row Level Security) para atendimentos_solicitado
-- Execute este script no SQL Editor do Supabase

-- 1. Habilitar Row Level Security (RLS) na tabela atendimentos_solicitado
ALTER TABLE atendimentos_solicitado ENABLE ROW LEVEL SECURITY;

-- 2. Criar políticas RLS para atendimentos_solicitado

-- Política para SELECT: Usuários podem ver seus próprios atendimentos
DROP POLICY IF EXISTS "Usuários podem ver seus próprios atendimentos solicitados" ON atendimentos_solicitado;
CREATE POLICY "Usuários podem ver seus próprios atendimentos solicitados"
  ON atendimentos_solicitado FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND atendimentos_solicitado.usuario_id = u.id
    )
  );

-- Política para INSERT: Usuários podem criar seus próprios atendimentos
DROP POLICY IF EXISTS "Usuários podem criar seus próprios atendimentos solicitados" ON atendimentos_solicitado;
CREATE POLICY "Usuários podem criar seus próprios atendimentos solicitados"
  ON atendimentos_solicitado FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND usuario_id = u.id
      AND EXISTS (
        SELECT 1 FROM whatsapp_instances wi
        WHERE wi.id = whatsapp_instance_id
        AND wi.usuario_id = u.id
      )
    )
  );

-- Política para UPDATE: Usuários podem atualizar seus próprios atendimentos
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios atendimentos solicitados" ON atendimentos_solicitado;
CREATE POLICY "Usuários podem atualizar seus próprios atendimentos solicitados"
  ON atendimentos_solicitado FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND atendimentos_solicitado.usuario_id = u.id
    )
  );

-- Política para DELETE: Usuários podem excluir seus próprios atendimentos
DROP POLICY IF EXISTS "Usuários podem excluir seus próprios atendimentos solicitados" ON atendimentos_solicitado;
CREATE POLICY "Usuários podem excluir seus próprios atendimentos solicitados"
  ON atendimentos_solicitado FOR DELETE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND atendimentos_solicitado.usuario_id = u.id
    )
  );

