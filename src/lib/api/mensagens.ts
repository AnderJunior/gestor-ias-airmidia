import { supabase } from '../supabaseClient';
import { triggerWebhookCriarCliente } from './webhookTrigger';
import { getConnectedInstances } from './whatsapp';
import { Mensagem } from '@/types/domain';
import { getAtendimentoById } from './atendimentos';

/**
 * Interface para mensagem baseada na estrutura real da tabela
 */
export interface MensagemConversa {
  id?: string;
  cliente_id: string;
  usuario_id: string;
  mensagem: string;
  remetente: string;
  created_at?: string;
  data_e_hora?: string;
  base64_audio?: string | null;
  base64_imagem?: string | null;
  base64_documento?: string | null;
}

/**
 * Busca todas as mensagens de um cliente
 * @param clienteId - ID do cliente
 * @param userId - ID do usuário (opcional)
 */
export async function getMensagensByCliente(clienteId: string, userId?: string): Promise<MensagemConversa[]> {
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    userId = user.id;
  }

  // Buscar todas as mensagens do cliente com este usuário
  // Ordenar por data_e_hora se existir, senão usar created_at
  const { data: mensagens, error: mensagensError } = await supabase
    .from('mensagens')
    .select('*')
    .eq('cliente_id', clienteId)
    .eq('usuario_id', userId)
    .order('data_e_hora', { ascending: true });

  if (mensagensError) {
    // Se der erro por causa da coluna data_e_hora não existir, tentar com created_at
    if (mensagensError.message.includes('data_e_hora') || mensagensError.code === '42703') {
      const { data: mensagensRetry, error: errorRetry } = await supabase
        .from('mensagens')
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('usuario_id', userId)
        .order('created_at', { ascending: true });
      
      if (errorRetry) {
        console.error('Error fetching mensagens:', errorRetry);
        throw errorRetry;
      }
      
      return mensagensRetry || [];
    }
    
    console.error('Error fetching mensagens:', mensagensError);
    throw mensagensError;
  }

  return mensagens || [];
}

/**
 * Busca todas as mensagens de um atendimento
 * @param atendimentoId - ID do atendimento
 */
export async function getMensagensByAtendimento(atendimentoId: string): Promise<Mensagem[]> {
  // Buscar todas as mensagens do atendimento
  // Ordenar por data_e_hora se existir, senão usar created_at
  const { data: mensagens, error: mensagensError } = await supabase
    .from('mensagens')
    .select('*')
    .eq('atendimento_id', atendimentoId)
    .order('data_e_hora', { ascending: true });

  if (mensagensError) {
    // Se der erro por causa da coluna data_e_hora não existir, tentar com created_at
    if (mensagensError.message.includes('data_e_hora') || mensagensError.code === '42703') {
      const { data: mensagensRetry, error: errorRetry } = await supabase
        .from('mensagens')
        .select('*')
        .eq('atendimento_id', atendimentoId)
        .order('created_at', { ascending: true });
      
      if (errorRetry) {
        console.error('Error fetching mensagens by atendimento:', errorRetry);
        throw errorRetry;
      }
      
      return mensagensRetry || [];
    }
    
    console.error('Error fetching mensagens by atendimento:', mensagensError);
    throw mensagensError;
  }

  return mensagens || [];
}

/**
 * Interface para cliente com última mensagem
 */
export interface ClienteComConversa {
  id: string;
  nome: string;
  telefone: string;
  foto_perfil?: string;
  ultima_mensagem?: string;
  ultima_mensagem_at?: string;
  remetente_ultima_mensagem?: 'cliente' | 'usuario';
  atendimento_id?: string;
  ultima_mensagem_tipo?: 'audio' | 'imagem' | 'documento' | 'texto';
  ultima_mensagem_duracao_audio?: number; // Duração em segundos para áudio
}

/**
 * Busca clientes com suas últimas mensagens para exibir na lista de conversas
 * @param userId - ID do usuário (opcional)
 */
export async function getClientesComConversas(userId?: string): Promise<ClienteComConversa[]> {
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    userId = user.id;
  }

  // Buscar mensagens do usuário limitadas e ordenadas
  // Limitar a busca inicial para reduzir dados transferidos
  // Buscar apenas as mensagens mais recentes (últimas 1000 por cliente)
  let mensagens: any[] = [];
  let mensagensError: any = null;

  // Tentar primeiro com data_e_hora, limitando resultados
  const { data: mensagensData, error: error1 } = await supabase
    .from('mensagens')
    .select(`
      *,
      clientes (
        id,
        nome,
        telefone,
        foto_perfil
      )
    `)
    .eq('usuario_id', userId)
    .order('data_e_hora', { ascending: false })
    .limit(5000); // Limitar para evitar buscar todas as mensagens

  if (error1 && (error1.message.includes('data_e_hora') || error1.code === '42703')) {
    // Se data_e_hora não existe, tentar com created_at
    const { data: mensagensData2, error: error2 } = await supabase
      .from('mensagens')
      .select(`
        *,
        clientes (
          id,
          nome,
          telefone,
          foto_perfil
        )
      `)
      .eq('usuario_id', userId)
      .order('created_at', { ascending: false })
      .limit(5000); // Limitar para evitar buscar todas as mensagens
    
    if (error2) {
      console.error('Error fetching mensagens:', error2);
      throw error2;
    }
    
    mensagens = mensagensData2 || [];
  } else if (error1) {
    console.error('Error fetching mensagens:', error1);
    throw error1;
  } else {
    mensagens = mensagensData || [];
  }

  if (!mensagens || mensagens.length === 0) {
    return [];
  }

  // Agrupar por cliente e pegar a última mensagem
  const clientesMap = new Map<string, ClienteComConversa>();

  for (const mensagem of mensagens) {
    const mensagemData = mensagem as any;
    const cliente = mensagemData.clientes;

    if (!cliente) continue;

    const clienteId = cliente.id;
    const ultimaMensagem = mensagemData.mensagem;
    const remetenteRaw = mensagemData.remetente?.toLowerCase() || '';
    const remetente = remetenteRaw.includes('cliente') || remetenteRaw === 'cliente' ? 'cliente' : 'usuario';
    const dataMensagem = mensagemData.data_e_hora || mensagemData.created_at;

    // Verificar tipo da mensagem (áudio, imagem, documento)
    const base64AudioValido = mensagemData.base64_audio && 
      typeof mensagemData.base64_audio === 'string' &&
      mensagemData.base64_audio.trim() !== '' && 
      mensagemData.base64_audio.trim().toUpperCase() !== 'EMPTY';
    
    const base64ImagemValido = mensagemData.base64_imagem && 
      mensagemData.base64_imagem.trim() !== '' && 
      mensagemData.base64_imagem.trim().toUpperCase() !== 'EMPTY';
    
    const base64DocumentoValido = mensagemData.base64_documento && 
      typeof mensagemData.base64_documento === 'string' &&
      mensagemData.base64_documento.trim() !== '' && 
      mensagemData.base64_documento.trim().toUpperCase() !== 'EMPTY' &&
      mensagemData.base64_documento.trim().toUpperCase() !== 'NULL';

    let tipoMensagem: 'audio' | 'imagem' | 'documento' | 'texto' = 'texto';
    let duracaoAudio: number | undefined = undefined;

    if (base64AudioValido) {
      tipoMensagem = 'audio';
      // Tentar obter duração do áudio se disponível (pode estar em um campo separado ou precisar calcular)
      // Por enquanto, vamos deixar undefined e calcular no frontend se necessário
    } else if (base64ImagemValido) {
      tipoMensagem = 'imagem';
    } else if (base64DocumentoValido) {
      tipoMensagem = 'documento';
    }

    // Se já existe o cliente no map, verificar se esta mensagem é mais recente
    const clienteExistente = clientesMap.get(clienteId);
    
    if (!clienteExistente) {
      // Criar novo cliente no map
      clientesMap.set(clienteId, {
        id: cliente.id,
        nome: cliente.nome || cliente.telefone,
        telefone: cliente.telefone,
        foto_perfil: cliente.foto_perfil,
        ultima_mensagem: ultimaMensagem,
        ultima_mensagem_at: dataMensagem,
        remetente_ultima_mensagem: remetente,
        ultima_mensagem_tipo: tipoMensagem,
        ultima_mensagem_duracao_audio: duracaoAudio,
      });
    } else {
      // Comparar datas e atualizar se necessário
      const dataExistente = clienteExistente.ultima_mensagem_at || '';
      const dataNova = dataMensagem;

      if (dataNova > dataExistente) {
        clientesMap.set(clienteId, {
          ...clienteExistente,
          ultima_mensagem: ultimaMensagem || clienteExistente.ultima_mensagem,
          ultima_mensagem_at: dataNova,
          remetente_ultima_mensagem: remetente,
          ultima_mensagem_tipo: tipoMensagem,
          ultima_mensagem_duracao_audio: duracaoAudio,
        });
      }
    }
  }

  // Converter map para array e ordenar por data da última mensagem
  const clientes = Array.from(clientesMap.values()).sort((a, b) => {
    const dataA = a.ultima_mensagem_at || '';
    const dataB = b.ultima_mensagem_at || '';
    return dataB.localeCompare(dataA);
  });

  return clientes;
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
      return null;
    }
    clienteId = novoCliente.id;

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

