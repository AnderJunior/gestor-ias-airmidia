-- Script para adicionar política RLS que permite administradores criarem instâncias WhatsApp para outros usuários
-- Execute este script no SQL Editor do Supabase

-- Verificar se a função is_admin() existe (criada em add-admin-fields.sql)
-- Se não existir, criar
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM usuarios 
    WHERE id = auth.uid() AND tipo = 'administracao'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar política para administradores criarem instâncias WhatsApp para qualquer usuário
DROP POLICY IF EXISTS "Administradores podem criar instâncias para qualquer usuário" ON whatsapp_instances;
CREATE POLICY "Administradores podem criar instâncias para qualquer usuário"
  ON whatsapp_instances FOR INSERT
  WITH CHECK (is_admin());

-- Criar política para administradores atualizarem instâncias de qualquer usuário
DROP POLICY IF EXISTS "Administradores podem atualizar instâncias de qualquer usuário" ON whatsapp_instances;
CREATE POLICY "Administradores podem atualizar instâncias de qualquer usuário"
  ON whatsapp_instances FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

