'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { getAtendimentosRecentes } from '@/lib/api/atendimentos';
import { getAgendamentosProximos } from '@/lib/api/agendamentos';
import { Atendimento } from '@/types/domain';
import { Agendamento } from '@/types/domain';

export function useRecentItems(tipoMarcacao?: 'atendimento' | 'agendamento') {
  const { user } = useAuth();
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Não fazer nada se não tiver user ou tipoMarcacao ainda não foi definido
    if (!user?.id || tipoMarcacao === undefined) {
      setLoading(false);
      return;
    }

    const userId = user.id; // Capturar valor para garantir tipo não-null
    let isMounted = true;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        if (tipoMarcacao === 'agendamento') {
          const dados = await getAgendamentosProximos(userId, 5);
          if (isMounted) {
            setAgendamentos(dados);
            setAtendimentos([]);
          }
        } else {
          const dados = await getAtendimentosRecentes(userId, 5);
          if (isMounted) {
            setAtendimentos(dados);
            setAgendamentos([]);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Erro ao carregar itens recentes'));
          console.error('Erro ao carregar itens recentes:', err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [user?.id, tipoMarcacao]);

  return {
    atendimentos,
    agendamentos,
    loading,
    error,
    refetch: async () => {
      if (!user?.id) return;
      const userId = user.id; // Capturar valor para garantir tipo não-null
      setLoading(true);
      try {
        if (tipoMarcacao === 'agendamento') {
          const dados = await getAgendamentosProximos(userId, 5);
          setAgendamentos(dados);
          setAtendimentos([]);
        } else {
          const dados = await getAtendimentosRecentes(userId, 5);
          setAtendimentos(dados);
          setAgendamentos([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro ao recarregar itens recentes'));
      } finally {
        setLoading(false);
      }
    },
  };
}

