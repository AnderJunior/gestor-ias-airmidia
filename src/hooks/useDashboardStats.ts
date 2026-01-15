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
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const userId = user.id; // Capturar valor para garantir tipo não-null
    let isMounted = true;

    async function setupRealtime() {
      try {
        setLoading(true);
        
        // Carregar estatísticas iniciais
        const data = await getDashboardStats(userId);
        if (!isMounted) return;
        
        setStats(data);
        setLoading(false);

        // Buscar instâncias conectadas para filtrar o realtime
        const connectedInstances = await getConnectedInstances(userId);
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
          .channel(`dashboard-stats:${userId}`)
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
              const changedInstanceId = (payload.new as any)?.whatsapp_instance_id || (payload.old as any)?.whatsapp_instance_id;
              if (changedInstanceId && !instanceIdsRef.current.includes(changedInstanceId)) {
                return; // Ignorar mudanças de outras instâncias
              }

              // Debounce para evitar múltiplas requisições rápidas
              if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
              }

              debounceTimeoutRef.current = setTimeout(async () => {
                if (!isMounted) return;
                
                // Recarregar estatísticas quando houver mudanças relevantes
                try {
                  const updatedData = await getDashboardStats(userId);
                  if (isMounted) {
                    setStats(updatedData);
                  }
                } catch (err) {
                  console.error('Erro ao atualizar estatísticas via realtime:', err);
                }
              }, 500);
            }
          )
          // Escutar mudanças na tabela whatsapp_instances (quando status muda, pode afetar estatísticas)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'whatsapp_instances',
              filter: `usuario_id=eq.${userId}`,
            },
            async (payload) => {
              if (!isMounted) return;

              // Atualizar lista de instâncias conectadas e recarregar estatísticas
              try {
                const updatedInstances = await getConnectedInstances(userId);
                if (isMounted) {
                  const updatedInstanceIds = updatedInstances.map(inst => inst.id);
                  instanceIdsRef.current = updatedInstanceIds;
                  
                  // Recarregar estatísticas
                  const updatedData = await getDashboardStats(userId);
                  if (isMounted) {
                    setStats(updatedData);
                  }
                }
              } catch (err) {
                console.error('Erro ao atualizar estatísticas via realtime (mudança em instância):', err);
              }
            }
          )
          .subscribe();

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
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
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

