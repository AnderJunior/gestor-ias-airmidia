import { supabase } from '../supabaseClient';

export interface Usuario {
  id: string;
  nome: string | null;
  foto_perfil?: string | null;
  telefone_ia: string | null;
  tipo_marcacao?: 'atendimento' | 'agendamento' | 'administracao';
  tipo?: 'cliente' | 'administracao';
  fase?: 'teste' | 'producao';
  ativo?: boolean;
  admin_responsavel?: string | null;
  created_at: string;
  updated_at: string;
}

// Cache simples para evitar requisições duplicadas
const usuarioCache = new Map<string, { data: Usuario | null; timestamp: number }>();
const CACHE_DURATION = 60000; // 60 segundos (aumentado para reduzir requisições)

// Cache de requisições em andamento para evitar requisições simultâneas
const inFlightRequests = new Map<string, Promise<Usuario | null>>();

/**
 * Limpa o cache de um usuário específico ou de todos
 */
export function clearUsuarioCache(userId?: string) {
  if (userId) {
    usuarioCache.delete(userId);
    inFlightRequests.delete(userId);
  } else {
    usuarioCache.clear();
    inFlightRequests.clear();
  }
}

/**
 * Busca os dados do usuário logado
 * @param userId - ID do usuário (opcional, se não fornecido busca do auth)
 */
export async function getUsuario(userId?: string): Promise<Usuario | null> {
  let finalUserId = userId;
  
  // Se não forneceu userId, buscar do auth
  if (!finalUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return null;
    }
    finalUserId = user.id;
  }

  // Verificar se já existe uma requisição em andamento para este usuário
  const existingRequest = inFlightRequests.get(finalUserId);
  if (existingRequest) {
    return existingRequest;
  }

  // Verificar cache
  const cached = usuarioCache.get(finalUserId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  // Criar nova requisição
  const request = (async () => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', finalUserId)
        .single();

      if (error) {
        // Se o usuário não existe na tabela, retorna null
        if (error.code === 'PGRST116') {
          usuarioCache.set(finalUserId, { data: null, timestamp: Date.now() });
          return null;
        }
        console.error('Error fetching usuario:', error);
        throw error;
      }

      // Atualizar cache
      usuarioCache.set(finalUserId, { data, timestamp: Date.now() });

      return data;
    } finally {
      // Remover da lista de requisições em andamento
      inFlightRequests.delete(finalUserId);
    }
  })();

  // Adicionar à lista de requisições em andamento
  inFlightRequests.set(finalUserId, request);

  return request;
}

/**
 * Verifica se o usuário tem dados iniciais preenchidos
 * @param userId - ID do usuário (opcional, se não fornecido busca do auth)
 */
export async function verificarDadosIniciais(userId?: string): Promise<boolean> {
  const usuario = await getUsuario(userId);
  
  if (!usuario) {
    return false;
  }

  // Verifica se nome e telefone_ia estão preenchidos
  return !!(usuario.nome && usuario.telefone_ia);
}

/**
 * Cria ou atualiza os dados do usuário
 * @param nome - Nome do usuário
 * @param telefone_ia - Telefone da IA
 * @param userId - ID do usuário (opcional, se não fornecido busca do auth)
 */
export async function upsertUsuario(nome: string, telefone_ia: string, userId?: string): Promise<Usuario> {
  let finalUserId = userId;
  
  // Se não forneceu userId, buscar do auth
  if (!finalUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado');
    }
    finalUserId = user.id;
  }

  const { data, error } = await supabase
    .from('usuarios')
    .upsert({
      id: finalUserId,
      nome,
      telefone_ia,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id'
    })
    .select()
    .single();

  if (error) {
    console.error('Error upserting usuario:', error);
    throw error;
  }

  // Limpar cache após atualização
  if (finalUserId) {
    clearUsuarioCache(finalUserId);
  }

  return data;
}

/**
 * Atualiza apenas o nome do usuário
 * @param nome - Novo nome do usuário
 * @param userId - ID do usuário (opcional, se não fornecido busca do auth)
 */
export async function atualizarNomeUsuario(nome: string, userId?: string): Promise<Usuario> {
  let finalUserId = userId;
  
  // Se não forneceu userId, buscar do auth
  if (!finalUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado');
    }
    finalUserId = user.id;
  }

  // Buscar dados atuais do usuário para manter o telefone_ia
  const usuarioAtual = await getUsuario(finalUserId);
  if (!usuarioAtual) {
    throw new Error('Usuário não encontrado');
  }

  // Atualizar apenas o nome, mantendo o telefone_ia existente
  const { data, error } = await supabase
    .from('usuarios')
    .update({
      nome,
      updated_at: new Date().toISOString(),
    })
    .eq('id', finalUserId)
    .select()
    .single();

  if (error) {
    console.error('Error updating usuario nome:', error);
    throw error;
  }

  // Limpar cache após atualização
  if (finalUserId) {
    clearUsuarioCache(finalUserId);
  }

  return data;
}

/**
 * Busca todos os usuários (clientes) para administração
 * Exclui apenas usuários com tipo 'administracao'
 * Inclui clientes ativos e inativos
 */
export async function getAllUsuarios(): Promise<Usuario[]> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .neq('tipo', 'administracao')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching usuarios:', error);
    throw error;
  }

  return data || [];
}

/**
 * Busca estatísticas de clientes para administração
 */
export interface EstatisticasClientes {
  totalAtivos: number;
  totalTeste: number;
  totalProducao: number;
}

export async function getEstatisticasClientes(): Promise<EstatisticasClientes> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('fase, tipo')
    .neq('tipo', 'administracao')
    .eq('ativo', true);

  if (error) {
    console.error('Error fetching estatisticas:', error);
    throw error;
  }

  const usuarios = data || [];
  
  const totalAtivos = usuarios.length;
  const totalTeste = usuarios.filter(u => u.fase === 'teste').length;
  const totalProducao = usuarios.filter(u => u.fase === 'producao').length;

  return {
    totalAtivos,
    totalTeste,
    totalProducao,
  };
}

/**
 * Busca todos os usuários administradores
 */
export async function getAdministradores(): Promise<Usuario[]> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('tipo', 'administracao')
    .order('nome', { ascending: true });

  if (error) {
    console.error('Error fetching administradores:', error);
    throw error;
  }

  return data || [];
}

/**
 * Busca os dias na etapa atual para cada cliente.
 * Cálculo: data atual - entrou_em (registro mais recente onde fase_id = fase atual do cliente).
 * @param clientes - Lista de clientes com id e fase
 */
export async function getDiasNaEtapaAtualPorClientes(
  clientes: Array<{ id: string; fase?: string | null }>
): Promise<Record<string, number>> {
  if (!clientes.length) return {};

  const clienteIds = clientes.map((c) => c.id);
  const clientePorId = new Map(clientes.map((c) => [c.id, c]));

  const { data, error } = await supabase
    .from('usuarios_fase_historico')
    .select('usuario_id, fase_id, entrou_em')
    .in('usuario_id', clienteIds)
    .order('entrou_em', { ascending: false });

  if (error) {
    console.error('Erro ao buscar histórico de fases:', error);
    return {};
  }

  const agora = Date.now();
  const diasPorCliente: Record<string, number> = {};

  // Para cada cliente, usa o primeiro registro (mais recente) onde fase_id = fase atual
  const jaPreenchidos = new Set<string>();
  (data || []).forEach((reg) => {
    if (jaPreenchidos.has(reg.usuario_id)) return;
    const cliente = clientePorId.get(reg.usuario_id);
    if (!cliente) return;
    const faseAtual = cliente.fase ?? '';
    if (reg.fase_id !== faseAtual) return;

    jaPreenchidos.add(reg.usuario_id);
    const entrouEmMs = new Date(reg.entrou_em).getTime();
    const diffMs = Math.max(0, agora - entrouEmMs);
    const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    diasPorCliente[reg.usuario_id] = dias;
  });

  return diasPorCliente;
}

export interface HistoricoFaseItem {
  id: string;
  fase_id: string;
  entrou_em: string;
  alterado_por: string | null;
  alterado_por_nome: string | null;
  fase_anterior_id: string | null;
}

/**
 * Busca o histórico de mudanças de etapa de um cliente para exibir na área de mensagens.
 */
export async function getHistoricoFaseCliente(usuarioId: string): Promise<HistoricoFaseItem[]> {
  const { data, error } = await supabase
    .from('usuarios_fase_historico')
    .select('id, fase_id, entrou_em, alterado_por')
    .eq('usuario_id', usuarioId)
    .order('entrou_em', { ascending: true });

  if (error) {
    console.error('Erro ao buscar histórico de fases:', error);
    return [];
  }

  const registros = data || [];
  if (registros.length === 0) return [];

  const alteradoPorIds = [...new Set(registros.map((r) => r.alterado_por).filter(Boolean))] as string[];
  const nomesMap = new Map<string, string>();

  if (alteradoPorIds.length > 0) {
    const { data: usuarios } = await supabase
      .from('usuarios')
      .select('id, nome')
      .in('id', alteradoPorIds);

    (usuarios || []).forEach((u) => {
      nomesMap.set(u.id, u.nome || '');
    });
  }

  return registros.map((reg, index) => ({
    id: reg.id,
    fase_id: reg.fase_id,
    entrou_em: reg.entrou_em,
    alterado_por: reg.alterado_por,
    alterado_por_nome: reg.alterado_por ? nomesMap.get(reg.alterado_por) ?? null : null,
    fase_anterior_id: index > 0 ? registros[index - 1].fase_id : null,
  }));
}

