'use client';

import { useEffect, useState, useRef } from 'react';
import { MensagemConversa, getMensagensByCliente, getClientesComConversas, ClienteComConversa } from '@/lib/api/mensagens';
import { supabase } from '@/lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/useAuth';

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutos
const REALTIME_REFETCH_DEBOUNCE_MS = 800;
const CLIENTES_LIST_DEBOUNCE_MS = 1200;

const mensagensCache = new Map<string, { data: MensagemConversa[]; ts: number }>();
const clientesCache = new Map<string, { data: ClienteComConversa[]; ts: number }>();

function getCachedMensagens(userId: string, clienteId: string): MensagemConversa[] | null {
  const key = `${userId}:${clienteId}`;
  const entry = mensagensCache.get(key);
  if (!entry || Date.now() - entry.ts > CACHE_TTL_MS) return null;
  return entry.data;
}

function setCachedMensagens(userId: string, clienteId: string, data: MensagemConversa[]) {
  mensagensCache.set(`${userId}:${clienteId}`, { data, ts: Date.now() });
}

function getCachedClientes(userId: string): ClienteComConversa[] | null {
  const entry = clientesCache.get(userId);
  if (!entry || Date.now() - entry.ts > CACHE_TTL_MS) return null;
  return entry.data;
}

function setCachedClientes(userId: string, data: ClienteComConversa[]) {
  clientesCache.set(userId, { data, ts: Date.now() });
}

export function useMensagensPorCliente(clienteId: string | null) {
  const { user } = useAuth();
  const [mensagens, setMensagens] = useState<MensagemConversa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!clienteId || !user?.id) {
      setMensagens([]);
      setLoading(false);
      return;
    }

    const currentClienteId = clienteId;
    const userId = user.id;
    let isMounted = true;

    const cached = getCachedMensagens(userId, currentClienteId);
    if (cached?.length !== undefined) {
      setMensagens(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

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
        (payload) => {
          if (!isMounted) return;
          const mensagemUsuarioId = (payload.new as any)?.usuario_id || (payload.old as any)?.usuario_id;
          if (mensagemUsuarioId && mensagemUsuarioId !== userId) return;
          if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
          realtimeDebounceRef.current = setTimeout(() => {
            realtimeDebounceRef.current = null;
            if (!isMounted) return;
            getMensagensByCliente(currentClienteId, userId)
              .then((updatedData) => {
                if (isMounted) {
                  setMensagens(updatedData);
                  setCachedMensagens(userId, currentClienteId, updatedData);
                }
              })
              .catch((err) => console.error('Erro ao atualizar mensagens via realtime:', err));
          }, REALTIME_REFETCH_DEBOUNCE_MS);
        }
      )
      .subscribe();
    channelRef.current = channel;

    (async () => {
      try {
        const data = await getMensagensByCliente(currentClienteId, userId);
        if (!isMounted) return;
        setMensagens(data);
        setLoading(false);
        setCachedMensagens(userId, currentClienteId, data);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Erro ao carregar mensagens'));
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
      if (realtimeDebounceRef.current) {
        clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [clienteId, user?.id]);

  return {
    mensagens,
    loading,
    error,
    refetch: async () => {
      if (!clienteId || !user?.id) return;
      mensagensCache.delete(`${user.id}:${clienteId}`);
      setLoading(true);
      try {
        const data = await getMensagensByCliente(clienteId, user.id);
        setMensagens(data);
        setCachedMensagens(user.id, clienteId, data);
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
  const listDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setClientes([]);
      setLoading(false);
      return;
    }

    const userId = user.id;
    let isMounted = true;

    const cached = getCachedClientes(userId);
    if (cached?.length !== undefined) {
      setClientes(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const updateList = async (showLoading = false) => {
      if (showLoading && isMounted) setLoading(true);
      try {
        const data = await getClientesComConversas(userId);
        if (isMounted) {
          setClientes(data);
          setCachedClientes(userId, data);
        }
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err : new Error('Erro ao carregar clientes'));
      }
      if (isMounted) setLoading(false);
    };

    const scheduleUpdateList = (showLoading = false) => {
      if (listDebounceRef.current) clearTimeout(listDebounceRef.current);
      listDebounceRef.current = setTimeout(() => {
        listDebounceRef.current = null;
        if (isMounted) updateList(showLoading);
      }, CLIENTES_LIST_DEBOUNCE_MS);
    };

    if (!cached) {
      updateList(true);
    } else {
      updateList(false);
    }

    const atendimentosChannel = supabase
      .channel(`atendimentos-updates:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'atendimentos_solicitado',
          filter: `usuario_id=eq.${userId}`,
        },
        () => {
          if (isMounted) scheduleUpdateList(false);
        }
      )
      .subscribe();

    const mensagensChannel = supabase
      .channel(`mensagens-updates:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mensagens',
          filter: `usuario_id=eq.${userId}`,
        },
        () => {
          if (isMounted) scheduleUpdateList(false);
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      if (listDebounceRef.current) {
        clearTimeout(listDebounceRef.current);
        listDebounceRef.current = null;
      }
      supabase.removeChannel(atendimentosChannel);
      supabase.removeChannel(mensagensChannel);
    };
  }, [user?.id]);

  return {
    clientes,
    loading,
    error,
    refetch: async () => {
      if (!user) return;
      clientesCache.delete(user.id);
      setLoading(true);
      try {
        const data = await getClientesComConversas(user.id);
        setClientes(data);
        setCachedClientes(user.id, data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro ao recarregar clientes'));
      } finally {
        setLoading(false);
      }
    },
  };
}

