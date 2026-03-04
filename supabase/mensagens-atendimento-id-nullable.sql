-- Permite salvar mensagens enviadas via Twilio mesmo sem atendimento_solicitado.
-- Execute no SQL Editor do Supabase se o insert falhar com erro de atendimento_id.
-- Opcional: só necessário se sua tabela mensagens tiver atendimento_id NOT NULL.

ALTER TABLE public.mensagens
  ALTER COLUMN atendimento_id DROP NOT NULL;
