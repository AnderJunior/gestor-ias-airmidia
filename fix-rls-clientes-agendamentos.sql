-- ============================================
-- CORREÇÃO DAS POLÍTICAS RLS PARA CLIENTES
-- ============================================
-- Este script corrige as políticas RLS da tabela clientes
-- para permitir acesso aos clientes via agendamentos também
-- 
-- PROBLEMA: As políticas atuais só permitem ver clientes relacionados a atendimentos,
-- mas não permitem ver clientes relacionados a agendamentos, causando join retornar null
--
-- SOLUÇÃO: Atualizar as políticas para incluir também agendamentos

-- ============================================
-- POLÍTICA SELECT (VER CLIENTES)
-- ============================================
-- Remover política antiga que só verifica atendimentos
DROP POLICY IF EXISTS "Usuários podem ver clientes dos seus atendimentos" ON clientes;

-- Criar nova política que permite ver clientes tanto de atendimentos quanto de agendamentos
CREATE POLICY "Usuários podem ver clientes dos seus atendimentos e agendamentos"
  ON clientes FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    (
      -- Cliente pertence diretamente ao usuário
      clientes.usuario_id = auth.uid()
      OR
      -- Cliente está relacionado a atendimentos do usuário
      EXISTS (
        SELECT 1 FROM atendimentos_solicitado a
        WHERE a.cliente_id = clientes.id
        AND a.usuario_id = auth.uid()
      )
      OR
      -- Cliente está relacionado a agendamentos do usuário
      EXISTS (
        SELECT 1 FROM agendamentos ag
        WHERE ag.cliente_id = clientes.id
        AND ag.usuario_id = auth.uid()
      )
    )
  );

-- ============================================
-- POLÍTICA UPDATE (ATUALIZAR CLIENTES)
-- ============================================
-- Remover política antiga de UPDATE
DROP POLICY IF EXISTS "Usuários podem atualizar clientes dos seus atendimentos" ON clientes;

-- Criar nova política de UPDATE que permite atualizar clientes de atendimentos e agendamentos
CREATE POLICY "Usuários podem atualizar clientes dos seus atendimentos e agendamentos"
  ON clientes FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    (
      -- Cliente pertence diretamente ao usuário
      clientes.usuario_id = auth.uid()
      OR
      -- Cliente está relacionado a atendimentos do usuário
      EXISTS (
        SELECT 1 FROM atendimentos_solicitado a
        WHERE a.cliente_id = clientes.id
        AND a.usuario_id = auth.uid()
      )
      OR
      -- Cliente está relacionado a agendamentos do usuário
      EXISTS (
        SELECT 1 FROM agendamentos ag
        WHERE ag.cliente_id = clientes.id
        AND ag.usuario_id = auth.uid()
      )
    )
  );

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Verificar se as políticas foram criadas corretamente
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'clientes'
ORDER BY policyname;
