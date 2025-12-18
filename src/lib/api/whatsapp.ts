import { supabase } from '../supabaseClient';
import { WhatsAppInstance, StatusWhatsAppInstance } from '@/types/domain';

// Cache para whatsapp_instances
const instancesCache = new Map<string, { data: WhatsAppInstance[]; timestamp: number }>();
const connectedInstancesCache = new Map<string, { data: WhatsAppInstance[]; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 segundos

// Cache de requisições em andamento
const inFlightInstancesRequests = new Map<string, Promise<WhatsAppInstance[]>>();
const inFlightConnectedRequests = new Map<string, Promise<WhatsAppInstance[]>>();

/**
 * Limpa o cache de instâncias
 */
export function clearInstancesCache(userId?: string) {
  if (userId) {
    instancesCache.delete(userId);
    connectedInstancesCache.delete(userId);
    inFlightInstancesRequests.delete(userId);
    inFlightConnectedRequests.delete(userId);
  } else {
    instancesCache.clear();
    connectedInstancesCache.clear();
    inFlightInstancesRequests.clear();
    inFlightConnectedRequests.clear();
  }
}

/**
 * Busca todas as instâncias WhatsApp do usuário logado
 * @param userId - ID do usuário (opcional, se não fornecido busca do auth)
 */
export async function getWhatsAppInstances(userId?: string): Promise<WhatsAppInstance[]> {
  let finalUserId = userId;
  
  // Se não forneceu userId, buscar do auth
  if (!finalUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return [];
    }
    finalUserId = user.id;
  }

  // Verificar se já existe uma requisição em andamento
  const existingRequest = inFlightInstancesRequests.get(finalUserId);
  if (existingRequest) {
    return existingRequest;
  }

  // Verificar cache
  const cached = instancesCache.get(finalUserId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  // Criar nova requisição
  const request = (async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('usuario_id', finalUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching WhatsApp instances:', error);
        throw error;
      }

      const result = data || [];
      // Atualizar cache
      instancesCache.set(finalUserId, { data: result, timestamp: Date.now() });
      return result;
    } finally {
      inFlightInstancesRequests.delete(finalUserId);
    }
  })();

  inFlightInstancesRequests.set(finalUserId, request);
  return request;
}

/**
 * Busca uma instância WhatsApp específica pelo telefone
 */
export async function getWhatsAppInstanceByTelefone(telefone: string): Promise<WhatsAppInstance | null> {
  const { data, error } = await supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('telefone', telefone)
    .eq('status', 'conectado')
    .single();

  if (error) {
    console.error('Error fetching WhatsApp instance:', error);
    return null;
  }

  return data;
}

/**
 * Identifica o usuário pelo número de telefone conectado
 */
export async function getUsuarioByTelefone(telefone: string): Promise<string | null> {
  const instance = await getWhatsAppInstanceByTelefone(telefone);
  return instance?.usuario_id || null;
}

/**
 * Cria ou atualiza uma instância WhatsApp
 */
export async function upsertWhatsAppInstance(
  telefone: string,
  instanceName?: string,
  evolutionApiInstanceId?: string,
  status: StatusWhatsAppInstance = 'desconectado',
  userId?: string
): Promise<WhatsAppInstance> {
  const { data, error } = await supabase
    .from('whatsapp_instances')
    .upsert({
      telefone,
      instance_name: instanceName,
      evolution_api_instance_id: evolutionApiInstanceId,
      status,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'telefone',
    })
    .select()
    .single();

  if (error) {
    console.error('Error upserting WhatsApp instance:', error);
    throw error;
  }

  // Limpar cache se tiver userId
  if (data?.usuario_id || userId) {
    const finalUserId = data?.usuario_id || userId;
    if (finalUserId) {
      clearInstancesCache(finalUserId);
    }
  }

  return data;
}

/**
 * Atualiza o status de uma instância WhatsApp
 */
export async function updateWhatsAppInstanceStatus(
  telefone: string,
  status: StatusWhatsAppInstance,
  qrCode?: string
): Promise<WhatsAppInstance> {
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (qrCode) {
    updateData.qr_code = qrCode;
  }

  const { data, error } = await supabase
    .from('whatsapp_instances')
    .update(updateData)
    .eq('telefone', telefone)
    .select()
    .single();

  if (error) {
    console.error('Error updating WhatsApp instance status:', error);
    throw error;
  }

  // Limpar cache
  if (data?.usuario_id) {
    clearInstancesCache(data.usuario_id);
  }

  return data;
}

/**
 * Busca instâncias conectadas do usuário atual
 * @param userId - ID do usuário (opcional, se não fornecido busca do auth)
 */
export async function getConnectedInstances(userId?: string): Promise<WhatsAppInstance[]> {
  let finalUserId = userId;
  
  // Se não forneceu userId, buscar do auth
  if (!finalUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return [];
    }
    finalUserId = user.id;
  }

  // Verificar se já existe uma requisição em andamento
  const existingRequest = inFlightConnectedRequests.get(finalUserId);
  if (existingRequest) {
    return existingRequest;
  }

  // Verificar cache
  const cached = connectedInstancesCache.get(finalUserId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  // Criar nova requisição
  const request = (async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('usuario_id', finalUserId)
        .eq('status', 'conectado')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching connected instances:', error);
        throw error;
      }

      const result = data || [];
      // Atualizar cache
      connectedInstancesCache.set(finalUserId, { data: result, timestamp: Date.now() });
      return result;
    } finally {
      inFlightConnectedRequests.delete(finalUserId);
    }
  })();

  inFlightConnectedRequests.set(finalUserId, request);
  return request;
}

/**
 * Busca uma instância WhatsApp pelo instance_name
 */
export async function getWhatsAppInstanceByInstanceName(instanceName: string, userId?: string): Promise<WhatsAppInstance | null> {
  let query = supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('instance_name', instanceName);

  if (userId) {
    query = query.eq('usuario_id', userId);
  }

  const { data, error } = await query.single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Nenhum registro encontrado
      return null;
    }
    console.error('Error fetching WhatsApp instance by instance_name:', error);
    return null;
  }

  return data;
}

/**
 * Busca o instance_name da primeira instância do usuário
 * Retorna null se não encontrar nenhuma instância
 */
export async function getInstanceNameByUsuario(userId?: string): Promise<string | null> {
  let finalUserId = userId;
  
  // Se não forneceu userId, buscar do auth
  if (!finalUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return null;
    }
    finalUserId = user.id;
  }

  const instances = await getWhatsAppInstances(finalUserId);
  
  if (instances.length === 0) {
    return null;
  }

  // Retornar o instance_name da primeira instância
  return instances[0].instance_name || null;
}

/**
 * Verifica o status de conexão de uma instância no Supabase
 */
export async function verificarStatusConexaoSupabase(instanceName: string): Promise<{
  conectado: boolean;
  status: 'conectado' | 'desconectado' | 'conectando' | 'erro';
}> {
  const instance = await getWhatsAppInstanceByInstanceName(instanceName);
  
  if (!instance) {
    return { conectado: false, status: 'desconectado' };
  }

  return {
    conectado: instance.status === 'conectado',
    status: instance.status,
  };
}

/**
 * Obtém o usuario_id da instância existente ou do usuário autenticado
 */
async function obterUsuarioIdParaSincronizacao(instanceName: string, telefone: string): Promise<string | null> {
  // Primeiro, tentar buscar da instância existente no Supabase
  const instance = await getWhatsAppInstanceByInstanceName(instanceName);
  if (instance?.usuario_id) {
    return instance.usuario_id;
  }
  
  // Se não encontrou, tentar buscar pelo telefone
  const instanceByTelefone = await supabase
    .from('whatsapp_instances')
    .select('usuario_id')
    .eq('telefone', telefone)
    .single();
  
  if (instanceByTelefone.data?.usuario_id) {
    return instanceByTelefone.data.usuario_id;
  }
  
  // Último recurso: buscar do auth (mas isso é raro)
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

/**
 * Sincroniza o status da instância no Supabase com base no status da Evolution API
 */
export async function sincronizarStatusInstancia(
  instanceName: string,
  telefone: string,
  status: StatusWhatsAppInstance,
  usuarioId?: string,
  qrCode?: string
): Promise<WhatsAppInstance> {
  // Se não forneceu usuarioId, tentar obter de forma otimizada
  let finalUsuarioId = usuarioId;
  if (!finalUsuarioId) {
    finalUsuarioId = await obterUsuarioIdParaSincronizacao(instanceName, telefone);
  }
  
  if (!finalUsuarioId) {
    throw new Error('Usuário não autenticado ou não encontrado');
  }

  const updateData: any = {
    usuario_id: finalUsuarioId,
    instance_name: instanceName,
    status,
    updated_at: new Date().toISOString(),
  };

  if (qrCode) {
    updateData.qr_code = qrCode;
  } else if (status === 'conectado') {
    // Limpar QR code quando conectar
    updateData.qr_code = null;
  }

  const { data, error } = await supabase
    .from('whatsapp_instances')
    .upsert({
      telefone,
      ...updateData,
    }, {
      onConflict: 'telefone',
    })
    .select()
    .single();

  if (error) {
    console.error('Error syncing instance status:', error);
    throw error;
  }

  // Limpar cache após sincronização
  if (finalUsuarioId) {
    clearInstancesCache(finalUsuarioId);
  }

  return data;
}

