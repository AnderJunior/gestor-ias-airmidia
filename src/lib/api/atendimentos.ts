import { supabase } from '../supabaseClient';
import { Atendimento, DashboardStats, StatusAtendimento } from '@/types/domain';
import { getConnectedInstances } from './whatsapp';

/**
 * Busca atendimentos do usuário logado (baseado nos telefones conectados)
 * @param userId - ID do usuário (opcional, se não fornecido busca do auth)
 */
export async function getAtendimentos(userId?: string): Promise<Atendimento[]> {
  // Primeiro, buscar as instâncias conectadas do usuário
  const connectedInstances = await getConnectedInstances(userId);
  const instanceIds = connectedInstances.map(inst => inst.id);

  if (instanceIds.length === 0) {
    return [];
  }

  // Buscar atendimentos com joins para obter dados relacionados
  const { data: atendimentos, error: atendimentosError } = await supabase
    .from('atendimentos_solicitado')
    .select(`
      *,
      clientes (
        nome,
        telefone,
        foto_perfil
      ),
      whatsapp_instances (
        telefone
      )
    `)
    .in('whatsapp_instance_id', instanceIds)
    .order('updated_at', { ascending: false });

  if (atendimentosError) {
    console.error('Error fetching atendimentos:', atendimentosError);
    throw atendimentosError;
  }

  if (!atendimentos || atendimentos.length === 0) {
    return [];
  }

  // Mapear para o tipo Atendimento
  return atendimentos.map((atendimento: any) => ({
    id: atendimento.id,
    cliente_id: atendimento.cliente_id,
    cliente_nome: atendimento.clientes?.nome,
    cliente_foto_perfil: atendimento.clientes?.foto_perfil || undefined,
    telefone_cliente: atendimento.clientes?.telefone || '',
    telefone_usuario: atendimento.whatsapp_instances?.telefone || '',
    usuario_id: atendimento.usuario_id,
    status: (atendimento.status || 'aberto') as StatusAtendimento,
    created_at: atendimento.created_at,
    updated_at: atendimento.updated_at,
    resumo_conversa: atendimento.resumo_conversa || undefined,
  }));
}

/**
 * Busca atendimentos por telefone do cliente
 * @param telefoneCliente - Telefone do cliente
 * @param userId - ID do usuário (opcional, se não fornecido busca do auth)
 */
export async function getAtendimentosByTelefoneCliente(telefoneCliente: string, userId?: string): Promise<Atendimento[]> {
  const connectedInstances = await getConnectedInstances(userId);
  const instanceIds = connectedInstances.map(inst => inst.id);

  if (instanceIds.length === 0) {
    return [];
  }

  // Primeiro buscar o cliente pelo telefone
  const { data: cliente } = await supabase
    .from('clientes')
    .select('id')
    .eq('telefone', telefoneCliente)
    .single();

  if (!cliente) {
    return [];
  }

  // Buscar atendimentos com joins
  const { data, error } = await supabase
    .from('atendimentos_solicitado')
    .select(`
      *,
      clientes (
        nome,
        telefone,
        foto_perfil
      ),
      whatsapp_instances (
        telefone
      )
    `)
    .eq('cliente_id', cliente.id)
    .in('whatsapp_instance_id', instanceIds)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching atendimentos by telefone:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Mapear para o tipo Atendimento
  return data.map((atendimento: any) => ({
    id: atendimento.id,
    cliente_id: atendimento.cliente_id,
    cliente_nome: atendimento.clientes?.nome,
    cliente_foto_perfil: atendimento.clientes?.foto_perfil || undefined,
    telefone_cliente: atendimento.clientes?.telefone || telefoneCliente,
    telefone_usuario: atendimento.whatsapp_instances?.telefone || '',
    usuario_id: atendimento.usuario_id,
    status: (atendimento.status || 'aberto') as StatusAtendimento,
    created_at: atendimento.created_at,
    updated_at: atendimento.updated_at,
    resumo_conversa: atendimento.resumo_conversa || undefined,
  }));
}

/**
 * Cria um novo atendimento identificando o usuário pelo telefone
 * @param telefoneCliente - Telefone do cliente
 * @param clienteNome - Nome do cliente (opcional)
 * @param clienteId - ID do cliente (opcional)
 * @param userId - ID do usuário (opcional, se não fornecido busca do auth)
 */
export async function createAtendimento(
  telefoneCliente: string,
  clienteNome?: string,
  clienteId?: string,
  userId?: string
): Promise<Atendimento> {
  // Identificar qual instância WhatsApp está sendo usada
  const connectedInstances = await getConnectedInstances(userId);
  
  if (connectedInstances.length === 0) {
    throw new Error('Nenhuma instância WhatsApp conectada');
  }

  // Usar o primeiro telefone conectado (ou você pode passar como parâmetro)
  const whatsappInstanceId = connectedInstances[0].id;
  const usuarioId = connectedInstances[0].usuario_id;

  // Buscar ou criar cliente
  let finalClienteId = clienteId;
  if (!finalClienteId) {
    // Buscar cliente pelo telefone
    const { data: clienteExistente } = await supabase
      .from('clientes')
      .select('id')
      .eq('telefone', telefoneCliente)
      .single();

    if (clienteExistente) {
      finalClienteId = clienteExistente.id;
      // Atualizar nome se fornecido
      if (clienteNome) {
        await supabase
          .from('clientes')
          .update({ nome: clienteNome })
          .eq('id', finalClienteId);
      }
    } else {
      // Criar novo cliente
      const { data: novoCliente, error: clienteError } = await supabase
        .from('clientes')
        .insert({
          telefone: telefoneCliente,
          nome: clienteNome,
        })
        .select()
        .single();

      if (clienteError) {
        console.error('Error creating cliente:', clienteError);
        throw clienteError;
      }

      finalClienteId = novoCliente.id;
    }
  }

  // Criar atendimento
  const { data, error } = await supabase
    .from('atendimentos_solicitado')
    .insert({
      cliente_id: finalClienteId,
      whatsapp_instance_id: whatsappInstanceId,
      usuario_id: usuarioId,
    })
    .select(`
      *,
      clientes (
        nome,
        telefone,
        foto_perfil
      ),
      whatsapp_instances (
        telefone
      )
    `)
    .single();

  if (error) {
    console.error('Error creating atendimento:', error);
    throw error;
  }

  // Mapear para o tipo Atendimento
  return {
    id: data.id,
    cliente_id: data.cliente_id,
    cliente_nome: data.clientes?.nome || clienteNome,
    cliente_foto_perfil: data.clientes?.foto_perfil || undefined,
    telefone_cliente: data.clientes?.telefone || telefoneCliente,
    telefone_usuario: data.whatsapp_instances?.telefone || '',
    usuario_id: data.usuario_id,
    status: (data.status || 'aberto') as StatusAtendimento,
    created_at: data.created_at,
    updated_at: data.updated_at,
    resumo_conversa: data.resumo_conversa || undefined,
  };
}

export async function getAtendimentoById(id: string): Promise<Atendimento | null> {
  // Buscar atendimento com joins
  const { data, error } = await supabase
    .from('atendimentos_solicitado')
    .select(`
      *,
      clientes (
        nome,
        telefone
      ),
      whatsapp_instances (
        telefone
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching atendimento:', error);
    return null;
  }

  if (!data) {
    return null;
  }

  // Mapear para o tipo Atendimento
  return {
    id: data.id,
    cliente_id: data.cliente_id,
    cliente_nome: data.clientes?.nome,
    cliente_foto_perfil: data.clientes?.foto_perfil || undefined,
    telefone_cliente: data.clientes?.telefone || '',
    telefone_usuario: data.whatsapp_instances?.telefone || '',
    usuario_id: data.usuario_id,
    status: (data.status || 'aberto') as StatusAtendimento,
    created_at: data.created_at,
    updated_at: data.updated_at,
    resumo_conversa: data.resumo_conversa || undefined,
  };
}

/**
 * Busca estatísticas do dashboard
 * @param userId - ID do usuário (opcional, se não fornecido busca do auth)
 */
export async function getDashboardStats(userId?: string): Promise<DashboardStats> {
  // Buscar instâncias conectadas do usuário
  const connectedInstances = await getConnectedInstances(userId);
  const instanceIds = connectedInstances.map(inst => inst.id);

  if (instanceIds.length === 0) {
    return {
      totalAtendimentos: 0,
      atendimentosAbertos: 0,
      atendimentosEmAndamento: 0,
      atendimentosEncerrados: 0,
      totalMensagens: 0,
    };
  }

  // Buscar atendimentos usando whatsapp_instance_id
  const { data: atendimentos, error: atendimentosError } = await supabase
    .from('atendimentos_solicitado')
    .select('id')
    .in('whatsapp_instance_id', instanceIds);

  if (atendimentosError) {
    console.error('Error fetching atendimentos stats:', atendimentosError);
    throw atendimentosError;
  }

  const totalAtendimentos = atendimentos?.length || 0;

  // Como não há campo status, todos são considerados abertos

  const stats: DashboardStats = {
    totalAtendimentos,
    atendimentosAbertos: totalAtendimentos, // Todos são considerados abertos já que não há campo status
    atendimentosEmAndamento: 0,
    atendimentosEncerrados: 0,
    totalMensagens: 0, // Tabela mensagens não existe mais
  };

  return stats;
}

/**
 * Atualiza o status de um atendimento
 * @param atendimentoId - ID do atendimento
 * @param status - Novo status
 */
export async function updateAtendimentoStatus(
  atendimentoId: string,
  status: StatusAtendimento
): Promise<void> {
  const { error } = await supabase
    .from('atendimentos_solicitado')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', atendimentoId);

  if (error) {
    console.error('Error updating atendimento status:', error);
    throw error;
  }
}

/**
 * Busca atendimentos criados nas últimas 4 horas
 * @param userId - ID do usuário (opcional, se não fornecido busca do auth)
 */
export async function getAtendimentosRecentes(userId?: string): Promise<Atendimento[]> {
  // Primeiro, buscar as instâncias conectadas do usuário
  const connectedInstances = await getConnectedInstances(userId);
  const instanceIds = connectedInstances.map(inst => inst.id);

  if (instanceIds.length === 0) {
    return [];
  }

  // Calcular a data de 4 horas atrás
  const quatroHorasAtras = new Date();
  quatroHorasAtras.setHours(quatroHorasAtras.getHours() - 4);

  // Buscar atendimentos criados nas últimas 4 horas
  const { data: atendimentos, error: atendimentosError } = await supabase
    .from('atendimentos_solicitado')
    .select(`
      *,
      clientes (
        nome,
        telefone,
        foto_perfil
      ),
      whatsapp_instances (
        telefone
      )
    `)
    .in('whatsapp_instance_id', instanceIds)
    .gte('created_at', quatroHorasAtras.toISOString())
    .order('created_at', { ascending: false });

  if (atendimentosError) {
    console.error('Error fetching atendimentos recentes:', atendimentosError);
    throw atendimentosError;
  }

  if (!atendimentos || atendimentos.length === 0) {
    return [];
  }

  // Mapear para o tipo Atendimento
  return atendimentos.map((atendimento: any) => ({
    id: atendimento.id,
    cliente_id: atendimento.cliente_id,
    cliente_nome: atendimento.clientes?.nome,
    cliente_foto_perfil: atendimento.clientes?.foto_perfil || undefined,
    telefone_cliente: atendimento.clientes?.telefone || '',
    telefone_usuario: atendimento.whatsapp_instances?.telefone || '',
    usuario_id: atendimento.usuario_id,
    status: (atendimento.status || 'aberto') as StatusAtendimento,
    created_at: atendimento.created_at,
    updated_at: atendimento.updated_at,
    resumo_conversa: atendimento.resumo_conversa || undefined,
  }));
}

/**
 * Deleta um atendimento
 * @param atendimentoId - ID do atendimento
 */
export async function deleteAtendimento(atendimentoId: string): Promise<void> {
  // Verificar se o usuário está autenticado
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  // Verificar se o atendimento pertence ao usuário antes de deletar
  const { data: atendimento, error: fetchError } = await supabase
    .from('atendimentos_solicitado')
    .select('id, usuario_id')
    .eq('id', atendimentoId)
    .single();

  if (fetchError) {
    console.error('Error fetching atendimento for deletion:', fetchError);
    throw new Error('Erro ao verificar atendimento');
  }

  if (!atendimento) {
    throw new Error('Atendimento não encontrado');
  }

  if (atendimento.usuario_id !== user.id) {
    throw new Error('Você não tem permissão para excluir este atendimento');
  }

  // Deletar o atendimento
  const { error } = await supabase
    .from('atendimentos_solicitado')
    .delete()
    .eq('id', atendimentoId)
    .eq('usuario_id', user.id); // Garantir que só deleta se for do usuário

  if (error) {
    console.error('Error deleting atendimento:', error);
    throw error;
  }
}

