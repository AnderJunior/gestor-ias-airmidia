import { supabase } from '@/lib/supabaseClient';

export interface KanbanColuna {
  id: string;
  name: string;
  color?: string;
  ordem?: number;
}

/**
 * Busca todas as colunas do Kanban no Supabase, ordenadas por ordem.
 */
export async function fetchKanbanColunas(): Promise<KanbanColuna[]> {
  const { data, error } = await supabase
    .from('kanban_colunas')
    .select('id, name, color, ordem')
    .order('ordem', { ascending: true });

  if (error) {
    console.error('Erro ao buscar colunas do Kanban:', error);
    throw new Error(error.message || 'Erro ao carregar colunas');
  }

  return (data || []).map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color || '#6b7280',
    ordem: r.ordem ?? 0,
  }));
}

/**
 * Obtém o próximo valor de ordem para uma nova coluna.
 * Tabela vazia: primeira coluna recebe 0.
 */
async function getProximaOrdem(): Promise<number> {
  const { data, error } = await supabase
    .from('kanban_colunas')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('Erro ao obter próxima ordem:', error);
    return 0;
  }

  return (data?.ordem ?? -1) + 1;
}

/**
 * Cria uma nova coluna no Kanban e retorna a coluna criada (com ordem).
 */
export async function createKanbanColuna(
  id: string,
  name: string,
  color: string = '#6b7280'
): Promise<KanbanColuna> {
  const ordem = await getProximaOrdem();

  const { data, error } = await supabase
    .from('kanban_colunas')
    .insert({
      id,
      name,
      color,
      ordem,
      updated_at: new Date().toISOString(),
    })
    .select('id, name, color, ordem')
    .single();

  if (error) {
    console.error('Erro ao criar coluna do Kanban:', error);
    throw new Error(error.message || 'Erro ao criar coluna');
  }

  return {
    id: data.id,
    name: data.name,
    color: data.color || '#6b7280',
    ordem: data.ordem ?? 0,
  };
}

/**
 * Atualiza o nome e/ou a cor de uma coluna.
 */
export async function updateKanbanColuna(
  id: string,
  name: string,
  color?: string
): Promise<void> {
  const payload: { name: string; updated_at: string; color?: string } = {
    name,
    updated_at: new Date().toISOString(),
  };
  if (color !== undefined) payload.color = color;

  const { error } = await supabase
    .from('kanban_colunas')
    .update(payload)
    .eq('id', id);

  if (error) {
    console.error('Erro ao atualizar coluna do Kanban:', error);
    throw new Error(error.message || 'Erro ao atualizar coluna');
  }
}

/**
 * Remove uma coluna do Kanban.
 */
export async function deleteKanbanColuna(id: string): Promise<void> {
  const { error } = await supabase.from('kanban_colunas').delete().eq('id', id);

  if (error) {
    console.error('Erro ao excluir coluna do Kanban:', error);
    throw new Error(error.message || 'Erro ao excluir coluna');
  }
}
