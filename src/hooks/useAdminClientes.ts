'use client';

import { useEffect, useState } from 'react';
import { getAllUsuarios, getEstatisticasClientes, Usuario, EstatisticasClientes } from '@/lib/api/usuarios';

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

