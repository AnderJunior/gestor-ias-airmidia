import { supabase } from '../supabaseClient';
import { createClient } from '@supabase/supabase-js';

export interface WebhookAcoes {
  tarefas?: string[];
  clientes?: string[];
}

export interface WebhookApi {
  id: string;
  usuario_id: string;
  nome: string;
  webhook_url: string;
  acoes: WebhookAcoes;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CriarWebhookInput {
  nome: string;
  webhook_url: string;
  acoes: WebhookAcoes;
  ativo?: boolean;
}

export interface AtualizarWebhookInput {
  nome?: string;
  webhook_url?: string;
  acoes?: WebhookAcoes;
  ativo?: boolean;
}

/**
 * Busca todos os webhooks do usuário logado
 */
export async function getWebhooks(): Promise<WebhookApi[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { data, error } = await supabase
    .from('webhooks_apis')
    .select('*')
    .eq('usuario_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching webhooks:', error);
    throw error;
  }

  return data || [];
}

/**
 * Busca um webhook por ID
 */
export async function getWebhookById(webhookId: string): Promise<WebhookApi | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { data, error } = await supabase
    .from('webhooks_apis')
    .select('*')
    .eq('id', webhookId)
    .eq('usuario_id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Não encontrado
    }
    console.error('Error fetching webhook:', error);
    throw error;
  }

  return data;
}

/**
 * Cria um novo webhook
 */
export async function criarWebhook(input: CriarWebhookInput): Promise<WebhookApi> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { data, error } = await supabase
    .from('webhooks_apis')
    .insert({
      usuario_id: user.id,
      nome: input.nome,
      webhook_url: input.webhook_url,
      acoes: input.acoes,
      ativo: input.ativo !== undefined ? input.ativo : true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating webhook:', error);
    throw error;
  }

  return data;
}

/**
 * Atualiza um webhook
 */
export async function atualizarWebhook(
  webhookId: string,
  input: AtualizarWebhookInput
): Promise<WebhookApi> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const updateData: any = {};
  if (input.nome !== undefined) updateData.nome = input.nome;
  if (input.webhook_url !== undefined) updateData.webhook_url = input.webhook_url;
  if (input.acoes !== undefined) updateData.acoes = input.acoes;
  if (input.ativo !== undefined) updateData.ativo = input.ativo;

  const { data, error } = await supabase
    .from('webhooks_apis')
    .update(updateData)
    .eq('id', webhookId)
    .eq('usuario_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating webhook:', error);
    throw error;
  }

  return data;
}

/**
 * Exclui um webhook
 */
export async function excluirWebhook(webhookId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const { error } = await supabase
    .from('webhooks_apis')
    .delete()
    .eq('id', webhookId)
    .eq('usuario_id', user.id);

  if (error) {
    console.error('Error deleting webhook:', error);
    throw error;
  }
}

/**
 * Busca webhooks ativos que devem ser acionados para uma ação específica
 * @param tipo - Tipo de entidade (tarefas, clientes, agendamentos, atendimentos)
 * @param acao - Ação realizada (criar, atualizar, excluir, etc.)
 * @param usuarioId - ID do usuário (opcional, se não fornecido busca do auth)
 */
export async function getWebhooksAtivosPorAcao(
  tipo: 'tarefas' | 'clientes',
  acao: string,
  usuarioId?: string
): Promise<WebhookApi[]> {
  let finalUsuarioId = usuarioId;
  let supabaseClient = supabase;

  // Se foi fornecido usuarioId, estamos no servidor - usar Supabase Admin
  if (finalUsuarioId) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (supabaseUrl && supabaseServiceRoleKey) {
      supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
    }
  } else {
    // Se não foi fornecido usuarioId, tentar buscar do auth (contexto do cliente)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('Nenhum usuário autenticado encontrado para buscar webhooks');
      return [];
    }
    finalUsuarioId = user.id;
  }

  if (!finalUsuarioId) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from('webhooks_apis')
    .select('*')
    .eq('usuario_id', finalUsuarioId)
    .eq('ativo', true);

  if (error) {
    console.error('Error fetching active webhooks:', error);
    return [];
  }

  if (!data) {
    return [];
  }

  // Filtrar webhooks que têm a ação específica configurada
  const webhooksFiltrados = data.filter((webhook) => {
    const acoes = webhook.acoes as WebhookAcoes;
    const acoesDoTipo = acoes[tipo] || [];
    return acoesDoTipo.includes(acao);
  });

  console.log(`Busca de webhooks - Tipo: ${tipo}, Ação: ${acao}, UsuarioId: ${finalUsuarioId}, Total encontrados: ${data.length}, Filtrados: ${webhooksFiltrados.length}`);

  return webhooksFiltrados;
}
