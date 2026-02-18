import { supabase } from '../supabaseClient';
import { triggerWebhookCriarCliente } from './webhookTrigger';
import { getConnectedInstances } from './whatsapp';
import { Mensagem } from '@/types/domain';
import { getAtendimentoById } from './atendimentos';

/** Tamanho máximo de IDs por requisição para evitar URL longa e 400 Bad Request */
const CHUNK_SIZE = 80;

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

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
 * Busca mensagens onde:
 * - usuario_id = usuário atual (direto na tabela mensagens OU através do atendimento)
 * - cliente_id = cliente da conversa (ou clientes com mesmo telefone)
 * @param clienteId - ID do cliente
 * @param userId - ID do usuário (opcional)
 */
export async function getMensagensByCliente(clienteId: string, userId?: string): Promise<MensagemConversa[]> {
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    userId = user.id;
  }

  // Primeiro, buscar o telefone do cliente
  const { data: cliente, error: clienteError } = await supabase
    .from('clientes')
    .select('telefone')
    .eq('id', clienteId)
    .single();

  if (clienteError || !cliente) {
    console.error('Error fetching cliente:', clienteError);
    return [];
  }

  // Buscar todos os clientes com o mesmo telefone
  const { data: clientesComMesmoTelefone, error: clientesError } = await supabase
    .from('clientes')
    .select('id')
    .eq('telefone', cliente.telefone);

  if (clientesError) {
    console.error('Error fetching clientes com mesmo telefone:', clientesError);
    return [];
  }

  const clienteIds = (clientesComMesmoTelefone?.map(c => c.id) || [clienteId]).filter(
    (id): id is string => typeof id === 'string' && id.length > 0
  );
  if (clienteIds.length === 0) return [];

  const clienteTelefone = cliente.telefone;

  /** Normaliza uma linha bruta da tabela mensagens para o formato esperado pela UI. */
  function normalizarMensagem(row: any): any {
    const clienteIdMsg = row.cliente_id || clienteId;
    const conteudo = row.mensagem ?? row.conteudo ?? '';
    let remetente = row.remetente;
    if (remetente == null || remetente === '') {
      const tipo = (row.tipo || '').toLowerCase();
      if (tipo === 'bot') remetente = 'assistente';
      else if (row.telefone_remetente === clienteTelefone) remetente = 'cliente';
      else remetente = 'humano';
    }
    return {
      ...row,
      cliente_id: clienteIdMsg,
      usuario_id: row.usuario_id || userId,
      mensagem: conteudo,
      remetente,
      data_e_hora: row.data_e_hora || row.created_at || '',
    };
  }

  // Buscar em lotes e em paralelo para não demorar minutos
  // Otimização: limitar a 50 mensagens por lote para evitar timeout e travamento do navegador
  // Ordenar por data decrescente (mais recentes primeiro) e depois inverter
  const chunksIds = chunk(clienteIds, CHUNK_SIZE);
  const promises = chunksIds.map((ids) =>
    supabase
      .from('mensagens')
      .select('*')
      .in('cliente_id', ids)
      .eq('usuario_id', userId)
      .order('data_e_hora', { ascending: false }) // Mais recentes primeiro
      .limit(50) // Limitar a 50 mensagens
  );
  const results = await Promise.all(promises);
  const todas: any[] = [];
  const chunksComErroDataHora: string[][] = [];

  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    if (res.error && res.error.code === '42703' && res.error.message?.includes('data_e_hora')) {
      chunksComErroDataHora.push(chunksIds[i]);
    } else if (!res.error && res.data) {
      // Inverter a ordem para ficar cronológico (mais antigo -> mais recente)
      const msgs = res.data.reverse().map((r: any) => normalizarMensagem(r));
      todas.push(...msgs);
    }
  }
  if (chunksComErroDataHora.length > 0) {
    const retries = await Promise.all(
      chunksComErroDataHora.map((ids) =>
        supabase
          .from('mensagens')
          .select('*')
          .in('cliente_id', ids)
          .eq('usuario_id', userId)
          .order('created_at', { ascending: false })
          .limit(50)
      )
    );
    for (const r of retries) {
      if (!r.error && r.data) {
        // Inverter a ordem para ficar cronológico
        const msgs = r.data.reverse().map((row: any) => normalizarMensagem(row));
        todas.push(...msgs);
      }
    }
  }

  const mensagensUnicas = Array.from(new Map(todas.map((msg) => [msg.id, msg])).values());
  return mensagensUnicas.sort((a, b) => {
    const dataA = a.data_e_hora || a.created_at || '';
    const dataB = b.data_e_hora || b.created_at || '';
    return dataA.localeCompare(dataB);
  });
}

/**
 * Busca todas as mensagens de um atendimento.
 * A tabela mensagens não tem atendimento_id; busca por cliente_id do atendimento.
 */
export async function getMensagensByAtendimento(atendimentoId: string): Promise<Mensagem[]> {
  const atendimento = await getAtendimentoById(atendimentoId);
  if (!atendimento?.cliente_id || !atendimento?.usuario_id) return [];
  const lista = await getMensagensByCliente(atendimento.cliente_id, atendimento.usuario_id);
  return lista as unknown as Mensagem[];
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
  atendimento_atual?: 'ia' | 'humano' | 'pausa';
}

/**
 * Busca clientes com suas últimas mensagens para exibir na lista de conversas
 * Mostra todos os clientes que têm o mesmo telefone dos clientes do usuário atual,
 * mesmo que alguns tenham usuario_id diferente
 * @param userId - ID do usuário (opcional)
 */
export async function getClientesComConversas(userId?: string): Promise<ClienteComConversa[]> {
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    userId = user.id;
  }

  // Primeiro, buscar todos os clientes do usuário para obter seus telefones
  const { data: clientesDoUsuario, error: clientesError } = await supabase
    .from('clientes')
    .select('id, telefone, nome, foto_perfil, atendimento_atual, usuario_id')
    .eq('usuario_id', userId);

  if (clientesError) {
    console.error('Error fetching clientes:', clientesError);
    throw clientesError;
  }

  if (!clientesDoUsuario || clientesDoUsuario.length === 0) {
    return [];
  }

  // Obter todos os telefones únicos dos clientes do usuário
  const telefonesDoUsuario = [...new Set(clientesDoUsuario.map(c => c.telefone))];

  // Buscar TODOS os clientes que têm os mesmos telefones (mesmo que tenham usuario_id diferente)
  // Isso permite que o usuário veja clientes mesmo que tenham sido criados para outro usuario_id
  const { data: todosClientesComTelefone, error: clientesTelefoneError } = await supabase
    .from('clientes')
    .select('id, telefone, nome, foto_perfil, atendimento_atual, usuario_id')
    .in('telefone', telefonesDoUsuario);

  if (clientesTelefoneError) {
    console.error('Error fetching clientes by telefone:', clientesTelefoneError);
    throw clientesTelefoneError;
  }

  if (!todosClientesComTelefone || todosClientesComTelefone.length === 0) {
    return [];
  }

  const clienteIds = todosClientesComTelefone.map(c => c.id);

  // Buscar atendimentos em lotes e em paralelo
  const clienteIdsSet = new Set(clienteIds);
  const atendChunks = chunk(clienteIds, CHUNK_SIZE);
  const atendPromises = atendChunks.map((ids) =>
    supabase.from('atendimentos_solicitado').select('id, cliente_id').in('cliente_id', ids)
  );
  const atendResults = await Promise.all(atendPromises);
  let atendimentosData: { id: string; cliente_id?: string }[] = [];
  for (const res of atendResults) {
    if (!res.error && res.data) {
      atendimentosData.push(...(res.data as { id: string; cliente_id?: string }[]));
    }
  }
  if (atendimentosData.length === 0 && clienteIds.length > 0) {
    const resAll = await supabase
      .from('atendimentos_solicitado')
      .select('id, cliente_id')
      .eq('usuario_id', userId);
    if (!resAll.error && resAll.data) {
      atendimentosData = (resAll.data as { id: string; cliente_id?: string }[]).filter(
        (a) => a.cliente_id && clienteIdsSet.has(a.cliente_id)
      );
    }
  }

  // Criar mapa de cliente_id -> dados do cliente (priorizando o do usuário atual)
  const clientesMap = new Map<string, typeof todosClientesComTelefone[0]>();
  for (const cliente of todosClientesComTelefone) {
    const existente = clientesMap.get(cliente.id);
    // Priorizar cliente do usuário atual
    if (!existente || cliente.usuario_id === userId) {
      clientesMap.set(cliente.id, cliente);
    }
  }

  // Criar mapa de telefone -> cliente do usuário para priorizar
  const clienteDoUsuarioPorTelefone = new Map<string, typeof clientesDoUsuario[0]>();
  for (const cliente of clientesDoUsuario) {
    clienteDoUsuarioPorTelefone.set(cliente.telefone, cliente);
  }

  // Agrupar mensagens por telefone e pegar a última mensagem de cada telefone
  const conversasPorTelefone = new Map<string, ClienteComConversa>();

  // Primeiro, adicionar todos os clientes do usuário (mesmo sem mensagens)
  for (const cliente of clientesDoUsuario) {
    conversasPorTelefone.set(cliente.telefone, {
      id: cliente.id,
      nome: cliente.nome || cliente.telefone,
      telefone: cliente.telefone,
      foto_perfil: cliente.foto_perfil,
      atendimento_atual: cliente.atendimento_atual || 'ia',
    });
  }

  // Mensagens em lotes e em paralelo para carregar rápido
  let mensagens: any[] = [];
  const msgChunks = chunk(clienteIds, CHUNK_SIZE);
  try {
    const msgPromises = msgChunks.map((ids) =>
      supabase
        .from('mensagens')
        .select(`
          id,
          cliente_id,
          usuario_id,
          mensagem,
          remetente,
          data_e_hora,
          created_at
        `) // Selecionar campos específicos para evitar carregar base64
        .in('cliente_id', ids)
        .eq('usuario_id', userId)
        .order('data_e_hora', { ascending: false })
        .limit(10) // Reduzido de 5000 para 10, pois só precisamos da última
    );
    const msgResults = await Promise.all(msgPromises);
    const chunksRetry: string[][] = [];
    for (let i = 0; i < msgResults.length; i++) {
      const res = msgResults[i];
      if (res.error && res.error.code === '42703' && res.error.message?.includes('data_e_hora')) {
        chunksRetry.push(msgChunks[i]);
      } else if (res.data) {
        mensagens.push(...res.data);
      }
    }
    if (chunksRetry.length > 0) {
      const retries = await Promise.all(
        chunksRetry.map((ids) =>
          supabase
            .from('mensagens')
            .select(`
              id,
              cliente_id,
              usuario_id,
              mensagem,
              remetente,
              data_e_hora,
              created_at
            `)
            .in('cliente_id', ids)
            .eq('usuario_id', userId)
            .order('created_at', { ascending: false })
            .limit(10)
        )
      );
      for (const r of retries) {
        if (r.data) mensagens.push(...r.data);
      }
    }
  } catch (err) {
    console.log('Busca de mensagens falhou:', err);
  }

  // Processar mensagens e atualizar conversas (mesmo que não haja atendimentos, se houver mensagens diretas)
  if (mensagens.length > 0) {
    for (const mensagem of mensagens) {
      const mensagemData = mensagem as any;

      // Obter cliente_id: pode vir diretamente da mensagem ou através do atendimento
      let clienteId = mensagemData.cliente_id;
      if (!clienteId) {
        const atendimento = mensagemData.atendimentos_solicitado;
        clienteId = atendimento?.cliente_id;
      }

      if (!clienteId) continue;

      const cliente = clientesMap.get(clienteId);
      if (!cliente || !cliente.telefone) continue;

      const telefone = cliente.telefone;
      const ultimaMensagem = mensagemData.mensagem || mensagemData.conteudo;
      const remetenteRaw = mensagemData.remetente?.toLowerCase() || '';
      const remetente = remetenteRaw.includes('cliente') || remetenteRaw === 'cliente' ? 'cliente' : 'usuario';
      const dataMensagem = mensagemData.data_e_hora || mensagemData.created_at;

      // Verificar tipo da mensagem
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
      } else if (base64ImagemValido) {
        tipoMensagem = 'imagem';
      } else if (base64DocumentoValido) {
        tipoMensagem = 'documento';
      }

      const clienteDoUsuario = clienteDoUsuarioPorTelefone.get(telefone);
      const clienteIdParaUsar = clienteDoUsuario?.id || cliente.id;
      const conversaExistente = conversasPorTelefone.get(telefone);

      if (!conversaExistente) {
        // Criar nova conversa
        const clienteFinal = clienteDoUsuario || cliente;
        conversasPorTelefone.set(telefone, {
          id: clienteIdParaUsar,
          nome: clienteFinal.nome || clienteFinal.telefone,
          telefone: telefone,
          foto_perfil: clienteFinal.foto_perfil,
          ultima_mensagem: ultimaMensagem,
          ultima_mensagem_at: dataMensagem,
          remetente_ultima_mensagem: remetente,
          ultima_mensagem_tipo: tipoMensagem,
          ultima_mensagem_duracao_audio: duracaoAudio,
          atendimento_atual: clienteFinal.atendimento_atual || cliente.atendimento_atual || 'ia',
        });
      } else {
        // Comparar datas e atualizar se necessário
        const dataExistente = conversaExistente.ultima_mensagem_at || '';
        const dataNova = dataMensagem;

        if (dataNova > dataExistente) {
          const clienteFinal = clienteDoUsuario || cliente;
          conversasPorTelefone.set(telefone, {
            ...conversaExistente,
            id: clienteIdParaUsar, // Garantir que usa o cliente_id do usuário
            nome: clienteFinal.nome || clienteFinal.telefone,
            foto_perfil: clienteFinal.foto_perfil || conversaExistente.foto_perfil,
            ultima_mensagem: ultimaMensagem || conversaExistente.ultima_mensagem,
            ultima_mensagem_at: dataNova,
            remetente_ultima_mensagem: remetente,
            ultima_mensagem_tipo: tipoMensagem,
            ultima_mensagem_duracao_audio: duracaoAudio,
            atendimento_atual: clienteFinal.atendimento_atual || cliente.atendimento_atual || conversaExistente.atendimento_atual || 'ia',
          });
        } else {
          // Atualizar atendimento_atual mesmo se não for a mensagem mais recente
          const clienteFinal = clienteDoUsuario || cliente;
          if (clienteFinal.atendimento_atual || cliente.atendimento_atual) {
            conversasPorTelefone.set(telefone, {
              ...conversaExistente,
              id: clienteIdParaUsar,
              atendimento_atual: clienteFinal.atendimento_atual || cliente.atendimento_atual || conversaExistente.atendimento_atual || 'ia',
            });
          }
        }
      }
    }
  }

  // Converter map para array e ordenar por data da última mensagem
  const clientes = Array.from(conversasPorTelefone.values()).sort((a, b) => {
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

