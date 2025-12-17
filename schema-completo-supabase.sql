-- ============================================
-- SCHEMA COMPLETO DO SUPABASE
-- ============================================
-- Este arquivo documenta todas as tabelas do banco de dados
-- Baseado no diagrama do Supabase

-- ============================================
-- TABELA: usuarios
-- ============================================
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT,
  telefone_ia TEXT,
  tipo_marcacao TEXT CHECK (tipo_marcacao IN ('atendimento', 'agendamento')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para usuarios
CREATE INDEX IF NOT EXISTS idx_usuarios_tipo_marcacao ON usuarios(tipo_marcacao);

-- ============================================
-- TABELA: clientes
-- ============================================
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  foto_perfil VARCHAR,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para clientes
CREATE INDEX IF NOT EXISTS idx_clientes_usuario_id ON clientes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_clientes_telefone ON clientes(telefone);

-- ============================================
-- TABELA: whatsapp_instances
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  telefone TEXT NOT NULL,
  instance_name TEXT,
  evolution_api_instance_id TEXT,
  status TEXT NOT NULL DEFAULT 'desconectado' CHECK (status IN ('conectado', 'desconectado', 'conectando', 'erro')),
  qr_code VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para whatsapp_instances
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_usuario_id ON whatsapp_instances(usuario_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_status ON whatsapp_instances(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_telefone ON whatsapp_instances(telefone);

-- ============================================
-- TABELA: atendimentos_solicitado
-- ============================================
CREATE TABLE IF NOT EXISTS atendimentos_solicitado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  whatsapp_instance_id UUID NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  resumo_conversa VARCHAR,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_andamento', 'encerrado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para atendimentos_solicitado
CREATE INDEX IF NOT EXISTS idx_atendimentos_usuario_id ON atendimentos_solicitado(usuario_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_cliente_id ON atendimentos_solicitado(cliente_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_whatsapp_instance_id ON atendimentos_solicitado(whatsapp_instance_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_status ON atendimentos_solicitado(status);
CREATE INDEX IF NOT EXISTS idx_atendimentos_updated_at ON atendimentos_solicitado(updated_at DESC);

-- ============================================
-- TABELA: agendamentos
-- ============================================
CREATE TABLE IF NOT EXISTS agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  data_e_hora TIMESTAMPTZ NOT NULL,
  resumo_conversa VARCHAR,
  status TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'confirmado', 'cancelado', 'concluido')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para agendamentos
CREATE INDEX IF NOT EXISTS idx_agendamentos_usuario_id ON agendamentos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_cliente_id ON agendamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data_e_hora ON agendamentos(data_e_hora DESC);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON agendamentos(status);
CREATE INDEX IF NOT EXISTS idx_agendamentos_usuario_data ON agendamentos(usuario_id, data_e_hora DESC);

-- ============================================
-- TRIGGERS PARA updated_at
-- ============================================
-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para cada tabela
CREATE TRIGGER update_usuarios_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whatsapp_instances_updated_at
  BEFORE UPDATE ON whatsapp_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_atendimentos_solicitado_updated_at
  BEFORE UPDATE ON atendimentos_solicitado
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agendamentos_updated_at
  BEFORE UPDATE ON agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HABILITAR REALTIME
-- ============================================
-- Habilitar Realtime nas tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE usuarios;
ALTER PUBLICATION supabase_realtime ADD TABLE clientes;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_instances;
ALTER PUBLICATION supabase_realtime ADD TABLE atendimentos_solicitado;
ALTER PUBLICATION supabase_realtime ADD TABLE agendamentos;

-- ============================================
-- RELACIONAMENTOS
-- ============================================
-- usuarios (1) -> (N) clientes
-- usuarios (1) -> (N) whatsapp_instances
-- usuarios (1) -> (N) atendimentos_solicitado
-- usuarios (1) -> (N) agendamentos
-- clientes (1) -> (N) atendimentos_solicitado
-- clientes (1) -> (N) agendamentos
-- whatsapp_instances (1) -> (N) atendimentos_solicitado

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================
-- Verificar se as tabelas foram criadas corretamente
SELECT 
  schemaname,
  tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('usuarios', 'clientes', 'whatsapp_instances', 'atendimentos_solicitado', 'agendamentos')
ORDER BY tablename;

-- Verificar se o realtime está habilitado
SELECT 
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;


