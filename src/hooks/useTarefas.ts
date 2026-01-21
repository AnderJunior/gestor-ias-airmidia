import { useState, useEffect } from 'react';
import { Tarefa, getTarefasPorCliente, criarTarefa, atualizarTarefa, excluirTarefa, excluirTodasTarefas } from '@/lib/api/tarefas';

export function useTarefas(clienteId: string) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadTarefas = async () => {
    if (!clienteId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getTarefasPorCliente(clienteId);
      setTarefas(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro ao carregar tarefas');
      setError(error);
      console.error('Erro ao carregar tarefas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTarefas();
  }, [clienteId]);

  const adicionarTarefa = async (nome: string, dataVencimento?: Date | null, responsavelId?: string | null) => {
    try {
      const novaTarefa = await criarTarefa({
        cliente_id: clienteId,
        nome,
        status: 'pendente',
        data_vencimento: dataVencimento ? dataVencimento.toISOString() : null,
        responsavel_id: responsavelId || null,
      });
      setTarefas((prev) => [novaTarefa, ...prev]);
      return novaTarefa;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro ao criar tarefa');
      setError(error);
      throw error;
    }
  };

  const atualizarTarefaById = async (
    tarefaId: string,
    updates: {
      nome?: string;
      status?: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
      data_vencimento?: Date | null;
      responsavel_id?: string | null;
    }
  ) => {
    try {
      const tarefaAtualizada = await atualizarTarefa(tarefaId, {
        ...(updates.nome !== undefined && { nome: updates.nome }),
        ...(updates.status !== undefined && { status: updates.status }),
        ...(updates.data_vencimento !== undefined && {
          data_vencimento: updates.data_vencimento ? updates.data_vencimento.toISOString() : null,
        }),
        ...(updates.responsavel_id !== undefined && { responsavel_id: updates.responsavel_id }),
      });
      setTarefas((prev) =>
        prev.map((t) => (t.id === tarefaId ? tarefaAtualizada : t))
      );
      return tarefaAtualizada;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro ao atualizar tarefa');
      setError(error);
      throw error;
    }
  };

  const excluirTarefaById = async (tarefaId: string) => {
    try {
      await excluirTarefa(tarefaId);
      setTarefas((prev) => prev.filter((t) => t.id !== tarefaId));
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro ao excluir tarefa');
      setError(error);
      throw error;
    }
  };

  const excluirTodas = async () => {
    try {
      await excluirTodasTarefas(clienteId);
      setTarefas([]);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro ao excluir todas as tarefas');
      setError(error);
      throw error;
    }
  };

  return {
    tarefas,
    loading,
    error,
    adicionarTarefa,
    atualizarTarefa: atualizarTarefaById,
    excluirTarefa: excluirTarefaById,
    excluirTodas,
    recarregar: loadTarefas,
  };
}
