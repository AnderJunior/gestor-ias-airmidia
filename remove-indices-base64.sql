-- Script para remover índices problemáticos das colunas base64
-- Execute este script no SQL Editor do Supabase se você já executou o script anterior
-- e os índices foram criados

-- Remover índices se existirem (não causam erro se não existirem)
DROP INDEX IF EXISTS public.idx_mensagens_base64_audio;
DROP INDEX IF EXISTS public.idx_mensagens_base64_imagem;




