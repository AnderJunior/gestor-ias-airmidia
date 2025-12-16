import { supabase } from '../supabaseClient';
import { Agendamento } from '@/types/domain';

/**
 * Busca agendamentos do usuário logado
 * @param userId - ID do usuário
 */
export async function getAgendamentos(userId: string): Promise<Agendamento[]> {
  const { data: agendamentos, error } = await supabase
    .from('agendamentos')
    .select(`
      *,
      clientes (
        nome,
        telefone,
        foto_perfil
      )
    `)
    .eq('usuario_id', userId)
    .order('data_e_hora', { ascending: true });

  if (error) {
    console.error('Error fetching agendamentos:', error);
    throw error;
  }

  if (!agendamentos || agendamentos.length === 0) {
    return [];
  }

  // Debug: verificar dados retornados
  console.log('Agendamentos retornados:', agendamentos.map((a: any) => ({
    id: a.id,
    cliente_id: a.cliente_id,
    cliente_nome: a.clientes?.nome,
    clientes: a.clientes
  })));

  // Buscar nomes de clientes que não vieram no join (fallback)
  const agendamentosSemCliente = agendamentos.filter((a: any) => !a.clientes?.nome && a.cliente_id);
  const clienteIdsParaBuscar = [...new Set(agendamentosSemCliente.map((a: any) => a.cliente_id))];
  
  let clientesFallback: Record<string, { nome?: string; telefone?: string; foto_perfil?: string }> = {};
  
  if (clienteIdsParaBuscar.length > 0) {
    try {
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('id, nome, telefone, foto_perfil')
        .in('id', clienteIdsParaBuscar);
      
      if (!clientesError && clientesData) {
        clientesFallback = clientesData.reduce((acc: any, cliente: any) => {
          acc[cliente.id] = {
            nome: cliente.nome,
            telefone: cliente.telefone,
            foto_perfil: cliente.foto_perfil
          };
          return acc;
        }, {});
      }
    } catch (err) {
      console.error('Erro ao buscar clientes como fallback:', err);
    }
  }

  // Mapear para o tipo Agendamento
  return agendamentos.map((agendamento: any) => {
    // Tentar obter dados do cliente do join primeiro, depois do fallback
    let clienteNome = agendamento.clientes?.nome || clientesFallback[agendamento.cliente_id]?.nome;
    let clienteTelefone = agendamento.clientes?.telefone || clientesFallback[agendamento.cliente_id]?.telefone;
    let clienteFoto = agendamento.clientes?.foto_perfil || clientesFallback[agendamento.cliente_id]?.foto_perfil;
    
    if (!clienteNome && agendamento.cliente_id) {
      console.warn('Agendamento sem nome do cliente:', {
        agendamentoId: agendamento.id,
        clienteId: agendamento.cliente_id,
        clientesJoin: agendamento.clientes,
        clientesFallback: clientesFallback[agendamento.cliente_id]
      });
    }
    
    return {
      id: agendamento.id,
      cliente_id: agendamento.cliente_id,
      cliente_nome: clienteNome || null,
      cliente_foto_perfil: clienteFoto || undefined,
      telefone_cliente: clienteTelefone || undefined,
      usuario_id: agendamento.usuario_id,
      data_e_hora: agendamento.data_e_hora,
      resumo_conversa: agendamento.resumo_conversa || undefined,
      link_agendamento: agendamento.link_agendamento || undefined,
      status: agendamento.status,
      created_at: agendamento.created_at,
      updated_at: agendamento.updated_at,
    };
  });
}

/**
 * Busca agendamentos por intervalo de datas
 * @param userId - ID do usuário
 * @param startDate - Data inicial
 * @param endDate - Data final
 */
export async function getAgendamentosByDateRange(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<Agendamento[]> {
  const { data: agendamentos, error } = await supabase
    .from('agendamentos')
    .select(`
      *,
      clientes (
        nome,
        telefone,
        foto_perfil
      )
    `)
    .eq('usuario_id', userId)
    .gte('data_e_hora', startDate.toISOString())
    .lte('data_e_hora', endDate.toISOString())
    .order('data_e_hora', { ascending: true });

  if (error) {
    console.error('Error fetching agendamentos by date range:', error);
    throw error;
  }

  if (!agendamentos || agendamentos.length === 0) {
    return [];
  }

  // Mapear para o tipo Agendamento
  return agendamentos.map((agendamento: any) => ({
    id: agendamento.id,
    cliente_id: agendamento.cliente_id,
    cliente_nome: agendamento.clientes?.nome,
    cliente_foto_perfil: agendamento.clientes?.foto_perfil || undefined,
    telefone_cliente: agendamento.clientes?.telefone || undefined,
    usuario_id: agendamento.usuario_id,
    data_e_hora: agendamento.data_e_hora,
    resumo_conversa: agendamento.resumo_conversa || undefined,
    link_agendamento: agendamento.link_agendamento || undefined,
    status: agendamento.status,
    created_at: agendamento.created_at,
    updated_at: agendamento.updated_at,
  }));
}

/**
 * Cria um novo agendamento
 * @param agendamento - Dados do agendamento
 */
export async function createAgendamento(agendamento: {
  cliente_id: string;
  usuario_id: string;
  data_e_hora: string; // ISO string
  resumo_conversa?: string;
  status?: 'agendado' | 'confirmado' | 'cancelado' | 'concluido';
}): Promise<Agendamento> {
  const { data, error } = await supabase
    .from('agendamentos')
    .insert({
      cliente_id: agendamento.cliente_id,
      usuario_id: agendamento.usuario_id,
      data_e_hora: agendamento.data_e_hora,
      resumo_conversa: agendamento.resumo_conversa,
      status: agendamento.status || 'agendado',
    })
    .select(`
      *,
      clientes (
        nome,
        telefone,
        foto_perfil
      )
    `)
    .single();

  if (error) {
    console.error('Error creating agendamento:', error);
    throw error;
  }

  return {
    id: data.id,
    cliente_id: data.cliente_id,
    cliente_nome: data.clientes?.nome,
    cliente_foto_perfil: data.clientes?.foto_perfil || undefined,
    telefone_cliente: data.clientes?.telefone || undefined,
    usuario_id: data.usuario_id,
    data_e_hora: data.data_e_hora,
    resumo_conversa: data.resumo_conversa || undefined,
    link_agendamento: data.link_agendamento || undefined,
    status: data.status,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Atualiza o status de um agendamento
 * @param agendamentoId - ID do agendamento
 * @param status - Novo status
 */
export async function updateAgendamentoStatus(
  agendamentoId: string,
  status: 'agendado' | 'confirmado' | 'cancelado' | 'concluido'
): Promise<void> {
  const { error } = await supabase
    .from('agendamentos')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', agendamentoId);

  if (error) {
    console.error('Error updating agendamento status:', error);
    throw error;
  }
}

/**
 * Busca um agendamento por ID
 * @param agendamentoId - ID do agendamento
 */
export async function getAgendamentoById(agendamentoId: string): Promise<Agendamento | null> {
  const { data, error } = await supabase
    .from('agendamentos')
    .select(`
      *,
      clientes (
        nome,
        telefone,
        foto_perfil
      )
    `)
    .eq('id', agendamentoId)
    .single();

  if (error) {
    console.error('Error fetching agendamento:', error);
    return null;
  }

  if (!data) {
    return null;
  }

  // Buscar cliente como fallback se não vier no join
  let clienteNome = data.clientes?.nome;
  let clienteTelefone = data.clientes?.telefone;
  let clienteFoto = data.clientes?.foto_perfil;

  if (!clienteNome && data.cliente_id) {
    try {
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('nome, telefone, foto_perfil')
        .eq('id', data.cliente_id)
        .single();
      
      if (clienteData) {
        clienteNome = clienteData.nome;
        clienteTelefone = clienteData.telefone;
        clienteFoto = clienteData.foto_perfil;
      }
    } catch (err) {
      console.error('Erro ao buscar cliente como fallback:', err);
    }
  }

  return {
    id: data.id,
    cliente_id: data.cliente_id,
    cliente_nome: clienteNome || null,
    cliente_foto_perfil: clienteFoto || undefined,
    telefone_cliente: clienteTelefone || undefined,
    usuario_id: data.usuario_id,
    data_e_hora: data.data_e_hora,
    resumo_conversa: data.resumo_conversa || undefined,
    link_agendamento: data.link_agendamento || undefined,
    status: data.status,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Deleta um agendamento
 * @param agendamentoId - ID do agendamento
 */
export async function deleteAgendamento(agendamentoId: string): Promise<void> {
  const { error } = await supabase
    .from('agendamentos')
    .delete()
    .eq('id', agendamentoId);

  if (error) {
    console.error('Error deleting agendamento:', error);
    throw error;
  }
}

