-- Script para criar todas as políticas RLS (Row Level Security)
-- Execute este script após a migração

-- 1. Habilitar Row Level Security (RLS) em todas as tabelas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens ENABLE ROW LEVEL SECURITY;

-- 2. Criar políticas RLS para usuarios
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

-- 3. Criar políticas RLS para whatsapp_instances
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

-- 4. Criar políticas RLS para clientes
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

DROP POLICY IF EXISTS "Usuários podem criar clientes" ON clientes;
CREATE POLICY "Usuários podem criar clientes"
  ON clientes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

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

-- 5. Criar políticas RLS para atendimentos
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

-- 6. Criar políticas RLS para mensagens
-- Estrutura: cliente_id (uuid), usuario_id (uuid), mensagem_usuario (varchar), mensagem_cliente (varchar)
DROP POLICY IF EXISTS "Usuários podem ver mensagens relacionadas a eles" ON mensagens;
CREATE POLICY "Usuários podem ver mensagens relacionadas a eles"
  ON mensagens FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        -- Mensagens onde o usuário é o usuario_id
        mensagens.usuario_id = u.id
        OR
        -- Mensagens de clientes dos atendimentos_solicitado do usuário
        EXISTS (
          SELECT 1 FROM atendimentos_solicitado a
          WHERE a.cliente_id = mensagens.cliente_id
          AND a.usuario_id = u.id
        )
      )
    )
  );

DROP POLICY IF EXISTS "Usuários podem criar mensagens como usuario_id" ON mensagens;
CREATE POLICY "Usuários podem criar mensagens como usuario_id"
  ON mensagens FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND usuario_id = u.id
      -- Verificar se o cliente_id pertence a um atendimento_solicitado do usuário
      AND EXISTS (
        SELECT 1 FROM atendimentos_solicitado a
        WHERE a.cliente_id = mensagens.cliente_id
        AND a.usuario_id = u.id
      )
    )
  );

DROP POLICY IF EXISTS "Usuários podem atualizar mensagens onde são usuario_id" ON mensagens;
CREATE POLICY "Usuários podem atualizar mensagens onde são usuario_id"
  ON mensagens FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND mensagens.usuario_id = u.id
    )
  );

