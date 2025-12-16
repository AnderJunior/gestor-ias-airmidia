'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getAtendimentos } from '@/lib/api/atendimentos';
import { getConnectedInstances } from '@/lib/api/whatsapp';
import { supabase } from '@/lib/supabaseClient';
import { Atendimento } from '@/types/domain';

export function useAtendimentos() {
  const { user } = useAuth();
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);
  const instanceIdsRef = useRef<string[]>([]);
  const previousAtendimentosIdsRef = useRef<Set<string>>(new Set());

  const fetchAtendimentos = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getAtendimentos(user.id);
      setAtendimentos(data);
    } catch (error) {
      console.error('Erro ao buscar atendimentos:', error);
      setAtendimentos([]);
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

        // Carregar atendimentos iniciais
        const data = await getAtendimentos(user.id);
        if (!isMounted) return;

        // Inicializar referência dos IDs
        previousAtendimentosIdsRef.current = new Set(data.map(a => a.id));

        setAtendimentos(data);
        setLoading(false);

        // Buscar instâncias conectadas para filtrar o realtime
        const connectedInstances = await getConnectedInstances(user.id);
        if (!isMounted) return;

        const instanceIds = connectedInstances.map(inst => inst.id);
        instanceIdsRef.current = instanceIds;

        // Limpar subscription anterior se existir
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current);
        }

        // Criar subscription para mudanças em atendimentos_solicitado
        const channel = supabase
          .channel(`atendimentos:${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*', // Escutar INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'atendimentos_solicitado',
            },
            async (payload) => {
              if (!isMounted) return;

              // Filtrar apenas mudanças relacionadas às instâncias conectadas do usuário
              const changedInstanceId = payload.new?.whatsapp_instance_id || payload.old?.whatsapp_instance_id;
              
              // Se for INSERT ou UPDATE, verificar se a instância está nas conectadas
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                if (changedInstanceId && !instanceIdsRef.current.includes(changedInstanceId)) {
                  return; // Ignorar mudanças de instâncias não conectadas
                }
              }

              // Recarregar atendimentos quando houver mudanças relevantes
              try {
                const previousIds = new Set(previousAtendimentosIdsRef.current);
                const updatedData = await getAtendimentos(user.id);
                if (isMounted) {
                  // Detectar novos atendimentos comparando IDs antes e depois
                  const currentIds = new Set(updatedData.map(a => a.id));
                  
                  // Atualizar referência dos IDs
                  previousAtendimentosIdsRef.current = currentIds;
                  
                  setAtendimentos(updatedData);
                }
              } catch (err) {
                console.error('Erro ao atualizar atendimentos via realtime:', err);
              }
            }
          )
          // Escutar mudanças na tabela whatsapp_instances (quando status muda, pode afetar quais atendimentos são visíveis)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'whatsapp_instances',
              filter: `usuario_id=eq.${user.id}`,
            },
            async (payload) => {
              if (!isMounted) return;

              // Verificar se o status mudou (pode afetar quais instâncias estão conectadas)
              const newStatus = (payload.new as any)?.status;
              const oldStatus = (payload.old as any)?.status;

              if (newStatus !== oldStatus) {
                // Atualizar lista de instâncias conectadas
                try {
                  const connectedInstances = await getConnectedInstances(user.id);
                  if (!isMounted) return;

                  const instanceIds = connectedInstances.map(inst => inst.id);
                  instanceIdsRef.current = instanceIds;

                  // Recarregar atendimentos
                  const updatedData = await getAtendimentos(user.id);
                  if (isMounted) {
                    // Atualizar referência dos IDs
                    previousAtendimentosIdsRef.current = new Set(updatedData.map(a => a.id));
                    setAtendimentos(updatedData);
                  }
                } catch (err) {
                  console.error('Erro ao atualizar atendimentos após mudança de status da instância:', err);
                }
              }
            }
          )
          // Escutar mudanças na tabela clientes (pode afetar nome, telefone, foto_perfil dos atendimentos)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'clientes',
            },
            async (payload) => {
              if (!isMounted) return;

              // Recarregar atendimentos quando dados do cliente mudarem
              try {
                const updatedData = await getAtendimentos(user.id);
                if (isMounted) {
                  // Atualizar referência dos IDs
                  previousAtendimentosIdsRef.current = new Set(updatedData.map(a => a.id));
                  setAtendimentos(updatedData);
                }
              } catch (err) {
                console.error('Erro ao atualizar atendimentos após mudança no cliente:', err);
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('Subscrito ao realtime de atendimentos');
            } else if (status === 'CHANNEL_ERROR') {
              console.error('Erro na subscription de atendimentos');
            }
          });

        channelRef.current = channel;
      } catch (error) {
        if (isMounted) {
          console.error('Erro ao configurar realtime de atendimentos:', error);
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
    fetchAtendimentos();
  }, [fetchAtendimentos]);

  return {
    atendimentos,
    loading,
    refetch,
  };
}
