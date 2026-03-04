-- Migration: Adicionar campo api_envio_mensagens na tabela usuarios
-- Define qual API usar para envio de mensagens WhatsApp: z_api (AIR Mídia) ou twilio (Oficial)

ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS api_envio_mensagens TEXT DEFAULT 'twilio' 
CHECK (api_envio_mensagens IN ('z_api', 'twilio'));

COMMENT ON COLUMN usuarios.api_envio_mensagens IS 'API para envio de mensagens: z_api (AIR Mídia/Z-API) ou twilio (Oficial)';
