-- Script para atualizar a constraint do campo tipo_marcacao
-- para permitir 'administracao' como valor válido
-- Execute este script no SQL Editor do Supabase

-- 1. Remover a constraint antiga
ALTER TABLE usuarios 
DROP CONSTRAINT IF EXISTS usuarios_tipo_marcacao_check;

-- 2. Adicionar nova constraint que permite 'administracao'
ALTER TABLE usuarios 
ADD CONSTRAINT usuarios_tipo_marcacao_check 
CHECK (tipo_marcacao IS NULL OR tipo_marcacao IN ('atendimento', 'agendamento', 'administracao'));

-- 3. Atualizar administradores existentes para ter tipo_marcacao = 'administracao'
UPDATE usuarios 
SET tipo_marcacao = 'administracao'
WHERE tipo = 'administracao' AND (tipo_marcacao IS NULL OR tipo_marcacao != 'administracao');
