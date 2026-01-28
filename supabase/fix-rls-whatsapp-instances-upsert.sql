-- Script para corrigir políticas RLS da tabela whatsapp_instances
-- Permite que usuários criem e atualizem suas próprias instâncias via UPSERT
-- Execute este script no SQL Editor do Supabase

-- 1. Remover políticas antigas que podem estar causando conflito
DROP POLICY IF EXISTS "Usuários podem criar suas próprias instâncias" ON whatsapp_instances;
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias instâncias" ON whatsapp_instances;

-- 2. Criar política de INSERT simplificada que permite criar instâncias quando usuario_id = auth.uid()
-- Removendo a verificação EXISTS que pode estar causando problemas
CREATE POLICY "Usuários podem criar suas próprias instâncias"
  ON whatsapp_instances FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    auth.uid() = usuario_id
  );

-- 3. Criar política de UPDATE simplificada que permite atualizar instâncias próprias
CREATE POLICY "Usuários podem atualizar suas próprias instâncias"
  ON whatsapp_instances FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    auth.uid() = usuario_id
  )
  WITH CHECK (
    auth.role() = 'authenticated' AND
    auth.uid() = usuario_id
  );

-- 4. Atualizar política de SELECT para ser mais simples também
DROP POLICY IF EXISTS "Usuários podem ver suas próprias instâncias" ON whatsapp_instances;
CREATE POLICY "Usuários podem ver suas próprias instâncias"
  ON whatsapp_instances FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    auth.uid() = usuario_id
  );
