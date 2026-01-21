import { supabase } from '../supabaseClient';
import {
  triggerWebhookCriarTarefa,
  triggerWebhookAtualizarStatusTarefa,
  triggerWebhookAtualizarNomeTarefa,
  triggerWebhookAtualizarDataVencimentoTarefa,
  triggerWebhookExcluirTarefa,
  triggerWebhookAtribuicaoNovoResponsavelTarefa,
} from './webhookTrigger';

export interface Tarefa {
  id: string;
  cliente_id: string;
  nome: string;
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
  data_vencimento: string | null;
  responsavel_id: string | null;
  created_at: string;
  updated_at: string;
  responsavel?: {
    id: string;
    nome: string | null;
  } | null;
}

export interface CriarTarefaInput {
  cliente_id: string;
  nome: string;
  status?: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
  data_vencimento?: string | null;
  responsavel_id?: string | null;
}

export interface AtualizarTarefaInput {
  nome?: string;
  status?: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
  data_vencimento?: string | null;
  responsavel_id?: string | null;
}

/**
 * Busca todas as tarefas de um cliente
 */
export async function getTarefasPorCliente(clienteId: string): Promise<Tarefa[]> {
  const { data, error } = await supabase
    .from('tarefas')
    .select(`
      *,
      responsavel:usuarios!responsavel_id(
        id,
        nome
      )
    `)
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching tarefas:', error);
    throw error;
  }

  return data || [];
}

/**
 * Cria uma nova tarefa
 */
export async function criarTarefa(input: CriarTarefaInput): Promise<Tarefa> {
  const { data, error } = await supabase
    .from('tarefas')
    .insert({
      cliente_id: input.cliente_id,
      nome: input.nome,
      status: input.status || 'pendente',
      data_vencimento: input.data_vencimento || null,
      responsavel_id: input.responsavel_id || null,
    })
    .select(`
      *,
      responsavel:usuarios!responsavel_id(
        id,
        nome
      )
    `)
    .single();

  if (error) {
    console.error('Error creating tarefa:', error);
    throw error;
  }

  // Buscar dados do cliente
  // cliente_id referencia usuarios(id), então precisamos buscar o cliente relacionado
  let clienteData = null;
  // Primeiro, buscar se existe um cliente na tabela clientes com usuario_id = cliente_id
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, nome, telefone')
    .eq('usuario_id', input.cliente_id)
    .maybeSingle();
  
  if (cliente) {
    clienteData = cliente;
  } else {
    // Se não encontrar na tabela clientes, buscar dados do usuario
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, nome, telefone_ia')
      .eq('id', input.cliente_id)
      .single();
    
    if (usuario) {
      clienteData = {
        id: usuario.id,
        nome: usuario.nome || '',
        telefone: usuario.telefone_ia || '',
      };
    }
  }

  // Acionar webhook
  triggerWebhookCriarTarefa({
    id: data.id,
    cliente_id: data.cliente_id,
    nome: data.nome,
    status: data.status,
    data_vencimento: data.data_vencimento,
    responsavel_id: data.responsavel_id,
    created_at: data.created_at,
    updated_at: data.updated_at,
    cliente: clienteData ? {
      id: clienteData.id,
      nome: clienteData.nome,
      telefone: clienteData.telefone,
    } : undefined,
    responsavel: data.responsavel ? {
      id: data.responsavel.id,
      nome: data.responsavel.nome,
    } : null,
  }).catch((err) => {
    console.error('Erro ao acionar webhook criar_tarefa:', err);
  });

  return data;
}

/**
 * Atualiza uma tarefa
 */
export async function atualizarTarefa(
  tarefaId: string,
  input: AtualizarTarefaInput
): Promise<Tarefa> {
  // Buscar tarefa atual para comparar mudanças
  const { data: tarefaAnterior } = await supabase
    .from('tarefas')
    .select(`
      *,
      responsavel:usuarios!responsavel_id(
        id,
        nome
      )
    `)
    .eq('id', tarefaId)
    .single();

  const { data, error } = await supabase
    .from('tarefas')
    .update({
      ...(input.nome !== undefined && { nome: input.nome }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.data_vencimento !== undefined && { data_vencimento: input.data_vencimento }),
      ...(input.responsavel_id !== undefined && { responsavel_id: input.responsavel_id }),
    })
    .eq('id', tarefaId)
    .select(`
      *,
      responsavel:usuarios!responsavel_id(
        id,
        nome
      )
    `)
    .single();

  if (error) {
    console.error('Error updating tarefa:', error);
    throw error;
  }

  // Buscar dados do cliente
  // cliente_id referencia usuarios(id), então precisamos buscar o cliente relacionado
  let clienteData = null;
  // Primeiro, buscar se existe um cliente na tabela clientes com usuario_id = cliente_id
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id, nome, telefone')
    .eq('usuario_id', data.cliente_id)
    .maybeSingle();
  
  if (cliente) {
    clienteData = cliente;
  } else {
    // Se não encontrar na tabela clientes, buscar dados do usuario
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, nome, telefone_ia')
      .eq('id', data.cliente_id)
      .single();
    
    if (usuario) {
      clienteData = {
        id: usuario.id,
        nome: usuario.nome || '',
        telefone: usuario.telefone_ia || '',
      };
    }
  }

  // Acionar webhooks baseado nas mudanças
  if (tarefaAnterior) {
    // Atualizar status
    if (input.status !== undefined && input.status !== tarefaAnterior.status) {
      triggerWebhookAtualizarStatusTarefa({
        id: data.id,
        cliente_id: data.cliente_id,
        nome: data.nome,
        status_anterior: tarefaAnterior.status,
        status_novo: data.status,
        data_vencimento: data.data_vencimento,
        responsavel_id: data.responsavel_id,
        updated_at: data.updated_at,
        cliente: clienteData ? {
          id: clienteData.id,
          nome: clienteData.nome,
          telefone: clienteData.telefone,
        } : undefined,
        responsavel: data.responsavel ? {
          id: data.responsavel.id,
          nome: data.responsavel.nome,
        } : null,
      }).catch((err) => {
        console.error('Erro ao acionar webhook atualizar_status_tarefa:', err);
      });
    }

    // Atualizar nome
    if (input.nome !== undefined && input.nome !== tarefaAnterior.nome) {
      triggerWebhookAtualizarNomeTarefa({
        id: data.id,
        cliente_id: data.cliente_id,
        nome_anterior: tarefaAnterior.nome,
        nome_novo: data.nome,
        status: data.status,
        data_vencimento: data.data_vencimento,
        responsavel_id: data.responsavel_id,
        updated_at: data.updated_at,
        cliente: clienteData ? {
          id: clienteData.id,
          nome: clienteData.nome,
          telefone: clienteData.telefone,
        } : undefined,
        responsavel: data.responsavel ? {
          id: data.responsavel.id,
          nome: data.responsavel.nome,
        } : null,
      }).catch((err) => {
        console.error('Erro ao acionar webhook atualizar_nome_tarefa:', err);
      });
    }

    // Atualizar data de vencimento
    if (input.data_vencimento !== undefined) {
      const dataVencimentoAnterior = tarefaAnterior.data_vencimento;
      const dataVencimentoNova = input.data_vencimento;
      
      // Comparar se realmente mudou (considerando null/undefined)
      const mudou = (dataVencimentoAnterior !== dataVencimentoNova) &&
        !(dataVencimentoAnterior === null && dataVencimentoNova === null) &&
        !(dataVencimentoAnterior === null && !dataVencimentoNova) &&
        !(!dataVencimentoAnterior && dataVencimentoNova === null);
      
      if (mudou) {
        triggerWebhookAtualizarDataVencimentoTarefa({
          id: data.id,
          cliente_id: data.cliente_id,
          nome: data.nome,
          status: data.status,
          data_vencimento_anterior: dataVencimentoAnterior,
          data_vencimento_nova: dataVencimentoNova,
          responsavel_id: data.responsavel_id,
          updated_at: data.updated_at,
          cliente: clienteData ? {
            id: clienteData.id,
            nome: clienteData.nome,
            telefone: clienteData.telefone,
          } : undefined,
          responsavel: data.responsavel ? {
            id: data.responsavel.id,
            nome: data.responsavel.nome,
          } : null,
        }).catch((err) => {
          console.error('Erro ao acionar webhook atualizar_data_vencimento_tarefa:', err);
        });
      }
    }

    // Atribuição de novo responsável
    if (input.responsavel_id !== undefined && input.responsavel_id !== tarefaAnterior.responsavel_id) {
      // Buscar nome do responsável anterior
      let responsavelAnteriorNome = null;
      if (tarefaAnterior.responsavel_id) {
        const { data: respAnterior } = await supabase
          .from('usuarios')
          .select('id, nome')
          .eq('id', tarefaAnterior.responsavel_id)
          .single();
        responsavelAnteriorNome = respAnterior?.nome || null;
      }

      triggerWebhookAtribuicaoNovoResponsavelTarefa({
        id: data.id,
        cliente_id: data.cliente_id,
        nome: data.nome,
        status: data.status,
        responsavel_anterior_id: tarefaAnterior.responsavel_id,
        responsavel_anterior_nome: responsavelAnteriorNome,
        responsavel_novo_id: data.responsavel_id || '',
        responsavel_novo_nome: data.responsavel?.nome || '',
        data_vencimento: data.data_vencimento,
        updated_at: data.updated_at,
        cliente: clienteData ? {
          id: clienteData.id,
          nome: clienteData.nome,
          telefone: clienteData.telefone,
        } : undefined,
      }).catch((err) => {
        console.error('Erro ao acionar webhook atribuicao_novo_responsavel:', err);
      });
    }
  }

  return data;
}

/**
 * Exclui uma tarefa
 */
export async function excluirTarefa(tarefaId: string): Promise<void> {
  // Buscar dados da tarefa antes de excluir
  const { data: tarefa, error: fetchError } = await supabase
    .from('tarefas')
    .select(`
      *,
      responsavel:usuarios!responsavel_id(
        id,
        nome
      )
    `)
    .eq('id', tarefaId)
    .single();

  // Se não encontrou a tarefa, não há o que excluir
  if (fetchError || !tarefa) {
    console.error('Error fetching tarefa before delete:', fetchError);
    // Ainda assim, tentar excluir (pode já ter sido excluída)
    const { error } = await supabase
      .from('tarefas')
      .delete()
      .eq('id', tarefaId);
    
    if (error) {
      console.error('Error deleting tarefa:', error);
      throw error;
    }
    return;
  }

  // Buscar dados do cliente antes de excluir
  let clienteData = null;
  try {
    // Primeiro, buscar se existe um cliente na tabela clientes com usuario_id = cliente_id
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id, nome, telefone')
      .eq('usuario_id', tarefa.cliente_id)
      .maybeSingle();
    
    if (cliente) {
      clienteData = cliente;
    } else {
      // Se não encontrar na tabela clientes, buscar dados do usuario
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('id, nome, telefone_ia')
        .eq('id', tarefa.cliente_id)
        .single();
      
      if (usuario) {
        clienteData = {
          id: usuario.id,
          nome: usuario.nome || '',
          telefone: usuario.telefone_ia || '',
        };
      }
    }
  } catch (err) {
    console.error('Erro ao buscar dados do cliente para webhook:', err);
  }

  // Acionar webhook ANTES de excluir para garantir que as informações sejam enviadas corretamente
  try {
    console.log('Acionando webhook excluir_tarefa para tarefa:', tarefa.id);
    await triggerWebhookExcluirTarefa({
      id: tarefa.id,
      cliente_id: tarefa.cliente_id,
      nome: tarefa.nome,
      status: tarefa.status,
      data_vencimento: tarefa.data_vencimento,
      responsavel_id: tarefa.responsavel_id,
      cliente: clienteData ? {
        id: clienteData.id,
        nome: clienteData.nome,
        telefone: clienteData.telefone,
      } : undefined,
      responsavel: tarefa.responsavel ? {
        id: tarefa.responsavel.id,
        nome: tarefa.responsavel.nome,
      } : null,
    });
    console.log('Webhook excluir_tarefa acionado com sucesso');
  } catch (err) {
    console.error('Erro ao acionar webhook excluir_tarefa:', err);
    // Continuar com a exclusão mesmo se o webhook falhar
  }

  // Excluir a tarefa APÓS enviar o webhook
  const { error } = await supabase
    .from('tarefas')
    .delete()
    .eq('id', tarefaId);

  if (error) {
    console.error('Error deleting tarefa:', error);
    throw error;
  }
}

/**
 * Exclui todas as tarefas de um cliente
 * Envia webhook para cada tarefa antes de excluir
 */
export async function excluirTodasTarefas(clienteId: string): Promise<void> {
  // Buscar todas as tarefas antes de excluir
  const { data: tarefas, error: fetchError } = await supabase
    .from('tarefas')
    .select(`
      *,
      responsavel:usuarios!responsavel_id(
        id,
        nome
      )
    `)
    .eq('cliente_id', clienteId);

  if (fetchError) {
    console.error('Error fetching tarefas before delete:', fetchError);
    throw fetchError;
  }

  // Buscar dados do cliente antes de excluir
  let clienteData = null;
  try {
    // Primeiro, buscar se existe um cliente na tabela clientes com usuario_id = cliente_id
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id, nome, telefone')
      .eq('usuario_id', clienteId)
      .maybeSingle();
    
    if (cliente) {
      clienteData = cliente;
    } else {
      // Se não encontrar na tabela clientes, buscar dados do usuario
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('id, nome, telefone_ia')
        .eq('id', clienteId)
        .single();
      
      if (usuario) {
        clienteData = {
          id: usuario.id,
          nome: usuario.nome || '',
          telefone: usuario.telefone_ia || '',
        };
      }
    }
  } catch (err) {
    console.error('Erro ao buscar dados do cliente para webhook:', err);
  }

  // Enviar webhook para cada tarefa ANTES de excluir
  if (tarefas && tarefas.length > 0) {
    for (const tarefa of tarefas) {
      try {
        await triggerWebhookExcluirTarefa({
          id: tarefa.id,
          cliente_id: tarefa.cliente_id,
          nome: tarefa.nome,
          status: tarefa.status,
          data_vencimento: tarefa.data_vencimento,
          responsavel_id: tarefa.responsavel_id,
          cliente: clienteData ? {
            id: clienteData.id,
            nome: clienteData.nome,
            telefone: clienteData.telefone,
          } : undefined,
          responsavel: tarefa.responsavel ? {
            id: tarefa.responsavel.id,
            nome: tarefa.responsavel.nome,
          } : null,
        });
      } catch (err) {
        console.error(`Erro ao acionar webhook excluir_tarefa para tarefa ${tarefa.id}:`, err);
        // Continuar com as outras tarefas mesmo se uma falhar
      }
    }
  }

  // Excluir todas as tarefas APÓS enviar os webhooks
  const { error } = await supabase
    .from('tarefas')
    .delete()
    .eq('cliente_id', clienteId);

  if (error) {
    console.error('Error deleting all tarefas:', error);
    throw error;
  }
}

/**
 * Busca a contagem de tarefas pendentes por cliente
 * Retorna um objeto mapeando cliente_id para a quantidade de tarefas pendentes
 */
export async function getContagemTarefasPendentesPorClientes(
  clienteIds: string[]
): Promise<Record<string, number>> {
  if (clienteIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from('tarefas')
    .select('cliente_id')
    .in('cliente_id', clienteIds)
    .eq('status', 'pendente');

  if (error) {
    console.error('Error fetching tarefas pendentes count:', error);
    throw error;
  }

  // Contar tarefas pendentes por cliente
  const contagem: Record<string, number> = {};
  clienteIds.forEach((id) => {
    contagem[id] = 0;
  });

  if (data) {
    data.forEach((tarefa) => {
      if (tarefa.cliente_id) {
        contagem[tarefa.cliente_id] = (contagem[tarefa.cliente_id] || 0) + 1;
      }
    });
  }

  return contagem;
}
