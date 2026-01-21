-- ============================================
-- SCRIPT DE OTIMIZAÇÃO DE POLÍTICAS RLS
-- ============================================
-- Este script otimiza todas as políticas RLS para melhor performance:
-- 1. Substitui auth.uid() e auth.role() por (select auth.uid()) e (select auth.role())
-- 2. Consolida políticas duplicadas para reduzir overhead
-- 3. Otimiza a função is_admin() para usar (select auth.uid())
--
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- ============================================
-- 1. OTIMIZAR FUNÇÃO is_admin()
-- ============================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM usuarios 
    WHERE id = (select auth.uid()) AND tipo = 'administracao'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 1.1. REMOVER TODAS AS POLÍTICAS EXISTENTES
-- ============================================
-- Remove todas as políticas de forma dinâmica para evitar conflitos com nomes truncados
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Remover políticas de usuarios
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'usuarios') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON usuarios', r.policyname);
    END LOOP;
    
    -- Remover políticas de whatsapp_instances
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'whatsapp_instances') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON whatsapp_instances', r.policyname);
    END LOOP;
    
    -- Remover políticas de clientes
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clientes') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON clientes', r.policyname);
    END LOOP;
    
    -- Remover políticas de agendamentos
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agendamentos') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON agendamentos', r.policyname);
    END LOOP;
    
    -- Remover políticas de atendimentos_solicitado
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'atendimentos_solicitado') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON atendimentos_solicitado', r.policyname);
    END LOOP;
    
    -- Remover políticas de mensagens
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mensagens') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON mensagens', r.policyname);
    END LOOP;
    
    -- Remover políticas de kanban_colunas
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kanban_colunas') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON kanban_colunas', r.policyname);
    END LOOP;
END $$;

-- ============================================
-- 2. POLÍTICAS RLS PARA usuarios
-- ============================================

-- Política consolidada para SELECT (admin ou próprio usuário)
CREATE POLICY "Usuários podem ver seus próprios dados ou administradores veem todos"
  ON usuarios FOR SELECT
  USING (
    is_admin() OR (select auth.uid()) = id
  );

-- Política consolidada para INSERT (admin ou próprio usuário)
CREATE POLICY "Usuários podem criar seus próprios dados ou administradores criam usuários"
  ON usuarios FOR INSERT
  WITH CHECK (
    is_admin() OR (select auth.uid()) = id
  );

-- Política consolidada para UPDATE (admin pode atualizar não-admins, ou próprio usuário)
CREATE POLICY "Usuários podem atualizar seus próprios dados ou administradores atualizam usuários"
  ON usuarios FOR UPDATE
  USING (
    (is_admin() AND (SELECT tipo FROM usuarios WHERE id = usuarios.id) != 'administracao') 
    OR (select auth.uid()) = id
  )
  WITH CHECK (
    (is_admin() AND (SELECT tipo FROM usuarios WHERE id = usuarios.id) != 'administracao') 
    OR (select auth.uid()) = id
  );

-- ============================================
-- 3. POLÍTICAS RLS PARA whatsapp_instances
-- ============================================

-- Política consolidada para SELECT (admin ou próprio usuário)
CREATE POLICY "Usuários podem ver suas próprias instâncias ou administradores veem todas"
  ON whatsapp_instances FOR SELECT
  USING (
    is_admin() OR
    (
      (select auth.role()) = 'authenticated' AND
      EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = (select auth.uid()) AND u.id = whatsapp_instances.usuario_id
      )
    )
  );

-- Política consolidada para INSERT (admin ou próprio usuário)
CREATE POLICY "Usuários podem criar suas próprias instâncias ou administradores criam para qualquer usuário"
  ON whatsapp_instances FOR INSERT
  WITH CHECK (
    is_admin() OR
    (
      (select auth.role()) = 'authenticated' AND
      EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = (select auth.uid()) AND u.id = usuario_id
      )
    )
  );

-- Política consolidada para UPDATE (admin ou próprio usuário)
CREATE POLICY "Usuários podem atualizar suas próprias instâncias ou administradores atualizam qualquer instância"
  ON whatsapp_instances FOR UPDATE
  USING (
    is_admin() OR
    (
      (select auth.role()) = 'authenticated' AND
      EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = (select auth.uid()) AND u.id = whatsapp_instances.usuario_id
      )
    )
  )
  WITH CHECK (
    is_admin() OR
    (
      (select auth.role()) = 'authenticated' AND
      EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = (select auth.uid()) AND u.id = whatsapp_instances.usuario_id
      )
    )
  );

-- ============================================
-- 4. POLÍTICAS RLS PARA clientes
-- ============================================

-- Política consolidada para SELECT (clientes dos atendimentos_solicitado ou agendamentos, ou próprios clientes)
CREATE POLICY "Usuários podem ver clientes dos seus atendimentos e agendamentos"
  ON clientes FOR SELECT
  USING (
    (select auth.role()) = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (select auth.uid())
      AND (
        -- Clientes dos atendimentos_solicitado do usuário
        EXISTS (
          SELECT 1 FROM atendimentos_solicitado a
          WHERE a.cliente_id = clientes.id
          AND a.usuario_id = u.id
        )
        OR
        -- Clientes dos agendamentos do usuário
        EXISTS (
          SELECT 1 FROM agendamentos ag
          WHERE ag.cliente_id = clientes.id
          AND ag.usuario_id = u.id
        )
        OR
        -- Clientes próprios (se houver campo usuario_id)
        clientes.usuario_id = u.id
      )
    )
  );

-- Política para INSERT
CREATE POLICY "Usuários podem criar clientes"
  ON clientes FOR INSERT
  WITH CHECK ((select auth.role()) = 'authenticated');

-- Política consolidada para UPDATE
CREATE POLICY "Usuários podem atualizar clientes dos seus atendimentos e agendamentos"
  ON clientes FOR UPDATE
  USING (
    (select auth.role()) = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (select auth.uid())
      AND (
        -- Clientes dos atendimentos_solicitado do usuário
        EXISTS (
          SELECT 1 FROM atendimentos_solicitado a
          WHERE a.cliente_id = clientes.id
          AND a.usuario_id = u.id
        )
        OR
        -- Clientes dos agendamentos do usuário
        EXISTS (
          SELECT 1 FROM agendamentos ag
          WHERE ag.cliente_id = clientes.id
          AND ag.usuario_id = u.id
        )
        OR
        -- Clientes próprios (se houver campo usuario_id)
        clientes.usuario_id = u.id
      )
    )
  );

-- ============================================
-- 5. POLÍTICAS RLS PARA agendamentos
-- ============================================

-- Política para SELECT
CREATE POLICY "Usuários podem ver seus próprios agendamentos"
  ON agendamentos FOR SELECT
  USING (usuario_id = (select auth.uid()));

-- Política para INSERT
CREATE POLICY "Usuários podem criar seus próprios agendamentos"
  ON agendamentos FOR INSERT
  WITH CHECK (usuario_id = (select auth.uid()));

-- Política para UPDATE
CREATE POLICY "Usuários podem atualizar seus próprios agendamentos"
  ON agendamentos FOR UPDATE
  USING (usuario_id = (select auth.uid()));

-- Política para DELETE
CREATE POLICY "Usuários podem deletar seus próprios agendamentos"
  ON agendamentos FOR DELETE
  USING (usuario_id = (select auth.uid()));

-- ============================================
-- 6. POLÍTICAS RLS PARA atendimentos_solicitado
-- ============================================

-- Política consolidada para SELECT (removendo duplicatas)
CREATE POLICY "Usuários podem ver seus próprios atendimentos solicitados"
  ON atendimentos_solicitado FOR SELECT
  USING (
    (select auth.role()) = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (select auth.uid())
      AND atendimentos_solicitado.usuario_id = u.id
    )
  );

-- Política consolidada para INSERT (removendo duplicatas)
CREATE POLICY "Usuários podem criar seus próprios atendimentos solicitados"
  ON atendimentos_solicitado FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (select auth.uid())
      AND usuario_id = u.id
      AND EXISTS (
        SELECT 1 FROM whatsapp_instances wi
        WHERE wi.id = whatsapp_instance_id
        AND wi.usuario_id = u.id
      )
    )
  );

-- Política consolidada para UPDATE (removendo duplicatas)
CREATE POLICY "Usuários podem atualizar seus próprios atendimentos solicitados"
  ON atendimentos_solicitado FOR UPDATE
  USING (
    (select auth.role()) = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (select auth.uid())
      AND atendimentos_solicitado.usuario_id = u.id
    )
  );

-- Política para DELETE
CREATE POLICY "Usuários podem excluir seus próprios atendimentos solicitados"
  ON atendimentos_solicitado FOR DELETE
  USING (
    (select auth.role()) = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (select auth.uid())
      AND atendimentos_solicitado.usuario_id = u.id
    )
  );

-- ============================================
-- 7. POLÍTICAS RLS PARA mensagens
-- ============================================

-- Política para SELECT
CREATE POLICY "Usuários podem ver mensagens relacionadas a eles"
  ON mensagens FOR SELECT
  USING (
    (select auth.role()) = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (select auth.uid())
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

-- Política para INSERT
CREATE POLICY "Usuários podem criar mensagens como usuario_id"
  ON mensagens FOR INSERT
  WITH CHECK (
    (select auth.role()) = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (select auth.uid())
      AND usuario_id = u.id
      -- Verificar se o cliente_id pertence a um atendimento_solicitado do usuário
      AND EXISTS (
        SELECT 1 FROM atendimentos_solicitado a
        WHERE a.cliente_id = mensagens.cliente_id
        AND a.usuario_id = u.id
      )
    )
  );

-- Política para UPDATE
CREATE POLICY "Usuários podem atualizar mensagens onde são usuario_id"
  ON mensagens FOR UPDATE
  USING (
    (select auth.role()) = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (select auth.uid())
      AND mensagens.usuario_id = u.id
    )
  );

-- ============================================
-- 8. POLÍTICAS RLS PARA kanban_colunas
-- ============================================

-- Política otimizada para kanban_colunas
CREATE POLICY "Apenas administradores podem gerenciar colunas kanban"
  ON kanban_colunas
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = (select auth.uid())
      AND usuarios.tipo = 'administracao'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = (select auth.uid())
      AND usuarios.tipo = 'administracao'
    )
  );

-- ============================================
-- FIM DO SCRIPT
-- ============================================
-- Todas as políticas RLS foram otimizadas:
-- ✓ auth.uid() e auth.role() substituídos por (select auth.uid()) e (select auth.role())
-- ✓ Políticas duplicadas consolidadas
-- ✓ Função is_admin() otimizada
-- ============================================
