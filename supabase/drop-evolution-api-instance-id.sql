-- Remove coluna evolution_api_instance_id (migração para Z-API)
ALTER TABLE whatsapp_instances DROP COLUMN IF EXISTS evolution_api_instance_id;
