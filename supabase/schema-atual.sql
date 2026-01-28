-- Schema atual do banco de dados Supabase
-- Este arquivo documenta a estrutura atual das tabelas conforme visualizado no Supabase
-- Última atualização: baseado no diagrama do Supabase

-- ============================================
-- TABELA: usuarios
-- ============================================
-- Descrição: Armazena dados dos usuários do sistema
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone_ia TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================
-- TABELA: whatsapp_instances
-- ============================================
-- Descrição: Armazena instâncias WhatsApp conectadas via Evolution API
CREATE TABLE IF NOT EXISTS whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  telefone TEXT NOT NULL UNIQUE,
  instance_name TEXT NOT NULL,
  evolution_api_instance_id TEXT NOT NULL,
  status TEXT NOT NULL,
  qr_code VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================
-- TABELA: clientes
-- ============================================
-- Descrição: Armazena dados dos clientes
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL UNIQUE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  foto_perfil VARCHAR, -- URL da foto de perfil do cliente
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================
-- TABELA: atendimentos_solicitado
-- ============================================
-- Descrição: Armazena os atendimentos solicitados pelos clientes
-- IMPORTANTE: Esta é a tabela principal usada para atualizar status dos atendimentos
CREATE TABLE IF NOT EXISTS atendimentos_solicitado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  whatsapp_instance_id UUID NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- Valores possíveis: 'aberto', 'em_andamento', 'encerrado'
  resumo_conversa VARCHAR, -- Nullable
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================
-- ÍNDICES
-- ============================================
-- Índices para melhorar performance das consultas

-- Índices para usuarios
CREATE INDEX IF NOT EXISTS idx_usuarios_id ON usuarios(id);

-- Índices para whatsapp_instances
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_usuario_id ON whatsapp_instances(usuario_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_telefone ON whatsapp_instances(telefone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_status ON whatsapp_instances(status);

-- Índices para clientes
CREATE INDEX IF NOT EXISTS idx_clientes_telefone ON clientes(telefone);
CREATE INDEX IF NOT EXISTS idx_clientes_usuario_id ON clientes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_clientes_created_at ON clientes(created_at DESC);

-- Índices para atendimentos_solicitado
CREATE INDEX IF NOT EXISTS idx_atendimentos_solicitado_status ON atendimentos_solicitado(status);
CREATE INDEX IF NOT EXISTS idx_atendimentos_solicitado_usuario_id ON atendimentos_solicitado(usuario_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_solicitado_cliente_id ON atendimentos_solicitado(cliente_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_solicitado_whatsapp_instance_id ON atendimentos_solicitado(whatsapp_instance_id);
CREATE INDEX IF NOT EXISTS idx_atendimentos_solicitado_created_at ON atendimentos_solicitado(created_at DESC);

-- ============================================
-- RELACIONAMENTOS
-- ============================================
-- 
-- atendimentos_solicitado.usuario_id -> usuarios.id
-- atendimentos_solicitado.whatsapp_instance_id -> whatsapp_instances.id
-- atendimentos_solicitado.cliente_id -> clientes.id
-- whatsapp_instances.usuario_id -> usuarios.id
-- clientes.usuario_id -> usuarios.id
-- usuarios.id -> auth.users.id (Supabase Auth)

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 
-- 1. A tabela principal para atualização de status é: atendimentos_solicitado
-- 2. O campo status aceita os valores: 'aberto', 'em_andamento', 'encerrado'
-- 3. Todas as tabelas têm campos created_at e updated_at para auditoria
-- 4. As foreign keys usam ON DELETE CASCADE para manter integridade referencial
-- 5. O campo resumo_conversa na tabela atendimentos_solicitado é nullable


