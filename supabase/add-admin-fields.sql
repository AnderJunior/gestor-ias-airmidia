-- Script para adicionar campos 'tipo' e 'fase' na tabela usuarios
-- Execute este script no SQL Editor do Supabase

-- 1. Adicionar campo 'tipo' na tabela usuarios
-- Valores possíveis: 'cliente', 'administracao'
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'cliente' CHECK (tipo IN ('cliente', 'administracao'));

-- 2. Adicionar campo 'fase' na tabela usuarios
-- Valores possíveis: 'teste', 'producao'
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS fase TEXT DEFAULT 'teste' CHECK (fase IN ('teste', 'producao'));

-- 3. Criar índice para melhorar performance nas consultas por tipo
CREATE INDEX IF NOT EXISTS idx_usuarios_tipo ON usuarios(tipo);
CREATE INDEX IF NOT EXISTS idx_usuarios_fase ON usuarios(fase);

-- 4. Atualizar políticas RLS para permitir que administradores vejam todos os usuários
-- Primeiro, criar uma função para verificar se o usuário é administrador
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM usuarios 
    WHERE id = auth.uid() AND tipo = 'administracao'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Criar política para administradores verem todos os usuários
DROP POLICY IF EXISTS "Administradores podem ver todos os usuários" ON usuarios;
CREATE POLICY "Administradores podem ver todos os usuários"
  ON usuarios FOR SELECT
  USING (is_admin() OR auth.uid() = id);

-- 6. Criar política para administradores atualizarem usuários (exceto outros administradores)
DROP POLICY IF EXISTS "Administradores podem atualizar usuários" ON usuarios;
CREATE POLICY "Administradores podem atualizar usuários"
  ON usuarios FOR UPDATE
  USING (
    is_admin() AND 
    (SELECT tipo FROM usuarios WHERE id = usuarios.id) != 'administracao'
  )
  WITH CHECK (
    is_admin() AND 
    (SELECT tipo FROM usuarios WHERE id = usuarios.id) != 'administracao'
  );

-- 7. Criar política para administradores verem todas as instâncias WhatsApp
DROP POLICY IF EXISTS "Administradores podem ver todas as instâncias" ON whatsapp_instances;
CREATE POLICY "Administradores podem ver todas as instâncias"
  ON whatsapp_instances FOR SELECT
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid() AND u.id = whatsapp_instances.usuario_id
    )
  );

-- 8. Criar política para administradores criarem novos usuários (clientes)
DROP POLICY IF EXISTS "Administradores podem criar usuários" ON usuarios;
CREATE POLICY "Administradores podem criar usuários"
  ON usuarios FOR INSERT
  WITH CHECK (is_admin());

