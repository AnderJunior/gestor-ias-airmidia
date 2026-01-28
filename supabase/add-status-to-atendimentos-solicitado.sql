-- Adicionar campo status à tabela atendimentos_solicitado
-- Execute este script no SQL Editor do Supabase

-- Verificar se a coluna status já existe e adicionar se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'atendimentos_solicitado' AND column_name = 'status'
  ) THEN
    -- Adicionar coluna status
    ALTER TABLE atendimentos_solicitado 
    ADD COLUMN status TEXT NOT NULL DEFAULT 'aberto' 
    CHECK (status IN ('aberto', 'em_andamento', 'encerrado'));
    
    -- Criar índice para melhor performance
    CREATE INDEX IF NOT EXISTS idx_atendimentos_solicitado_status 
    ON atendimentos_solicitado(status);
    
    RAISE NOTICE 'Coluna status adicionada à tabela atendimentos_solicitado';
  ELSE
    RAISE NOTICE 'Coluna status já existe na tabela atendimentos_solicitado';
  END IF;
END $$;







