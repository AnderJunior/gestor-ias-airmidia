-- Tabela para persistir as colunas do Kanban (fases).
-- Todas as colunas são criadas pelo usuário e armazenadas aqui.
-- Execute no SQL Editor do Supabase.
--
-- IMPORTANTE: Se a coluna usuarios.fase tiver um CHECK restringindo a
-- 'teste' e 'producao', remova-o para permitir fases customizadas:
--   ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_fase_check;

-- 1. Criar tabela kanban_colunas
CREATE TABLE IF NOT EXISTS kanban_colunas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Comentários
COMMENT ON TABLE kanban_colunas IS 'Colunas do Kanban na tela de clientes (área admin). Compartilhadas entre todos os administradores.';
COMMENT ON COLUMN kanban_colunas.id IS 'Identificador único. Usado como valor de fase em usuarios.fase ao mover clientes.';
COMMENT ON COLUMN kanban_colunas.ordem IS 'Ordem de exibição. A primeira coluna criada recebe 0, as demais em sequência.';

-- 3. Habilitar RLS
ALTER TABLE kanban_colunas ENABLE ROW LEVEL SECURITY;

-- 4. Política: apenas administradores podem ler e escrever
-- Usa a função is_admin() se já existir (add-admin-fields.sql). Caso contrário, verifica direto em usuarios.
DROP POLICY IF EXISTS "Apenas administradores podem gerenciar colunas kanban" ON kanban_colunas;
CREATE POLICY "Apenas administradores podem gerenciar colunas kanban"
  ON kanban_colunas
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'administracao'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'administracao'
    )
  );

-- 5. Índice para ordenação
CREATE INDEX IF NOT EXISTS idx_kanban_colunas_ordem ON kanban_colunas(ordem);
