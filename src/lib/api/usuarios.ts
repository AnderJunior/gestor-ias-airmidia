import { supabase } from '../supabaseClient';

export interface Usuario {
  id: string;
  nome: string | null;
  telefone_ia: string | null;
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

