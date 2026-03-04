-- Migration: Adicionar colunas Z-API na tabela whatsapp_instances
-- Para migração de Evolution API para Z-API

ALTER TABLE whatsapp_instances 
ADD COLUMN IF NOT EXISTS z_api_instance_id TEXT,
ADD COLUMN IF NOT EXISTS z_api_token TEXT;
