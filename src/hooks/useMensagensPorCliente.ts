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
    if (!clienteId || !user?.id) {
      setMensagens([]);
      setLoading(false);
      return;
    }

    const currentClienteId = clienteId; // Capturar valor para garantir tipo não-null
    const userId = user.id; // Capturar valor para garantir tipo não-null
    let isMounted = true;

    async function setupRealtime() {
      try {
        setLoading(true);
        
        // Carregar mensagens iniciais
        const data = await getMensagensByCliente(currentClienteId, userId);
        if (!isMounted) return;
        
        setMensagens(data);
        setLoading(false);

        // Limpar subscription anterior se existir
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current);
        }

        // Criar subscription para mudanças na tabela mensagens
        // Filtrar apenas mensagens deste cliente e usuário para reduzir requisições
        const channel = supabase
          .channel(`mensagens-cliente:${currentClienteId}:${userId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'mensagens',
              filter: `cliente_id=eq.${currentClienteId}`,
            },
            async (payload) => {
              if (!isMounted) return;

              // Verificar se a mensagem é do usuário atual antes de recarregar
              const mensagemUsuarioId = (payload.new as any)?.usuario_id || (payload.old as any)?.usuario_id;
              if (mensagemUsuarioId && mensagemUsuarioId !== userId) {
                return; // Ignorar mensagens de outros usuários
              }

              // Recarregar mensagens quando houver mudanças relevantes
              try {
                const updatedData = await getMensagensByCliente(currentClienteId, userId);
                if (isMounted) {
                  setMensagens(updatedData);
                }
              } catch (err) {
                console.error('Erro ao atualizar mensagens via realtime:', err);
              }
            }
          )
          .subscribe();

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
      if (!clienteId || !user?.id) return;
      const currentClienteId = clienteId; // Capturar valor para garantir tipo não-null
      const userId = user.id; // Capturar valor para garantir tipo não-null
      setLoading(true);
      try {
        const data = await getMensagensByCliente(currentClienteId, userId);
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
    // Filtrar apenas mudanças do usuário atual para reduzir requisições
    const atendimentosChannel = supabase
      .channel(`atendimentos-updates:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'atendimentos_solicitado',
          filter: `usuario_id=eq.${user.id}`,
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
      .channel(`mensagens-updates:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mensagens',
          filter: `usuario_id=eq.${user.id}`,
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

