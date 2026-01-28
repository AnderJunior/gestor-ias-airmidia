-- Adicionar coluna atendimento_atual na tabela clientes
-- Esta coluna armazena o tipo de atendimento atual para cada cliente: 'ia', 'humano' ou 'pausa'

ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS atendimento_atual TEXT DEFAULT 'ia' CHECK (atendimento_atual IN ('ia', 'humano', 'pausa'));

-- Comentário na coluna
COMMENT ON COLUMN clientes.atendimento_atual IS 'Tipo de atendimento atual para este cliente: ia (robô ativo), humano (humano assumiu), pausa (atendimento pausado)';

-- Criar índice para melhorar performance nas consultas
CREATE INDEX IF NOT EXISTS idx_clientes_atendimento_atual ON clientes(atendimento_atual);
