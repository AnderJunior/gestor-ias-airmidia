-- Função SQL para atualizar foreign keys para NULL antes de excluir um administrador
-- Execute este script no SQL Editor do Supabase
-- Esta função altera temporariamente as constraints NOT NULL, atualiza as foreign keys para NULL,
-- e mantém as constraints alteradas (permitindo NULL) para permitir exclusões futuras

CREATE OR REPLACE FUNCTION atualizar_foreign_keys_antes_excluir_admin(admin_id UUID)
RETURNS void AS $$
BEGIN
  -- Atualizar clientes.usuario_id
  BEGIN
    -- Tentar remover constraint NOT NULL se existir
    ALTER TABLE clientes ALTER COLUMN usuario_id DROP NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    -- Se já não for NOT NULL ou se houver outro erro, continua
    NULL;
  END;
  
  -- Atualizar para NULL
  UPDATE clientes 
  SET usuario_id = NULL 
  WHERE usuario_id = admin_id;

  -- Atualizar whatsapp_instances.usuario_id
  BEGIN
    ALTER TABLE whatsapp_instances ALTER COLUMN usuario_id DROP NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  UPDATE whatsapp_instances 
  SET usuario_id = NULL 
  WHERE usuario_id = admin_id;

  -- Atualizar webhooks_apis.usuario_id
  BEGIN
    ALTER TABLE webhooks_apis ALTER COLUMN usuario_id DROP NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  UPDATE webhooks_apis 
  SET usuario_id = NULL 
  WHERE usuario_id = admin_id;

  -- Atualizar agendamentos.usuario_id
  BEGIN
    ALTER TABLE agendamentos ALTER COLUMN usuario_id DROP NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  UPDATE agendamentos 
  SET usuario_id = NULL 
  WHERE usuario_id = admin_id;

  -- Atualizar tarefas.responsavel_id (já permite NULL)
  UPDATE tarefas 
  SET responsavel_id = NULL 
  WHERE responsavel_id = admin_id;

  -- Para atendimentos_solicitado, se existir
  BEGIN
    BEGIN
      ALTER TABLE atendimentos_solicitado ALTER COLUMN usuario_id DROP NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    UPDATE atendimentos_solicitado 
    SET usuario_id = NULL 
    WHERE usuario_id = admin_id;
  EXCEPTION WHEN undefined_table THEN
    -- Tabela não existe, ignora
    NULL;
  END;
  
  -- Nota: tarefas.cliente_id referencia usuarios mas é NOT NULL
  -- Se um administrador for também um cliente e tiver tarefas,
  -- essas tarefas não podem ser atualizadas para NULL.
  -- Isso é esperado e as tarefas serão mantidas.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
