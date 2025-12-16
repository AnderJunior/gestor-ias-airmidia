'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getAgendamentos } from '@/lib/api/agendamentos';
import { supabase } from '@/lib/supabaseClient';
import { playNotificationSound } from '@/utils/audio';

/**
 * Hook global para escutar novos agendamentos e tocar som de notificação
 * Deve ser usado no layout privado para funcionar em todas as telas
 */
export function useAgendamentosNotifications() {
  const { user } = useAuth();
  const channelRef = useRef<any>(null);
  const previousAgendamentosIdsRef = useRef<Set<string>>(new Set());
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let isMounted = true;

    async function setupRealtime() {
      try {
        console.log('Configurando realtime de notificações de agendamentos para usuário:', user.id);
        
        // Carregar agendamentos iniciais para inicializar a referência
        const data = await getAgendamentos(user.id);
        if (!isMounted) return;

        console.log('Agendamentos iniciais carregados:', data.length);

        // Inicializar referência dos IDs apenas na primeira vez
        if (!isInitializedRef.current) {
          previousAgendamentosIdsRef.current = new Set(data.map(a => a.id));
          isInitializedRef.current = true;
          console.log('IDs iniciais de agendamentos:', Array.from(previousAgendamentosIdsRef.current));
        }

        // Limpar subscription anterior se existir
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current);
        }

        // Criar subscription para mudanças em agendamentos
        const channel = supabase
          .channel(`agendamentos-notifications:${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*', // Escutar INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'agendamentos',
              filter: `usuario_id=eq.${user.id}`, // Filtrar apenas agendamentos do usuário logado
            },
            async (payload) => {
              if (!isMounted) return;

              // Recarregar agendamentos quando houver mudanças relevantes
              try {
                const previousIds = new Set(previousAgendamentosIdsRef.current);
                const updatedData = await getAgendamentos(user.id);
                if (!isMounted) return;

                // Detectar novos agendamentos comparando IDs antes e depois
                const currentIds = new Set(updatedData.map(a => a.id));
                const newIds = [...currentIds].filter(id => !previousIds.has(id));
                
                // Se for um INSERT ou se detectamos novos IDs, tocar som
                if (payload.eventType === 'INSERT' || newIds.length > 0) {
                  console.log('Novo agendamento detectado! Tocando som...', {
                    eventType: payload.eventType,
                    newIds,
                    payload: payload.new
                  });
                  // Tocar som 2 vezes quando um novo agendamento for adicionado
                  playNotificationSound();
                }
                
                // Atualizar referência dos IDs
                previousAgendamentosIdsRef.current = currentIds;
              } catch (err) {
                console.error('Erro ao verificar novos agendamentos:', err);
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('✅ Subscrito ao realtime de notificações de agendamentos');
            } else if (status === 'CHANNEL_ERROR') {
              console.error('❌ Erro na subscription de notificações de agendamentos');
            } else {
              console.log('Status da subscription de agendamentos:', status);
            }
          });

        channelRef.current = channel;
      } catch (error) {
        if (isMounted) {
          console.error('Erro ao configurar realtime de notificações de agendamentos:', error);
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

