-- Script para habilitar Realtime nas tabelas do Supabase
-- Execute este script no SQL Editor do Supabase para habilitar atualizações em tempo real

-- Habilitar Realtime na tabela usuarios
ALTER PUBLICATION supabase_realtime ADD TABLE usuarios;

-- Habilitar Realtime na tabela whatsapp_instances
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_instances;

-- Habilitar Realtime na tabela clientes
ALTER PUBLICATION supabase_realtime ADD TABLE clientes;

-- Habilitar Realtime na tabela atendimentos_solicitado (se existir)
-- Se a tabela se chama apenas "atendimentos", use: ALTER PUBLICATION supabase_realtime ADD TABLE atendimentos;
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'atendimentos_solicitado') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE atendimentos_solicitado;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'atendimentos') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE atendimentos;
  END IF;
END $$;

-- Habilitar Realtime na tabela mensagens
ALTER PUBLICATION supabase_realtime ADD TABLE mensagens;

-- Verificar se as tabelas foram adicionadas corretamente
SELECT 
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;







