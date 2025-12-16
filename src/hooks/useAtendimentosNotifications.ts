'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getConnectedInstances } from '@/lib/api/whatsapp';
import { getAtendimentos } from '@/lib/api/atendimentos';
import { supabase } from '@/lib/supabaseClient';
import { playNotificationSound } from '@/utils/audio';

/**
 * Hook global para escutar novos atendimentos e tocar som de notificação
 * Deve ser usado no layout privado para funcionar em todas as telas
 */
export function useAtendimentosNotifications() {
  const { user } = useAuth();
  const channelRef = useRef<any>(null);
  const instanceIdsRef = useRef<string[]>([]);
  const previousAtendimentosIdsRef = useRef<Set<string>>(new Set());
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let isMounted = true;

    async function setupRealtime() {
      try {
        // Carregar atendimentos iniciais para inicializar a referência
        const data = await getAtendimentos(user.id);
        if (!isMounted) return;

        // Inicializar referência dos IDs apenas na primeira vez
        if (!isInitializedRef.current) {
          previousAtendimentosIdsRef.current = new Set(data.map(a => a.id));
          isInitializedRef.current = true;
        }

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
        const channel = supabase
          .channel(`atendimentos-notifications:${user.id}`)
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
                  const newIds = [...currentIds].filter(id => !previousIds.has(id));
                  
                  // Se for um INSERT ou se detectamos novos IDs, tocar som
                  if (payload.eventType === 'INSERT' || newIds.length > 0) {
                    // Tocar som 2 vezes quando um novo atendimento for adicionado
                    playNotificationSound();
                  }
                  
                  // Atualizar referência dos IDs
                  previousAtendimentosIdsRef.current = currentIds;
                }
              } catch (err) {
                console.error('Erro ao verificar novos atendimentos:', err);
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

                  // Recarregar atendimentos para atualizar referência
                  const updatedData = await getAtendimentos(user.id);
                  if (isMounted) {
                    previousAtendimentosIdsRef.current = new Set(updatedData.map(a => a.id));
                  }
                } catch (err) {
                  console.error('Erro ao atualizar instâncias:', err);
                }
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('Subscrito ao realtime de notificações de atendimentos');
            } else if (status === 'CHANNEL_ERROR') {
              console.error('Erro na subscription de notificações de atendimentos');
            }
          });

        channelRef.current = channel;
      } catch (error) {
        if (isMounted) {
          console.error('Erro ao configurar realtime de notificações de atendimentos:', error);
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
}



