-- Script para corrigir políticas RLS de clientes
-- Permite que usuários vejam todos os seus próprios clientes diretamente pelo usuario_id
-- Execute este script no SQL Editor do Supabase

-- Adicionar política adicional para permitir ver clientes pelo usuario_id
DROP POLICY IF EXISTS "Usuários podem ver seus próprios clientes" ON clientes;
CREATE POLICY "Usuários podem ver seus próprios clientes"
  ON clientes FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND clientes.usuario_id = u.id
    )
  );

-- Atualizar política de UPDATE para permitir atualizar clientes próprios pelo usuario_id
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios clientes" ON clientes;
CREATE POLICY "Usuários podem atualizar seus próprios clientes"
  ON clientes FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND clientes.usuario_id = u.id
    )
  );

