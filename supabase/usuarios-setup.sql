-- Script para criar apenas a tabela usuarios e suas configurações
-- Execute este script no SQL Editor do Supabase

-- 1. Criar tabela de usuários (dados iniciais do usuário)
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  telefone_ia TEXT, -- Telefone que a IA realizará atendimento
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_usuarios_id ON usuarios(id);

-- 3. Criar trigger para atualizar updated_at automaticamente
-- (Nota: Se a função update_updated_at_column já existir, este comando não causará erro)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Criar trigger para atualizar updated_at na tabela usuarios
DROP TRIGGER IF EXISTS update_usuarios_updated_at ON usuarios;
CREATE TRIGGER update_usuarios_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Habilitar Row Level Security (RLS)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- 6. Criar políticas RLS para usuarios
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







