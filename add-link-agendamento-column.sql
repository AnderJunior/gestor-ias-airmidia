-- ============================================
-- ADICIONAR COLUNA link_agendamento NA TABELA agendamentos
-- ============================================
-- Este script adiciona a coluna link_agendamento na tabela agendamentos
-- caso ela ainda não exista

-- Verificar se a coluna já existe antes de adicionar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'agendamentos' 
    AND column_name = 'link_agendamento'
  ) THEN
    ALTER TABLE agendamentos 
    ADD COLUMN link_agendamento VARCHAR;
    
    COMMENT ON COLUMN agendamentos.link_agendamento IS 'Link da reunião/agendamento (opcional)';
  END IF;
END $$;

-- Verificar se a coluna foi adicionada
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'agendamentos'
  AND column_name = 'link_agendamento';


