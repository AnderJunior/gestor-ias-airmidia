'use client';

import { useEffect, useState, useRef } from 'react';
import { WhatsAppInstance } from '@/types/domain';
import { getWhatsAppInstances, getConnectedInstances } from '@/lib/api/whatsapp';
import { useAuth } from './useAuth';
import { supabase } from '@/lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useWhatsAppInstances() {
  const { user } = useAuth();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function setupRealtime() {
      try {
        setLoading(true);
        
        // Carregar instâncias iniciais
        const data = await getWhatsAppInstances(user.id);
        if (!isMounted) return;
        
        setInstances(data);
        setLoading(false);

        // Limpar subscription anterior se existir
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current);
        }

        // Criar subscription para mudanças na tabela whatsapp_instances
        const channel = supabase
          .channel(`whatsapp-instances:${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*', // Escutar INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'whatsapp_instances',
              filter: `usuario_id=eq.${user.id}`,
            },
            async (payload) => {
              if (!isMounted) return;

              // Recarregar instâncias quando houver mudanças
              try {
                const updatedData = await getWhatsAppInstances(user.id);
                if (isMounted) {
                  setInstances(updatedData);
                }
              } catch (err) {
                console.error('Erro ao atualizar instâncias WhatsApp via realtime:', err);
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('Subscrito ao realtime de instâncias WhatsApp');
            } else if (status === 'CHANNEL_ERROR') {
              // Erro transitório - a subscription geralmente se reconecta automaticamente
              // Não logar como erro crítico
            }
          });

        channelRef.current = channel;
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Erro ao carregar instâncias WhatsApp'));
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
    instances,
    loading,
    error,
    refetch: async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const data = await getWhatsAppInstances(user.id);
        setInstances(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro ao recarregar instâncias'));
      } finally {
        setLoading(false);
      }
    },
  };
}

export function useConnectedInstances() {
  const { user } = useAuth();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function setupRealtime() {
      try {
        setLoading(true);
        
        // Carregar instâncias conectadas iniciais
        const data = await getConnectedInstances(user.id);
        if (!isMounted) return;
        
        setInstances(data);
        setLoading(false);

        // Limpar subscription anterior se existir
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current);
        }

        // Criar subscription para mudanças na tabela whatsapp_instances
        // Filtrar apenas instâncias conectadas do usuário
        const channel = supabase
          .channel(`connected-instances:${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*', // Escutar INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'whatsapp_instances',
              filter: `usuario_id=eq.${user.id}`,
            },
            async (payload) => {
              if (!isMounted) return;

              // Filtrar apenas mudanças que afetam o status de conexão
              const newStatus = (payload.new as any)?.status;
              const oldStatus = (payload.old as any)?.status;
              
              // Se o status mudou ou se é uma nova instância (INSERT), recarregar
              const isInsert = !payload.old && payload.new;
              const statusChanged = newStatus !== oldStatus;
              
              if (statusChanged || isInsert) {
                try {
                  const updatedData = await getConnectedInstances(user.id);
                  if (isMounted) {
                    setInstances(updatedData);
                  }
                } catch (err) {
                  console.error('Erro ao atualizar instâncias conectadas via realtime:', err);
                }
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('Subscrito ao realtime de instâncias conectadas');
            } else if (status === 'CHANNEL_ERROR') {
              // Erro transitório - a subscription geralmente se reconecta automaticamente
              // Não logar como erro crítico
            }
          });

        channelRef.current = channel;
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Erro ao carregar instâncias conectadas'));
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
    instances,
    loading,
    error,
    refetch: async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const data = await getConnectedInstances(user.id);
        setInstances(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro ao recarregar instâncias conectadas'));
      } finally {
        setLoading(false);
      }
    },
  };
}

