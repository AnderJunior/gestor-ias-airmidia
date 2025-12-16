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

/**
 * Busca quantidade de agendamentos por mês
 * @param userId - ID do usuário
 * @param months - Número de meses para buscar (padrão: 6)
 */
export async function getAgendamentosPorMes(userId: string, months: number = 6): Promise<Array<{ mes: string; quantidade: number }>> {
  // Calcular data inicial (meses atrás)
  const dataInicial = new Date();
  dataInicial.setMonth(dataInicial.getMonth() - months);
  dataInicial.setDate(1);
  dataInicial.setHours(0, 0, 0, 0);

  // Buscar agendamentos agrupados por mês
  const { data: agendamentos, error } = await supabase
    .from('agendamentos')
    .select('created_at')
    .eq('usuario_id', userId)
    .gte('created_at', dataInicial.toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching agendamentos por mês:', error);
    throw error;
  }

  if (!agendamentos || agendamentos.length === 0) {
    return [];
  }

  // Mapeamento de meses em português
  const mesesPt = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  
  // Inicializar todos os meses com 0 (do mais antigo para o mais recente)
  const mesesArray: Array<{ mes: string; quantidade: number; ordem: number; ano: number; mesIndex: number }> = [];
  for (let i = months - 1; i >= 0; i--) {
    const data = new Date();
    data.setMonth(data.getMonth() - i);
    const mesIndex = data.getMonth();
    const ano = data.getFullYear();
    const mesKey = mesesPt[mesIndex];
    mesesArray.push({ mes: mesKey, quantidade: 0, ordem: data.getTime(), ano, mesIndex });
  }

  // Contar agendamentos por mês
  agendamentos.forEach((agendamento: any) => {
    const data = new Date(agendamento.created_at);
    const mesIndex = data.getMonth();
    const ano = data.getFullYear();
    const mesKey = mesesPt[mesIndex];
    
    // Encontrar o mês correto considerando ano e mês
    const mesEncontrado = mesesArray.find(m => m.mes === mesKey && m.ano === ano && m.mesIndex === mesIndex);
    if (mesEncontrado) {
      mesEncontrado.quantidade += 1;
    }
  });

  // Converter para array final sem as propriedades auxiliares, mantendo a ordem (mais antigo à esquerda, mais recente à direita)
  // Formatar mês com ano: "jul de 2025"
  const meses = mesesArray.map(({ mes, quantidade, ano }) => ({ 
    mes: `${mes} de ${ano}`, 
    quantidade 
  }));

  return meses;
}

/**
 * Busca os 5 agendamentos mais próximos (próximos da data agendada)
 * @param userId - ID do usuário
 * @param limit - Número de agendamentos a retornar (padrão: 5)
 */
export async function getAgendamentosProximos(userId: string, limit: number = 5): Promise<Agendamento[]> {
  // Usar início do dia atual para garantir que agendamentos de hoje/tomorrow sejam incluídos
  const agora = new Date();
  agora.setHours(0, 0, 0, 0);
  
  // Buscar agendamentos futuros ordenados por data_e_hora (mais próximos primeiro)
  // Incluir também agendamentos de hoje que ainda não passaram
  // Filtrar apenas agendamentos que não estão cancelados ou concluídos
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
    .gte('data_e_hora', agora.toISOString())
    .in('status', ['agendado', 'confirmado'])
    .order('data_e_hora', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching agendamentos próximos:', error);
    throw error;
  }

  if (!agendamentos || agendamentos.length === 0) {
    return [];
  }

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
  const agendamentosMapeados = agendamentos.map((agendamento: any) => {
    let clienteNome = agendamento.clientes?.nome || clientesFallback[agendamento.cliente_id]?.nome;
    let clienteTelefone = agendamento.clientes?.telefone || clientesFallback[agendamento.cliente_id]?.telefone;
    let clienteFoto = agendamento.clientes?.foto_perfil || clientesFallback[agendamento.cliente_id]?.foto_perfil;
    
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

  return agendamentosMapeados;
}

/**
 * Busca estatísticas de agendamentos para o dashboard
 * @param userId - ID do usuário
 */
export async function getAgendamentosStats(userId: string): Promise<{
  totalAgendamentos: number;
  agendamentosMarcados: number;
  agendamentosEmAndamento: number;
}> {
  // Buscar todos os agendamentos do usuário
  const { data: agendamentos, error } = await supabase
    .from('agendamentos')
    .select('id, status')
    .eq('usuario_id', userId);

  if (error) {
    console.error('Error fetching agendamentos stats:', error);
    throw error;
  }

  const totalAgendamentos = agendamentos?.length || 0;
  
  // Agendamentos marcados são os que estão com status 'agendado' ou 'confirmado'
  const agendamentosMarcados = agendamentos?.filter(
    (a: any) => a.status === 'agendado' || a.status === 'confirmado'
  ).length || 0;

  // Agendamentos em andamento são os confirmados (prontos para acontecer)
  const agendamentosEmAndamento = agendamentos?.filter(
    (a: any) => a.status === 'confirmado'
  ).length || 0;

  return {
    totalAgendamentos,
    agendamentosMarcados,
    agendamentosEmAndamento,
  };
}

