-- Script para adicionar campo 'ativo' na tabela usuarios
-- Execute este script no SQL Editor do Supabase

-- 1. Adicionar campo 'ativo' na tabela usuarios
-- Valor padrão: true (todos os usuários existentes ficam ativos)
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;

-- 2. Criar índice para melhorar performance nas consultas por status ativo
CREATE INDEX IF NOT EXISTS idx_usuarios_ativo ON usuarios(ativo);

-- 3. Atualizar função getAllUsuarios para filtrar apenas clientes ativos
-- (Isso será feito no código da aplicação)

