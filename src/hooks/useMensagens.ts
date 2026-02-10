'use client';

import { useEffect, useState, useRef } from 'react';
import { MensagemConversa } from '@/lib/api/mensagens';
import { getMensagensByCliente } from '@/lib/api/mensagens';
import { supabase } from '@/lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useMensagens(clienteId: string | null, usuarioId?: string) {
  const [mensagens, setMensagens] = useState<MensagemConversa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!clienteId) {
      setMensagens([]);
      setLoading(false);
      return;
    }

    const currentClienteId = clienteId; // Capturar valor para garantir tipo não-null
    let isMounted = true;

    async function setupRealtime() {
      try {
        setLoading(true);
        
        // Carregar mensagens iniciais
        const data = await getMensagensByCliente(currentClienteId, usuarioId);
        if (!isMounted) return;
        
        setMensagens(data);
        setLoading(false);

        // Limpar subscription anterior se existir
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current);
        }

        // Criar subscription para mudanças na tabela mensagens
        const channel = supabase
          .channel(`mensagens:${currentClienteId}`)
          .on(
            'postgres_changes',
            {
              event: '*', // Escutar INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'mensagens',
              filter: `cliente_id=eq.${currentClienteId}`,
            },
            async (payload) => {
              if (!isMounted) return;

              // Recarregar mensagens quando houver mudanças
              try {
                const updatedData = await getMensagensByCliente(currentClienteId, usuarioId);
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

    // Cleanup: remover subscription quando o componente desmontar ou clienteId mudar
    return () => {
      isMounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [clienteId, usuarioId]);

  return {
    mensagens,
    loading,
    error,
    refetch: async () => {
      if (!clienteId) return;
      setLoading(true);
      try {
        const data = await getMensagensByCliente(clienteId, usuarioId);
        setMensagens(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro ao recarregar mensagens'));
      } finally {
        setLoading(false);
      }
    },
  };
}







