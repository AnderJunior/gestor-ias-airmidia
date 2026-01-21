import { getWebhooksAtivosPorAcao } from './webhooks';
import { supabase } from '../supabaseClient';

export interface WebhookPayload {
  action: string;
  entity_type: 'tarefas' | 'clientes';
  timestamp: string;
  data: any;
}

/**
 * Aciona webhooks ativos para uma ação específica
 * @param tipo - Tipo de entidade (tarefas, clientes)
 * @param acao - Ação realizada (criar, atualizar, excluir, etc.)
 * @param dados - Dados a serem enviados no webhook
 * @param usuarioId - ID do usuário (opcional, se não fornecido busca do auth)
 */
export async function triggerWebhook(
  tipo: 'tarefas' | 'clientes',
  acao: string,
  dados: any,
  usuarioId?: string
): Promise<void> {
  try {
    // Buscar webhooks ativos para esta ação
    const webhooks = await getWebhooksAtivosPorAcao(tipo, acao, usuarioId);

    if (webhooks.length === 0) {
      console.log(`Nenhum webhook ativo encontrado para ação: ${acao} do tipo: ${tipo}`);
      return; // Nenhum webhook configurado para esta ação
    }

    console.log(`Encontrados ${webhooks.length} webhook(s) ativo(s) para ação: ${acao} do tipo: ${tipo}`);

    // Preparar payload
    const payload: WebhookPayload = {
      action: acao,
      entity_type: tipo,
      timestamp: new Date().toISOString(),
      data: dados,
    };

    // No cliente (navegador), usar a API como proxy para evitar CORS ao chamar webhooks externos (ex: N8N)
    const isClient = typeof window !== 'undefined';
    let authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (isClient) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        authHeaders['Authorization'] = `Bearer ${session.access_token}`;
      }
    }

    // Acionar todos os webhooks em paralelo
    const promises = webhooks.map(async (webhook) => {
      try {
        console.log(`Enviando webhook para ${webhook.nome} (${webhook.webhook_url})`);

        let response: Response;
        if (isClient) {
          // Cliente: proxy via API do Next.js (evita CORS)
          response = await fetch('/api/webhooks/disparar', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ url: webhook.webhook_url, payload }),
          });
        } else {
          // Servidor: fetch direto (não sofre CORS)
          response = await fetch(webhook.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }

        if (!response.ok) {
          const resData = isClient ? await response.json().catch(() => ({})) : null;
          console.error(`Erro ao acionar webhook ${webhook.nome}:`, {
            status: response.status,
            statusText: response.statusText,
            url: webhook.webhook_url,
            ...(resData && { detail: resData }),
          });
        } else {
          console.log(`Webhook ${webhook.nome} acionado com sucesso`);
        }
      } catch (error) {
        console.error(`Erro ao acionar webhook ${webhook.nome}:`, error);
        // Não lançar erro para não interromper o fluxo principal
      }
    });

    // Executar em paralelo e aguardar conclusão
    await Promise.all(promises);
  } catch (error) {
    console.error('Erro ao buscar webhooks:', error);
    // Não lançar erro para não interromper o fluxo principal
  }
}

/**
 * Aciona webhook quando uma tarefa é criada
 */
export async function triggerWebhookCriarTarefa(dados: {
  id: string;
  cliente_id: string;
  nome: string;
  status: string;
  data_vencimento?: string | null;
  responsavel_id?: string | null;
  created_at: string;
  updated_at: string;
  cliente?: {
    id: string;
    nome: string;
    telefone: string;
  };
  responsavel?: {
    id: string;
    nome: string | null;
  } | null;
}): Promise<void> {
  await triggerWebhook('tarefas', 'criar_tarefa', dados);
}

/**
 * Aciona webhook quando o status de uma tarefa é atualizado
 */
export async function triggerWebhookAtualizarStatusTarefa(dados: {
  id: string;
  cliente_id: string;
  nome: string;
  status_anterior: string;
  status_novo: string;
  data_vencimento?: string | null;
  responsavel_id?: string | null;
  updated_at: string;
  cliente?: {
    id: string;
    nome: string;
    telefone: string;
  };
  responsavel?: {
    id: string;
    nome: string | null;
  } | null;
}): Promise<void> {
  await triggerWebhook('tarefas', 'atualizar_status_tarefa', dados);
}

/**
 * Aciona webhook quando o nome de uma tarefa é atualizado
 */
export async function triggerWebhookAtualizarNomeTarefa(dados: {
  id: string;
  cliente_id: string;
  nome_anterior: string;
  nome_novo: string;
  status: string;
  data_vencimento?: string | null;
  responsavel_id?: string | null;
  updated_at: string;
  cliente?: {
    id: string;
    nome: string;
    telefone: string;
  };
  responsavel?: {
    id: string;
    nome: string | null;
  } | null;
}): Promise<void> {
  await triggerWebhook('tarefas', 'atualizar_nome_tarefa', dados);
}

/**
 * Aciona webhook quando a data de vencimento de uma tarefa é atualizada
 */
export async function triggerWebhookAtualizarDataVencimentoTarefa(dados: {
  id: string;
  cliente_id: string;
  nome: string;
  status: string;
  data_vencimento_anterior?: string | null;
  data_vencimento_nova?: string | null;
  responsavel_id?: string | null;
  updated_at: string;
  cliente?: {
    id: string;
    nome: string;
    telefone: string;
  };
  responsavel?: {
    id: string;
    nome: string | null;
  } | null;
}): Promise<void> {
  await triggerWebhook('tarefas', 'atualizar_data_vencimento_tarefa', dados);
}

/**
 * Aciona webhook quando uma tarefa é excluída
 */
export async function triggerWebhookExcluirTarefa(dados: {
  id: string;
  cliente_id: string;
  nome: string;
  status: string;
  data_vencimento?: string | null;
  responsavel_id?: string | null;
  cliente?: {
    id: string;
    nome: string;
    telefone: string;
  };
  responsavel?: {
    id: string;
    nome: string | null;
  } | null;
}): Promise<void> {
  await triggerWebhook('tarefas', 'excluir_tarefa', dados);
}

/**
 * Aciona webhook quando um novo responsável é atribuído a uma tarefa
 */
export async function triggerWebhookAtribuicaoNovoResponsavelTarefa(dados: {
  id: string;
  cliente_id: string;
  nome: string;
  status: string;
  responsavel_anterior_id?: string | null;
  responsavel_anterior_nome?: string | null;
  responsavel_novo_id: string;
  responsavel_novo_nome: string;
  data_vencimento?: string | null;
  updated_at: string;
  cliente?: {
    id: string;
    nome: string;
    telefone: string;
  };
}): Promise<void> {
  await triggerWebhook('tarefas', 'atribuicao_novo_responsavel', dados);
}

/**
 * Aciona webhook quando um cliente é criado
 * @param dados - Dados do cliente criado
 * @param usuarioId - ID do usuário que criou o cliente (opcional, se não fornecido busca do auth)
 */
export async function triggerWebhookCriarCliente(
  dados: {
    id: string;
    nome: string;
    telefone: string;
    foto_perfil?: string;
    usuario_id: string;
    created_at: string;
    updated_at: string;
    usuario?: {
      id: string;
      nome: string | null;
      telefone_ia: string | null;
    };
  },
  usuarioId?: string
): Promise<void> {
  // Se não foi fornecido usuarioId, usar o usuario_id dos dados (admin que criou)
  await triggerWebhook('clientes', 'criar_cliente', dados, usuarioId || dados.usuario_id);
}

/**
 * Aciona webhook quando o status de um cliente é atualizado (mudança de etapa no kanban)
 * @param dados - Dados do cliente atualizado
 * @param usuarioId - ID do usuário que atualizou o cliente (opcional, se não fornecido busca do auth)
 */
export async function triggerWebhookAtualizarStatusCliente(
  dados: {
    id: string;
    nome: string;
    telefone: string;
    etapa_anterior?: string | null;
    etapa_anterior_id?: string | null;
    etapa_nova: string;
    etapa_nova_id: string;
    usuario_id: string;
    updated_at: string;
    usuario?: {
      id: string;
      nome: string | null;
      telefone_ia: string | null;
    };
  },
  usuarioId?: string
): Promise<void> {
  await triggerWebhook('clientes', 'atualizar_status_cliente', dados, usuarioId || dados.usuario_id);
}

/**
 * Aciona webhook quando um cliente é excluído
 * @param dados - Dados do cliente excluído
 * @param usuarioId - ID do usuário que excluiu o cliente (opcional, se não fornecido busca do auth)
 */
export async function triggerWebhookExcluirCliente(
  dados: {
    id: string;
    nome: string;
    telefone: string;
    foto_perfil?: string;
    usuario_id: string;
    etapa_atual?: string | null;
    etapa_atual_id?: string | null;
  },
  usuarioId?: string
): Promise<void> {
  await triggerWebhook('clientes', 'excluir_cliente', dados, usuarioId || dados.usuario_id);
}

/**
 * Aciona webhook quando um cliente é desativado
 * @param dados - Dados do cliente desativado
 * @param usuarioId - ID do usuário que desativou o cliente (opcional, se não fornecido busca do auth)
 */
export async function triggerWebhookDesativarCliente(
  dados: {
    id: string;
    nome: string;
    telefone: string;
    foto_perfil?: string;
    usuario_id: string;
    etapa_atual?: string | null;
    etapa_atual_id?: string | null;
    updated_at: string;
    usuario?: {
      id: string;
      nome: string | null;
      telefone_ia: string | null;
    };
  },
  usuarioId?: string
): Promise<void> {
  await triggerWebhook('clientes', 'desativar_cliente', dados, usuarioId || dados.usuario_id);
}

/**
 * Aciona webhook quando um cliente é ativado ou desativado
 * @param dados - Dados do cliente com status atualizado
 * @param usuarioId - ID do usuário que ativou/desativou o cliente (opcional, se não fornecido busca do auth)
 */
export async function triggerWebhookAtivarDesativarCliente(
  dados: {
    id: string;
    nome: string;
    telefone: string;
    foto_perfil?: string;
    usuario_id: string;
    etapa_atual?: string | null;
    etapa_atual_id?: string | null;
    ativo: boolean;
    updated_at: string;
    usuario?: {
      id: string;
      nome: string | null;
      telefone_ia: string | null;
    };
  },
  usuarioId?: string
): Promise<void> {
  await triggerWebhook('clientes', 'ativar_desativar_cliente', dados, usuarioId || dados.usuario_id);
}


/**
 * Aciona webhook quando um novo responsável é atribuído a um cliente
 * @param dados - Dados do cliente com novo responsável
 * @param usuarioId - ID do usuário que atribuiu o responsável (opcional, se não fornecido busca do auth)
 */
export async function triggerWebhookAtribuicaoNovoResponsavelCliente(
  dados: {
    id: string;
    nome: string;
    telefone: string;
    responsavel_anterior_id?: string | null;
    responsavel_anterior_nome?: string | null;
    responsavel_novo_id: string;
    responsavel_novo_nome: string;
    usuario_id: string;
    updated_at: string;
    usuario?: {
      id: string;
      nome: string | null;
      telefone_ia: string | null;
    };
  },
  usuarioId?: string
): Promise<void> {
  await triggerWebhook('clientes', 'atribuicao_novo_responsavel', dados, usuarioId || dados.usuario_id);
}
