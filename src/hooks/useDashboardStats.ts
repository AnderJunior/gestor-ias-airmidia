'use client';

import { useEffect, useState, useRef } from 'react';
import { DashboardStats } from '@/types/domain';
import { getDashboardStats } from '@/lib/api/atendimentos';
import { useAuth } from './useAuth';
import { supabase } from '@/lib/supabaseClient';
import { getConnectedInstances } from '@/lib/api/whatsapp';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useDashboardStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const instanceIdsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function setupRealtime() {
      try {
        setLoading(true);
        
        // Carregar estatísticas iniciais
        const data = await getDashboardStats(user.id);
        if (!isMounted) return;
        
        setStats(data);
        setLoading(false);

        // Buscar instâncias conectadas para filtrar o realtime
        const connectedInstances = await getConnectedInstances(user.id);
        if (!isMounted) return;
        
        const instanceIds = connectedInstances.map(inst => inst.id);
        instanceIdsRef.current = instanceIds;

        if (instanceIds.length === 0) {
          return;
        }

        // Limpar subscription anterior se existir
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current);
        }

        // Criar subscription para mudanças em atendimentos_solicitado
        // Escutamos todas as mudanças e filtramos no callback para garantir compatibilidade
        const channel = supabase
          .channel(`dashboard-stats:${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*', // Escutar INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'atendimentos_solicitado',
            },
            async (payload) => {
              if (!isMounted) return;

              // Filtrar apenas mudanças relacionadas às instâncias do usuário
              const changedInstanceId = payload.new?.whatsapp_instance_id || payload.old?.whatsapp_instance_id;
              if (changedInstanceId && !instanceIdsRef.current.includes(changedInstanceId)) {
                return; // Ignorar mudanças de outras instâncias
              }

              // Recarregar estatísticas quando houver mudanças relevantes
              try {
                const updatedData = await getDashboardStats(user.id);
                if (isMounted) {
                  setStats(updatedData);
                }
              } catch (err) {
                console.error('Erro ao atualizar estatísticas via realtime:', err);
              }
            }
          )
          // Escutar mudanças na tabela whatsapp_instances (quando status muda, pode afetar estatísticas)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'whatsapp_instances',
              filter: `usuario_id=eq.${user.id}`,
            },
            async (payload) => {
              if (!isMounted) return;

              // Atualizar lista de instâncias conectadas e recarregar estatísticas
              try {
                const updatedInstances = await getConnectedInstances(user.id);
                if (isMounted) {
                  const updatedInstanceIds = updatedInstances.map(inst => inst.id);
                  instanceIdsRef.current = updatedInstanceIds;
                  
                  // Recarregar estatísticas
                  const updatedData = await getDashboardStats(user.id);
                  if (isMounted) {
                    setStats(updatedData);
                  }
                }
              } catch (err) {
                console.error('Erro ao atualizar estatísticas via realtime (mudança em instância):', err);
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('Subscrito ao realtime de estatísticas do dashboard');
            } else if (status === 'CHANNEL_ERROR') {
              // Erro transitório - a subscription geralmente se reconecta automaticamente
              // Não logar como erro crítico
            }
          });

        channelRef.current = channel;
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Erro ao carregar estatísticas'));
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

  return {
    stats,
    loading,
    error,
    refetch: async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const data = await getDashboardStats(user.id);
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro ao recarregar estatísticas'));
      } finally {
        setLoading(false);
      }
    },
  };
}

