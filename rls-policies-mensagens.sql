-- Script para criar políticas RLS (Row Level Security) para mensagens
-- Execute este script no SQL Editor do Supabase
--
-- Estrutura da tabela mensagens:
-- - id (int8, primary key)
-- - created_at (timestamptz)
-- - cliente_id (uuid) - referência à tabela cliente
-- - usuario_id (uuid) - referência à tabela usuario
-- - mensagem_usuario (varchar) - mensagem que a IA enviou
-- - mensagem_cliente (varchar) - mensagem que o cliente enviou

-- 1. Habilitar Row Level Security (RLS) na tabela mensagens
ALTER TABLE mensagens ENABLE ROW LEVEL SECURITY;

-- 2. Criar políticas RLS para mensagens

-- Política para SELECT: Usuários podem ver mensagens onde eles são o usuario_id
-- ou onde o cliente_id pertence a um atendimento deles
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

-- Política para INSERT: Usuários podem criar mensagens onde eles são o usuario_id
DROP POLICY IF EXISTS "Usuários podem criar mensagens como usuario_id" ON mensagens;
CREATE POLICY "Usuários podem criar mensagens como usuario_id"
  ON mensagens FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND usuario_id = u.id
      -- Verificar se o cliente_id pertence a um atendimento do usuário
      AND EXISTS (
        SELECT 1 FROM atendimentos_solicitado a
        WHERE a.cliente_id = mensagens.cliente_id
        AND a.usuario_id = u.id
      )
    )
  );

-- Política para UPDATE: Usuários podem atualizar mensagens onde eles são o usuario_id
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

-- Política para DELETE: Usuários podem deletar mensagens onde eles são o usuario_id
-- (opcional - descomente se necessário)
-- DROP POLICY IF EXISTS "Usuários podem deletar mensagens onde são usuario_id" ON mensagens;
-- CREATE POLICY "Usuários podem deletar mensagens onde são usuario_id"
--   ON mensagens FOR DELETE
--   USING (
--     auth.role() = 'authenticated' AND
--     EXISTS (
--       SELECT 1 FROM usuarios u
--       WHERE u.id = auth.uid()
--       AND mensagens.usuario_id = u.id
--     )
--   );

