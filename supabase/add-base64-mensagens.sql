-- Script para adicionar suporte a base64 de áudio e imagens na tabela mensagens
-- Execute este script no SQL Editor do Supabase

-- Adicionar colunas para base64 de áudio e imagens
ALTER TABLE public.mensagens 
ADD COLUMN IF NOT EXISTS base64_audio TEXT NULL,
ADD COLUMN IF NOT EXISTS base64_imagem TEXT NULL;

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.mensagens.base64_audio IS 'Base64 do áudio da mensagem (opcional)';
COMMENT ON COLUMN public.mensagens.base64_imagem IS 'Base64 da imagem da mensagem (opcional)';

-- NOTA: Não criamos índices nessas colunas porque:
-- 1. Elas podem conter dados muito grandes (base64 de áudio/imagem)
-- 2. O PostgreSQL tem limite de 8191 bytes para linhas em índices
-- 3. Índices em colunas TEXT grandes não são eficientes e causam erros

