-- Script de migração simplificado
-- Apenas cria a tabela clientes e altera as colunas de atendimentos

-- 1. Dropar a view e políticas que dependem das colunas antigas
DROP VIEW IF EXISTS atendimentos_com_ultima_mensagem;
DROP POLICY IF EXISTS "Usuários podem ver atendimentos do seu telefone" ON atendimentos;
DROP POLICY IF EXISTS "Usuários podem criar atendimentos do seu telefone" ON atendimentos;
DROP POLICY IF EXISTS "Usuários podem atualizar atendimentos do seu telefone" ON atendimentos;
DROP POLICY IF EXISTS "Usuários podem ver mensagens dos seus atendimentos" ON mensagens;
DROP POLICY IF EXISTS "Usuários podem criar mensagens nos seus atendimentos" ON mensagens;

-- 2. Criar tabela de clientes
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT,
  telefone TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Migrar dados: criar clientes a partir dos dados existentes
INSERT INTO clientes (nome, telefone, created_at, updated_at)
SELECT DISTINCT 
  cliente_nome,
  telefone_cliente,
  MIN(created_at) as created_at,
  MAX(updated_at) as updated_at
FROM atendimentos
WHERE telefone_cliente IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM clientes WHERE clientes.telefone = atendimentos.telefone_cliente
  )
GROUP BY cliente_nome, telefone_cliente;

-- 4. Adicionar coluna whatsapp_instance_id se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'atendimentos' AND column_name = 'whatsapp_instance_id'
  ) THEN
    ALTER TABLE atendimentos ADD COLUMN whatsapp_instance_id UUID;
  END IF;
END $$;

-- 5. Preencher whatsapp_instance_id baseado no telefone_usuario
UPDATE atendimentos a
SET whatsapp_instance_id = (
  SELECT wi.id 
  FROM whatsapp_instances wi 
  WHERE wi.telefone = a.telefone_usuario 
  LIMIT 1
)
WHERE a.whatsapp_instance_id IS NULL
  AND a.telefone_usuario IS NOT NULL;

-- 6. Converter cliente_id de TEXT para UUID
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'atendimentos' 
    AND column_name = 'cliente_id' 
    AND data_type = 'text'
  ) THEN
    -- Criar coluna temporária
    ALTER TABLE atendimentos ADD COLUMN cliente_id_new UUID;
    
    -- Migrar dados
    UPDATE atendimentos a
    SET cliente_id_new = (
      SELECT c.id
      FROM clientes c
      WHERE c.telefone = a.telefone_cliente
      LIMIT 1
    );
    
    -- Remover coluna antiga e renomear nova
    ALTER TABLE atendimentos DROP COLUMN cliente_id CASCADE;
    ALTER TABLE atendimentos RENAME COLUMN cliente_id_new TO cliente_id;
    
    -- Adicionar constraint NOT NULL e FK
    ALTER TABLE atendimentos ALTER COLUMN cliente_id SET NOT NULL;
    ALTER TABLE atendimentos ADD CONSTRAINT atendimentos_cliente_id_fkey 
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 7. Adicionar FK para whatsapp_instance_id e tornar NOT NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'atendimentos' AND column_name = 'whatsapp_instance_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'atendimentos_whatsapp_instance_id_fkey'
    ) THEN
      ALTER TABLE atendimentos 
      ADD CONSTRAINT atendimentos_whatsapp_instance_id_fkey 
      FOREIGN KEY (whatsapp_instance_id) REFERENCES whatsapp_instances(id) ON DELETE CASCADE;
    END IF;
    
    ALTER TABLE atendimentos ALTER COLUMN whatsapp_instance_id SET NOT NULL;
  END IF;
END $$;

-- 8. Remover colunas antigas
ALTER TABLE atendimentos DROP COLUMN IF EXISTS cliente_nome CASCADE;
ALTER TABLE atendimentos DROP COLUMN IF EXISTS telefone_cliente CASCADE;
ALTER TABLE atendimentos DROP COLUMN IF EXISTS telefone_usuario CASCADE;

-- 9. Recriar a view
CREATE VIEW atendimentos_com_ultima_mensagem AS
SELECT 
  a.*,
  c.nome AS cliente_nome,
  c.telefone AS telefone_cliente,
  wi.telefone AS telefone_usuario,
  m.conteudo AS ultima_mensagem,
  m.created_at AS ultima_mensagem_at
FROM atendimentos a
LEFT JOIN clientes c ON c.id = a.cliente_id
LEFT JOIN whatsapp_instances wi ON wi.id = a.whatsapp_instance_id
LEFT JOIN LATERAL (
  SELECT conteudo, created_at
  FROM mensagens
  WHERE atendimento_id = a.id
  ORDER BY created_at DESC
  LIMIT 1
) m ON true;
