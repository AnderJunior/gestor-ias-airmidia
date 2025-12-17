'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getAgendamentos } from '@/lib/api/agendamentos';
import { supabase } from '@/lib/supabaseClient';
import { Agendamento } from '@/types/domain';

export function useAgendamentos() {
  const { user } = useAuth();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);

  const fetchAgendamentos = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getAgendamentos(user.id);
      setAgendamentos(data);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      setAgendamentos([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function setupRealtime() {
      try {
        setLoading(true);

        // Carregar agendamentos iniciais
        const data = await getAgendamentos(user.id);
        if (!isMounted) return;

        setAgendamentos(data);
        setLoading(false);

        // Limpar subscription anterior se existir
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current);
        }

        // Criar subscription para mudanças em agendamentos
        const channel = supabase
          .channel(`agendamentos:${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*', // Escutar INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'agendamentos',
              filter: `usuario_id=eq.${user.id}`,
            },
            async (payload) => {
              if (!isMounted) return;

              // Recarregar agendamentos quando houver mudanças
              try {
                const updatedData = await getAgendamentos(user.id);
                if (isMounted) {
                  setAgendamentos(updatedData);
                }
              } catch (err) {
                console.error('Erro ao atualizar agendamentos via realtime:', err);
              }
            }
          )
          // Escutar mudanças na tabela clientes apenas para clientes dos agendamentos do usuário
          // Usar debounce para evitar múltiplas requisições rápidas
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'clientes',
            },
            async (payload) => {
              if (!isMounted) return;

              // Usar debounce simples para evitar múltiplas requisições rápidas
              // Recarregar agendamentos quando dados do cliente mudarem
              try {
                // Pequeno delay para agrupar múltiplas mudanças
                await new Promise(resolve => setTimeout(resolve, 300));
                if (!isMounted) return;
                
                const updatedData = await getAgendamentos(user.id);
                if (isMounted) {
                  setAgendamentos(updatedData);
                }
              } catch (err) {
                console.error('Erro ao atualizar agendamentos após mudança no cliente:', err);
              }
            }
          )
          .subscribe();

        channelRef.current = channel;
      } catch (error) {
        if (isMounted) {
          console.error('Erro ao configurar realtime de agendamentos:', error);
          setLoading(false);
        }
      }
    }

    setupRealtime();

    // Cleanup: remover subscription quando o componente desmontar ou user.id mudar
    return () => {
      isMounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id]);

  const refetch = useCallback(() => {
    fetchAgendamentos();
  }, [fetchAgendamentos]);

  return {
    agendamentos,
    loading,
    refetch,
  };
}

