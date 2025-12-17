'use client';

import { useEffect, useState, useRef } from 'react';
import { MensagemConversa, getMensagensByCliente, getClientesComConversas, ClienteComConversa } from '@/lib/api/mensagens';
import { supabase } from '@/lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/useAuth';

export function useMensagensPorCliente(clienteId: string | null) {
  const { user } = useAuth();
  const [mensagens, setMensagens] = useState<MensagemConversa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!clienteId || !user) {
      setMensagens([]);
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function setupRealtime() {
      try {
        setLoading(true);
        
        // Carregar mensagens iniciais
        const data = await getMensagensByCliente(clienteId, user.id);
        if (!isMounted) return;
        
        setMensagens(data);
        setLoading(false);

        // Limpar subscription anterior se existir
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current);
        }

        // Criar subscription para mudanças na tabela mensagens
        // Como as mensagens podem estar em múltiplos atendimentos, precisamos escutar todos
        const channel = supabase
          .channel(`mensagens-cliente:${clienteId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'mensagens',
            },
            async (payload) => {
              if (!isMounted) return;

              // Recarregar mensagens quando houver mudanças
              try {
                if (user) {
                  const updatedData = await getMensagensByCliente(clienteId, user.id);
                  if (isMounted) {
                    setMensagens(updatedData);
                  }
                }
              } catch (err) {
                console.error('Erro ao atualizar mensagens via realtime:', err);
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('Subscrito ao realtime de mensagens do cliente');
            }
          });

        channelRef.current = channel;
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Erro ao carregar mensagens'));
          setLoading(false);
        }
      }
    }

    setupRealtime();

    // Cleanup
    return () => {
      isMounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [clienteId, user]);

  return {
    mensagens,
    loading,
    error,
    refetch: async () => {
      if (!clienteId || !user) return;
      setLoading(true);
      try {
        const data = await getMensagensByCliente(clienteId, user.id);
        setMensagens(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro ao recarregar mensagens'));
      } finally {
        setLoading(false);
      }
    },
  };
}

export function useClientesComConversas() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState<ClienteComConversa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setClientes([]);
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function loadClientes() {
      try {
        setLoading(true);
        const data = await getClientesComConversas(user.id);
        if (isMounted) {
          setClientes(data);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Erro ao carregar clientes'));
          setLoading(false);
        }
      }
    }

    loadClientes();

    // Escutar mudanças em atendimentos e mensagens para atualizar a lista
    const atendimentosChannel = supabase
      .channel('atendimentos-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'atendimentos_solicitado',
        },
        async () => {
          if (isMounted && user) {
            try {
              const data = await getClientesComConversas(user.id);
              setClientes(data);
            } catch (err) {
              console.error('Erro ao atualizar lista de clientes:', err);
            }
          }
        }
      )
      .subscribe();

    const mensagensChannel = supabase
      .channel('mensagens-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mensagens',
        },
        async () => {
          if (isMounted && user) {
            try {
              const data = await getClientesComConversas(user.id);
              setClientes(data);
            } catch (err) {
              console.error('Erro ao atualizar lista de clientes:', err);
            }
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(atendimentosChannel);
      supabase.removeChannel(mensagensChannel);
    };
  }, [user]);

  return {
    clientes,
    loading,
    error,
    refetch: async () => {
      if (!user) return;
      setLoading(true);
      try {
        const data = await getClientesComConversas(user.id);
        setClientes(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro ao recarregar clientes'));
      } finally {
        setLoading(false);
      }
    },
  };
}

