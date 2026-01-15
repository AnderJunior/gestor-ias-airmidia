'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getConnectedInstances } from '@/lib/api/whatsapp';
import { getAtendimentos } from '@/lib/api/atendimentos';
import { supabase } from '@/lib/supabaseClient';
import { playNotificationSound } from '@/utils/audio';
import { requestNotificationPermission, showAtendimentoNotification } from '@/utils/notifications';

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

    const userId = user.id; // Capturar valor para garantir tipo não-null
    let isMounted = true;

    // Solicitar permissão de notificações quando o hook for montado
    requestNotificationPermission().then((permission) => {
      if (permission === 'granted') {
        console.log('Permissão de notificações concedida');
      } else {
        console.warn('Permissão de notificações não concedida:', permission);
      }
    });

    async function setupRealtime() {
      try {
        console.log('Configurando realtime de notificações de atendimentos para usuário:', userId);
        
        // Carregar atendimentos iniciais para inicializar a referência
        const data = await getAtendimentos(userId);
        if (!isMounted) return;

        // Inicializar referência dos IDs apenas na primeira vez
        if (!isInitializedRef.current) {
          previousAtendimentosIdsRef.current = new Set(data.map(a => a.id));
          isInitializedRef.current = true;
          console.log('IDs iniciais de atendimentos:', Array.from(previousAtendimentosIdsRef.current));
        }

        // Buscar instâncias conectadas para filtrar o realtime
        const connectedInstances = await getConnectedInstances(userId);
        if (!isMounted) return;

        const instanceIds = connectedInstances.map(inst => inst.id);
        instanceIdsRef.current = instanceIds;

        console.log('Instâncias conectadas:', instanceIds);

        if (instanceIds.length === 0) {
          console.warn('Nenhuma instância conectada. Realtime de notificações não será configurado.');
          return;
        }

        // Limpar subscription anterior se existir
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current);
        }

        // Criar subscription para mudanças em atendimentos_solicitado
        const channel = supabase
          .channel(`atendimentos-notifications:${userId}`)
          .on(
            'postgres_changes',
            {
              event: '*', // Escutar INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'atendimentos_solicitado',
            },
            async (payload) => {
              if (!isMounted) return;

              console.log('Evento realtime recebido:', {
                eventType: payload.eventType,
                table: payload.table,
                new: payload.new,
                old: payload.old
              });

              // Filtrar apenas mudanças relacionadas às instâncias conectadas do usuário
              const changedInstanceId = (payload.new as any)?.whatsapp_instance_id || (payload.old as any)?.whatsapp_instance_id;
              
              console.log('Verificando instância:', {
                changedInstanceId,
                connectedInstances: instanceIdsRef.current,
                isConnected: changedInstanceId ? instanceIdsRef.current.includes(changedInstanceId) : 'N/A'
              });
              
              // Se for INSERT ou UPDATE, verificar se a instância está nas conectadas
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                if (changedInstanceId && !instanceIdsRef.current.includes(changedInstanceId)) {
                  console.log('Ignorando mudança de instância não conectada:', changedInstanceId);
                  return; // Ignorar mudanças de instâncias não conectadas
                }
              }

              // Verificar se o atendimento é para o usuário atual
              const atendimentoUsuarioId = (payload.new as any)?.usuario_id;
              const isForCurrentUser = atendimentoUsuarioId === userId;

              console.log('Verificando se atendimento é para o usuário atual:', {
                atendimentoUsuarioId,
                currentUserId: userId,
                isForCurrentUser
              });

              // Se não for para o usuário atual, ignorar
              if (!isForCurrentUser) {
                console.log('Atendimento não é para o usuário atual. Ignorando notificação.');
                return;
              }

              // Recarregar atendimentos quando houver mudanças relevantes
              try {
                const previousIds = new Set(previousAtendimentosIdsRef.current);
                console.log('IDs anteriores:', Array.from(previousIds));
                
                const updatedData = await getAtendimentos(userId);
                if (isMounted) {
                  // Detectar novos atendimentos comparando IDs antes e depois
                  const currentIds = new Set(updatedData.map(a => a.id));
                  const newIds = [...currentIds].filter(id => !previousIds.has(id));
                  
                  console.log('IDs atuais:', Array.from(currentIds));
                  console.log('Novos IDs detectados:', newIds);
                  
                  // Se for um INSERT ou se detectamos novos IDs, tocar som e exibir notificação
                  if (payload.eventType === 'INSERT' || newIds.length > 0) {
                    // Buscar informações do novo atendimento para a notificação
                    const novoAtendimento = updatedData.find(a => newIds.includes(a.id));
                    const clienteNome = novoAtendimento?.cliente_nome || 'Cliente';

                    console.log('Novo atendimento detectado para o usuário atual!', {
                      eventType: payload.eventType,
                      newIds,
                      clienteNome,
                      payload: payload.new
                    });

                    // Exibir notificação do navegador (funciona mesmo com página inativa)
                    showAtendimentoNotification(clienteNome, novoAtendimento?.id);

                    // Tocar som (tentará tocar, mesmo se falhar, a notificação já foi exibida)
                    playNotificationSound();
                  } else {
                    console.log('Nenhum novo atendimento detectado. Não tocando som.');
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
              filter: `usuario_id=eq.${userId}`,
            },
            async (payload) => {
              if (!isMounted) return;

              // Verificar se o status mudou (pode afetar quais instâncias estão conectadas)
              const newStatus = (payload.new as any)?.status;
              const oldStatus = (payload.old as any)?.status;

              if (newStatus !== oldStatus) {
                // Atualizar lista de instâncias conectadas
                try {
                  const connectedInstances = await getConnectedInstances(userId);
                  if (!isMounted) return;

                  const instanceIds = connectedInstances.map(inst => inst.id);
                  instanceIdsRef.current = instanceIds;

                  // Recarregar atendimentos para atualizar referência
                  const updatedData = await getAtendimentos(userId);
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
            console.log('Status da subscription de atendimentos:', status);
            if (status === 'SUBSCRIBED') {
              console.log('Subscription de atendimentos ativa!');
            }
          });

        channelRef.current = channel;
        console.log('Canal de notificações de atendimentos criado:', channelRef.current);
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



