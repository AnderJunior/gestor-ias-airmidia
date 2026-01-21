import { supabase } from '../supabaseClient';
import { Atendimento, DashboardStats, StatusAtendimento } from '@/types/domain';
import { getConnectedInstances } from './whatsapp';
import { triggerWebhookCriarCliente } from './webhookTrigger';

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
        .select(`
          *,
          usuarios:usuario_id(
            id,
            nome,
            telefone_ia
          )
        `)
        .single();

      if (clienteError) {
        console.error('Error creating cliente:', clienteError);
        throw clienteError;
      }

      finalClienteId = novoCliente.id;

      // Acionar webhook de criação de cliente
      // Usar o usuario_id do cliente criado (dono da instância WhatsApp) para buscar webhooks
      triggerWebhookCriarCliente({
        id: novoCliente.id,
        nome: novoCliente.nome || '',
        telefone: novoCliente.telefone || '',
        foto_perfil: novoCliente.foto_perfil || undefined,
        usuario_id: novoCliente.usuario_id,
        created_at: novoCliente.created_at,
        updated_at: novoCliente.updated_at,
        usuario: (novoCliente as any).usuarios ? {
          id: (novoCliente as any).usuarios.id,
          nome: (novoCliente as any).usuarios.nome,
          telefone_ia: (novoCliente as any).usuarios.telefone_ia,
        } : undefined,
      }, novoCliente.usuario_id).catch((err) => {
        console.error('Erro ao acionar webhook criar_cliente:', err);
      });
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

/**
 * Busca atendimento por cliente_id e usuario_id
 * @param clienteId - ID do cliente
 * @param userId - ID do usuário
 */
export async function getAtendimentoByCliente(clienteId: string, userId?: string): Promise<Atendimento | null> {
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    userId = user.id;
  }

  const connectedInstances = await getConnectedInstances(userId);
  const instanceIds = connectedInstances.map(inst => inst.id);

  if (instanceIds.length === 0) {
    return null;
  }

  // Buscar atendimento mais recente do cliente
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
    .eq('cliente_id', clienteId)
    .eq('usuario_id', userId)
    .in('whatsapp_instance_id', instanceIds)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

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
 * Busca todos os atendimentos de um cliente
 * @param clienteId - ID do cliente
 * @param userId - ID do usuário (opcional)
 */
export async function getAllAtendimentosByCliente(clienteId: string, userId?: string): Promise<Atendimento[]> {
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    userId = user.id;
  }

  const connectedInstances = await getConnectedInstances(userId);
  const instanceIds = connectedInstances.map(inst => inst.id);

  if (instanceIds.length === 0) {
    return [];
  }

  // Buscar todos os atendimentos do cliente
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
    .eq('cliente_id', clienteId)
    .eq('usuario_id', userId)
    .in('whatsapp_instance_id', instanceIds)
    .order('updated_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((atendimento: any) => ({
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
 * Busca quantidade de atendimentos por mês
 * @param userId - ID do usuário (opcional, se não fornecido busca do auth)
 * @param months - Número de meses para buscar (padrão: 6)
 */
export async function getAtendimentosPorMes(userId?: string, months: number = 6): Promise<Array<{ mes: string; quantidade: number }>> {
  // Buscar instâncias conectadas do usuário
  const connectedInstances = await getConnectedInstances(userId);
  const instanceIds = connectedInstances.map(inst => inst.id);

  if (instanceIds.length === 0) {
    return [];
  }

  // Calcular data inicial (meses atrás)
  const dataInicial = new Date();
  dataInicial.setMonth(dataInicial.getMonth() - months);
  dataInicial.setDate(1);
  dataInicial.setHours(0, 0, 0, 0);

  // Buscar atendimentos agrupados por mês
  const { data: atendimentos, error } = await supabase
    .from('atendimentos_solicitado')
    .select('created_at')
    .in('whatsapp_instance_id', instanceIds)
    .gte('created_at', dataInicial.toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching atendimentos por mês:', error);
    throw error;
  }

  if (!atendimentos || atendimentos.length === 0) {
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

  // Contar atendimentos por mês
  atendimentos.forEach((atendimento: any) => {
    const data = new Date(atendimento.created_at);
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
    .select('id, status')
    .in('whatsapp_instance_id', instanceIds);

  if (atendimentosError) {
    console.error('Error fetching atendimentos stats:', atendimentosError);
    throw atendimentosError;
  }

  const totalAtendimentos = atendimentos?.length || 0;
  
  // Contar atendimentos por status
  const atendimentosEmAndamento = atendimentos?.filter(
    (a: any) => a.status === 'em_andamento'
  ).length || 0;
  
  const atendimentosAbertos = atendimentos?.filter(
    (a: any) => a.status === 'aberto' || !a.status
  ).length || 0;
  
  const atendimentosEncerrados = atendimentos?.filter(
    (a: any) => a.status === 'encerrado'
  ).length || 0;

  const stats: DashboardStats = {
    totalAtendimentos,
    atendimentosAbertos,
    atendimentosEmAndamento,
    atendimentosEncerrados,
    totalMensagens: 0, // Tabela mensagens não existe mais
  };

  return stats;
}

/**
 * Busca os 5 atendimentos mais recentes (últimos cadastrados)
 * @param userId - ID do usuário (opcional, se não fornecido busca do auth)
 * @param limit - Número de atendimentos a retornar (padrão: 5)
 */
export async function getAtendimentosRecentes(userId?: string, limit: number = 5): Promise<Atendimento[]> {
  // Buscar instâncias conectadas do usuário
  const connectedInstances = await getConnectedInstances(userId);
  const instanceIds = connectedInstances.map(inst => inst.id);

  if (instanceIds.length === 0) {
    return [];
  }

  // Buscar atendimentos ordenados por created_at (mais recentes primeiro)
  const { data: atendimentos, error } = await supabase
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
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching atendimentos recentes:', error);
    throw error;
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

