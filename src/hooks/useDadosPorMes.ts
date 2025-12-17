'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { getAtendimentosPorMes } from '@/lib/api/atendimentos';
import { getAgendamentosPorMes } from '@/lib/api/agendamentos';

interface DadosPorMes {
  mes: string;
  quantidade: number;
}

export function useDadosPorMes(tipoMarcacao?: 'atendimento' | 'agendamento', months: number = 6) {
  const { user } = useAuth();
  const [dados, setDados] = useState<DadosPorMes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        let dadosPorMes: DadosPorMes[] = [];

        if (tipoMarcacao === 'agendamento') {
          dadosPorMes = await getAgendamentosPorMes(user.id, months);
        } else {
          dadosPorMes = await getAtendimentosPorMes(user.id, months);
        }

        setDados(dadosPorMes);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro ao carregar dados por mês'));
        console.error('Erro ao carregar dados por mês:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user?.id, tipoMarcacao, months]);

  return {
    dados,
    loading,
    error,
    refetch: async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        let dadosPorMes: DadosPorMes[] = [];

        if (tipoMarcacao === 'agendamento') {
          dadosPorMes = await getAgendamentosPorMes(user.id, months);
        } else {
          dadosPorMes = await getAtendimentosPorMes(user.id, months);
        }

        setDados(dadosPorMes);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro ao recarregar dados por mês'));
      } finally {
        setLoading(false);
      }
    },
  };
}


