import { supabase } from '../supabaseClient';
import { Mensagem } from '@/types/domain';
import { getAtendimentoById } from './atendimentos';

export async function getMensagensByAtendimento(atendimentoId: string): Promise<Mensagem[]> {
  const { data, error } = await supabase
    .from('mensagens')
    .select('*')
    .eq('atendimento_id', atendimentoId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching mensagens:', error);
    throw error;
  }

  return data || [];
}

/**
 * Cria uma mensagem identificando remetente e destinatário pelo atendimento
 */
export async function createMensagem(
  atendimentoId: string,
  conteudo: string,
  tipo: 'humano' | 'bot' = 'humano',
  messageId?: string
): Promise<Mensagem> {
  // Buscar informações do atendimento para identificar telefones
  const atendimento = await getAtendimentoById(atendimentoId);
  
  if (!atendimento) {
    throw new Error('Atendimento não encontrado');
  }

  // Determinar remetente e destinatário baseado no tipo
  const telefoneRemetente = tipo === 'bot' 
    ? atendimento.telefone_usuario 
    : atendimento.telefone_cliente;
  
  const telefoneDestinatario = tipo === 'bot'
    ? atendimento.telefone_cliente
    : atendimento.telefone_usuario;

  const { data, error } = await supabase
    .from('mensagens')
    .insert({
      atendimento_id: atendimentoId,
      conteudo,
      tipo,
      telefone_remetente: telefoneRemetente,
      telefone_destinatario: telefoneDestinatario,
      message_id: messageId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating mensagem:', error);
    throw error;
  }

  // Atualizar updated_at do atendimento
  await supabase
    .from('atendimentos_solicitado')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', atendimentoId);

  return data;
}

/**
 * Cria uma mensagem recebida da Evolution API
 * Identifica automaticamente o usuário pelo telefone_usuario
 */
export async function createMensagemFromEvolutionAPI(
  telefoneRemetente: string,
  telefoneDestinatario: string,
  conteudo: string,
  messageId: string
): Promise<Mensagem | null> {
  // Buscar cliente pelo telefone
  const { data: clienteExistente } = await supabase
    .from('clientes')
    .select('id')
    .eq('telefone', telefoneRemetente)
    .single();

  let clienteId: string;
  if (clienteExistente) {
    clienteId = clienteExistente.id;
  } else {
    const { data: novoCliente, error: clienteError } = await supabase
      .from('clientes')
      .insert({ telefone: telefoneRemetente })
      .select()
      .single();

    if (clienteError) {
      console.error('Error creating cliente:', clienteError);
      return null;
    }
    clienteId = novoCliente.id;
  }

  // Buscar instância WhatsApp pelo telefone
  const { data: whatsappInstance } = await supabase
    .from('whatsapp_instances')
    .select('id, usuario_id')
    .eq('telefone', telefoneDestinatario)
    .eq('status', 'conectado')
    .single();

  if (!whatsappInstance) {
    console.error('WhatsApp instance not found for telefone:', telefoneDestinatario);
    return null;
  }

  // Buscar atendimento existente para este cliente e instância
  const { data: atendimentoExistente } = await supabase
    .from('atendimentos_solicitado')
    .select('id')
    .eq('cliente_id', clienteId)
    .eq('whatsapp_instance_id', whatsappInstance.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  let atendimentoId: string;

  if (atendimentoExistente) {
    atendimentoId = atendimentoExistente.id;
  } else {
    // Criar novo atendimento
    const { data: novoAtendimento, error: atendimentoCreateError } = await supabase
      .from('atendimentos_solicitado')
      .insert({
        cliente_id: clienteId,
        whatsapp_instance_id: whatsappInstance.id,
        usuario_id: whatsappInstance.usuario_id,
      })
      .select()
      .single();

    if (atendimentoCreateError) {
      console.error('Error creating atendimento:', atendimentoCreateError);
      return null;
    }

    atendimentoId = novoAtendimento.id;
  }

  // Criar mensagem no atendimento
  return createMensagem(
    atendimentoId,
    conteudo,
    'humano',
    messageId
  );
}

