import { supabase } from '../supabaseClient';

/**
 * Busca quantidade total de clientes cadastrados do usuário
 * @param userId - ID do usuário
 */
export async function getTotalClientes(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('clientes')
    .select('*', { count: 'exact', head: true })
    .eq('usuario_id', userId);

  if (error) {
    console.error('Error fetching total clientes:', error);
    throw error;
  }

  return count || 0;
}


