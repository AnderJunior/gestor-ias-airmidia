'use client';

import { useEffect, useState } from 'react';
import { getAllUsuarios, getEstatisticasClientes, Usuario, EstatisticasClientes } from '@/lib/api/usuarios';
import { supabase } from '@/lib/supabaseClient';

export interface EstatisticasAtendimentosMensagens {
  mediaMensagensPorIA: number;
  tempoMedioAtendimentoHumanoMinutos: number;
  tempoMedioAtendimentoIAMinutos: number;
}

export async function getEstatisticasAtendimentosMensagens(debug = false, usuarioId?: string | null): Promise<EstatisticasAtendimentosMensagens> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Não autenticado');

  const params = new URLSearchParams();
  if (debug) params.set('debug', '1');
  if (usuarioId) params.set('usuario_id', usuarioId);
  const qs = params.toString();
  const url = `/api/admin/estatisticas-atendimentos-mensagens${qs ? `?${qs}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${session.access_token}` },
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Erro ao carregar estatísticas');
  return data;
}

export function useAdminClientes() {
  const [clientes, setClientes] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadClientes() {
      try {
        setLoading(true);
        const data = await getAllUsuarios();
        setClientes(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro ao carregar clientes'));
        console.error('Erro ao carregar clientes:', err);
      } finally {
        setLoading(false);
      }
    }

    loadClientes();
  }, []);

  const refetch = async () => {
    try {
      setLoading(true);
      const data = await getAllUsuarios();
      setClientes(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao recarregar clientes'));
      console.error('Erro ao recarregar clientes:', err);
    } finally {
      setLoading(false);
    }
  };

  return { clientes, loading, error, refetch };
}

export function useEstatisticasClientes() {
  const [estatisticas, setEstatisticas] = useState<EstatisticasClientes>({
    totalAtivos: 0,
    totalTeste: 0,
    totalProducao: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadEstatisticas() {
      try {
        setLoading(true);
        const data = await getEstatisticasClientes();
        setEstatisticas(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro ao carregar estatísticas'));
        console.error('Erro ao carregar estatísticas:', err);
      } finally {
        setLoading(false);
      }
    }

    loadEstatisticas();
  }, []);

  const refetch = async () => {
    try {
      setLoading(true);
      const data = await getEstatisticasClientes();
      setEstatisticas(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao recarregar estatísticas'));
      console.error('Erro ao recarregar estatísticas:', err);
    } finally {
      setLoading(false);
    }
  };

  return { estatisticas, loading, error, refetch };
}

export function useEstatisticasAtendimentosMensagens(usuarioId?: string | null) {
  const [estatisticas, setEstatisticas] = useState<EstatisticasAtendimentosMensagens>({
    mediaMensagensPorIA: 0,
    tempoMedioAtendimentoHumanoMinutos: 0,
    tempoMedioAtendimentoIAMinutos: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getEstatisticasAtendimentosMensagens(false, usuarioId);
        if (data.tempoMedioAtendimentoHumanoMinutos === 0) {
          getEstatisticasAtendimentosMensagens(true, usuarioId)
            .then((d: EstatisticasAtendimentosMensagens & { _debug?: unknown }) => {
              if (d._debug) console.log('[Dashboard] Tempo humano zerado. Valores de remetente no banco:', d._debug);
            })
            .catch(() => {});
        }
        setEstatisticas(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro ao carregar estatísticas de atendimento'));
        console.error('Erro ao carregar estatísticas de atendimento:', err);
        setEstatisticas({ mediaMensagensPorIA: 0, tempoMedioAtendimentoHumanoMinutos: 0, tempoMedioAtendimentoIAMinutos: 0 });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [usuarioId]);

  const refetch = async () => {
    try {
      setLoading(true);
      const data = await getEstatisticasAtendimentosMensagens(false, usuarioId);
      setEstatisticas(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao recarregar estatísticas'));
    } finally {
      setLoading(false);
    }
  };

  return { estatisticas, loading, error, refetch };
}

