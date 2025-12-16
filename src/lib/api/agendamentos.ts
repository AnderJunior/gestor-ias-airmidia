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
    status: agendamento.status,
    created_at: agendamento.created_at,
    updated_at: agendamento.updated_at,
  }));
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

