-- Script de configuração do banco de dados Supabase
-- Execute este script no SQL Editor do Supabase

-- 0. Criar tabela de usuários (dados iniciais do usuário)
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  telefone_ia TEXT, -- Telefone que a IA realizará atendimento
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 0.1. Criar tabela de conexões WhatsApp (usuários e seus números conectados via Evolution API)
CREATE TABLE IF NOT EXISTS whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  telefone TEXT NOT NULL UNIQUE, -- Número do telefone conectado (ex: 5511999999999)
  instance_name TEXT, -- Nome da instância na Evolution API (opcional)
  evolution_api_instance_id TEXT, -- ID da instância na Evolution API
  status TEXT NOT NULL DEFAULT 'desconectado' CHECK (status IN ('conectado', 'desconectado', 'conectando', 'erro')),
  qr_code TEXT, -- QR Code para conexão (temporário)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 0.2. Criar tabela de clientes
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT,
  telefone TEXT NOT NULL UNIQUE, -- Número do telefone do cliente
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1. Criar tabela de atendimentos
CREATE TABLE IF NOT EXISTS atendimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE, -- Referência ao cliente
  whatsapp_instance_id UUID NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE, -- Instância WhatsApp usada no atendimento
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE, -- Referência ao usuário do sistema
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_andamento', 'encerrado')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar tabela de mensagens
CREATE TABLE IF NOT EXISTS mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id UUID NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('humano', 'bot')),
  telefone_remetente TEXT NOT NULL, -- Número que enviou a mensagem
  telefone_destinatario TEXT NOT NULL, -- Número que recebeu a mensagem
  message_id TEXT, -- ID da mensagem na Evolution API (opcional)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_usuarios_id ON usuarios(id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_usuario_id ON whatsapp_instances(usuario_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_telefone ON whatsapp_instances(telefone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_status ON whatsapp_instances(status);

CREATE INDEX IF NOT EXISTS idx_clientes_telefone ON clientes(telefone);
CREATE INDEX IF NOT EXISTS idx_clientes_created_at ON clientes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_atendimentos_status ON atendimentos(status);
CREATE INDEX IF NOT EXISTS idx_atendimentos_created_at ON atendimentos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_atendimentos_cliente_id ON atendimentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_whatsapp_instance_id ON atendimentos(whatsapp_instance_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_usuario_id ON atendimentos(usuario_id);

CREATE INDEX IF NOT EXISTS idx_mensagens_atendimento_id ON mensagens(atendimento_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_created_at ON mensagens(created_at);
CREATE INDEX IF NOT EXISTS idx_mensagens_telefone_remetente ON mensagens(telefone_remetente);
CREATE INDEX IF NOT EXISTS idx_mensagens_telefone_destinatario ON mensagens(telefone_destinatario);

-- 4. Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Criar trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_usuarios_updated_at ON usuarios;
CREATE TRIGGER update_usuarios_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clientes_updated_at ON clientes;
CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_atendimentos_updated_at ON atendimentos;
CREATE TRIGGER update_atendimentos_updated_at
  BEFORE UPDATE ON atendimentos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. Habilitar Row Level Security (RLS)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens ENABLE ROW LEVEL SECURITY;

-- 7. Criar políticas RLS para usuarios
DROP POLICY IF EXISTS "Usuários podem ver seus próprios dados" ON usuarios;
CREATE POLICY "Usuários podem ver seus próprios dados"
  ON usuarios FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Usuários podem criar seus próprios dados" ON usuarios;
CREATE POLICY "Usuários podem criar seus próprios dados"
  ON usuarios FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios dados" ON usuarios;
CREATE POLICY "Usuários podem atualizar seus próprios dados"
  ON usuarios FOR UPDATE
  USING (auth.uid() = id);

-- 8. Criar políticas RLS para whatsapp_instances
-- Usuários podem ver instâncias onde usuario_id corresponde ao seu id na tabela usuarios
DROP POLICY IF EXISTS "Usuários podem ver suas próprias instâncias" ON whatsapp_instances;
CREATE POLICY "Usuários podem ver suas próprias instâncias"
  ON whatsapp_instances FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid() AND u.id = whatsapp_instances.usuario_id
    )
  );

DROP POLICY IF EXISTS "Usuários podem criar suas próprias instâncias" ON whatsapp_instances;
CREATE POLICY "Usuários podem criar suas próprias instâncias"
  ON whatsapp_instances FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid() AND u.id = usuario_id
    )
  );

DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias instâncias" ON whatsapp_instances;
CREATE POLICY "Usuários podem atualizar suas próprias instâncias"
  ON whatsapp_instances FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid() AND u.id = whatsapp_instances.usuario_id
    )
  );

-- 8.1. Criar políticas RLS para clientes
-- Usuários podem ver clientes dos seus atendimentos
DROP POLICY IF EXISTS "Usuários podem ver clientes dos seus atendimentos" ON clientes;
CREATE POLICY "Usuários podem ver clientes dos seus atendimentos"
  ON clientes FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM atendimentos a
        WHERE a.cliente_id = clientes.id
        AND a.usuario_id = u.id
      )
    )
  );

-- Usuários podem criar clientes (quando criando atendimentos)
DROP POLICY IF EXISTS "Usuários podem criar clientes" ON clientes;
CREATE POLICY "Usuários podem criar clientes"
  ON clientes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Usuários podem atualizar clientes dos seus atendimentos
DROP POLICY IF EXISTS "Usuários podem atualizar clientes dos seus atendimentos" ON clientes;
CREATE POLICY "Usuários podem atualizar clientes dos seus atendimentos"
  ON clientes FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM atendimentos a
        WHERE a.cliente_id = clientes.id
        AND a.usuario_id = u.id
      )
    )
  );

-- 9. Criar políticas RLS para atendimentos
-- Usuários podem ver seus próprios atendimentos
DROP POLICY IF EXISTS "Usuários podem ver seus próprios atendimentos" ON atendimentos;
CREATE POLICY "Usuários podem ver seus próprios atendimentos"
  ON atendimentos FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND atendimentos.usuario_id = u.id
    )
  );

DROP POLICY IF EXISTS "Usuários podem criar seus próprios atendimentos" ON atendimentos;
CREATE POLICY "Usuários podem criar seus próprios atendimentos"
  ON atendimentos FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND usuario_id = u.id
      AND EXISTS (
        SELECT 1 FROM whatsapp_instances wi
        WHERE wi.id = whatsapp_instance_id
        AND wi.usuario_id = u.id
      )
    )
  );

DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios atendimentos" ON atendimentos;
CREATE POLICY "Usuários podem atualizar seus próprios atendimentos"
  ON atendimentos FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND atendimentos.usuario_id = u.id
    )
  );

-- 10. Criar políticas RLS para mensagens
-- Usuários podem ver mensagens dos seus atendimentos
DROP POLICY IF EXISTS "Usuários podem ver mensagens dos seus atendimentos" ON mensagens;
CREATE POLICY "Usuários podem ver mensagens dos seus atendimentos"
  ON mensagens FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM atendimentos a
        WHERE a.id = mensagens.atendimento_id
        AND a.usuario_id = u.id
      )
    )
  );

DROP POLICY IF EXISTS "Usuários podem criar mensagens nos seus atendimentos" ON mensagens;
CREATE POLICY "Usuários podem criar mensagens nos seus atendimentos"
  ON mensagens FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM atendimentos a
        WHERE a.id = mensagens.atendimento_id
        AND a.usuario_id = u.id
      )
    )
  );

-- 11. Criar função para identificar usuário pelo telefone
-- Retorna o usuario_id (da tabela usuarios) baseado no telefone
CREATE OR REPLACE FUNCTION get_usuario_by_telefone(telefone_param TEXT)
RETURNS UUID AS $$
DECLARE
  usuario_id_result UUID;
BEGIN
  SELECT wi.usuario_id INTO usuario_id_result
  FROM whatsapp_instances wi
  WHERE wi.telefone = telefone_param
  AND wi.status = 'conectado'
  LIMIT 1;
  
  RETURN usuario_id_result;
END;
$$ LANGUAGE plpgsql;

-- 11.1. Criar função para criar ou buscar cliente pelo telefone
CREATE OR REPLACE FUNCTION upsert_cliente(
  telefone_param TEXT,
  nome_param TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  cliente_id_result UUID;
BEGIN
  INSERT INTO clientes (telefone, nome)
  VALUES (telefone_param, nome_param)
  ON CONFLICT (telefone) 
  DO UPDATE SET
    nome = COALESCE(EXCLUDED.nome, clientes.nome),
    updated_at = NOW()
  RETURNING id INTO cliente_id_result;
  
  RETURN cliente_id_result;
END;
$$ LANGUAGE plpgsql;

-- 12. Criar função para criar ou atualizar instância WhatsApp
CREATE OR REPLACE FUNCTION upsert_whatsapp_instance(
  telefone_param TEXT,
  instance_name_param TEXT DEFAULT NULL,
  evolution_api_instance_id_param TEXT DEFAULT NULL,
  status_param TEXT DEFAULT 'desconectado'
)
RETURNS UUID AS $$
DECLARE
  instance_id_result UUID;
  current_usuario_id UUID;
BEGIN
  -- Obter o usuario_id da tabela usuarios baseado no auth.uid()
  SELECT id INTO current_usuario_id
  FROM usuarios
  WHERE id = auth.uid();
  
  -- Se o usuário não existir na tabela usuarios, criar
  IF current_usuario_id IS NULL THEN
    INSERT INTO usuarios (id) VALUES (auth.uid())
    ON CONFLICT (id) DO NOTHING
    RETURNING id INTO current_usuario_id;
    current_usuario_id := auth.uid();
  END IF;
  
  INSERT INTO whatsapp_instances (usuario_id, telefone, instance_name, evolution_api_instance_id, status)
  VALUES (current_usuario_id, telefone_param, instance_name_param, evolution_api_instance_id_param, status_param)
  ON CONFLICT (telefone) 
  DO UPDATE SET
    instance_name = COALESCE(EXCLUDED.instance_name, whatsapp_instances.instance_name),
    evolution_api_instance_id = COALESCE(EXCLUDED.evolution_api_instance_id, whatsapp_instances.evolution_api_instance_id),
    status = EXCLUDED.status,
    updated_at = NOW()
  RETURNING id INTO instance_id_result;
  
  RETURN instance_id_result;
END;
$$ LANGUAGE plpgsql;

-- 13. Criar view para facilitar consultas de atendimentos com última mensagem
CREATE OR REPLACE VIEW atendimentos_com_ultima_mensagem AS
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

-- 14. Criar trigger para atualizar updated_at em whatsapp_instances
DROP TRIGGER IF EXISTS update_whatsapp_instances_updated_at ON whatsapp_instances;
CREATE TRIGGER update_whatsapp_instances_updated_at
  BEFORE UPDATE ON whatsapp_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 15. Inserir dados de exemplo (opcional - para testes)
-- Descomente as linhas abaixo se quiser dados de exemplo
-- NOTA: Você precisará ter um usuário criado primeiro e substituir o UUID do usuario_id

/*
-- Primeiro, crie uma instância WhatsApp (substitua o UUID do usuário)
INSERT INTO whatsapp_instances (usuario_id, telefone, instance_name, status) VALUES
  ('SEU_UUID_USUARIO_AQUI', '5511999999999', 'Instância Principal', 'conectado');

-- Depois, crie clientes
INSERT INTO clientes (nome, telefone) VALUES
  ('João Silva', '5511888888888'),
  ('Maria Santos', '5511777777777');

-- Depois, crie atendimentos (substitua os UUIDs pelos valores reais)
INSERT INTO atendimentos (cliente_id, whatsapp_instance_id, usuario_id, status) VALUES
  ((SELECT id FROM clientes WHERE telefone = '5511888888888' LIMIT 1), 
   (SELECT id FROM whatsapp_instances WHERE telefone = '5511999999999' LIMIT 1),
   'SEU_UUID_USUARIO_AQUI', 'aberto'),
  ((SELECT id FROM clientes WHERE telefone = '5511777777777' LIMIT 1),
   (SELECT id FROM whatsapp_instances WHERE telefone = '5511999999999' LIMIT 1),
   'SEU_UUID_USUARIO_AQUI', 'em_andamento');

INSERT INTO mensagens (atendimento_id, conteudo, tipo, telefone_remetente, telefone_destinatario) VALUES
  ((SELECT id FROM atendimentos LIMIT 1), 'Olá, preciso de ajuda', 'humano', '5511888888888', '5511999999999'),
  ((SELECT id FROM atendimentos LIMIT 1), 'Claro, como posso ajudar?', 'bot', '5511999999999', '5511888888888');
*/

