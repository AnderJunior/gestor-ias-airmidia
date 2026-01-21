'use client';

import { useEffect, useState } from 'react';
import { Usuario } from '@/lib/api/usuarios';
import { supabase } from '@/lib/supabaseClient';

export interface AdministradorComEmail extends Usuario {
  email: string | null;
}

export function useAdministradores() {
  const [administradores, setAdministradores] = useState<AdministradorComEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadAdministradores = async () => {
    try {
      setLoading(true);
      
      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const response = await fetch('/api/admin/listar-administradores', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar administradores');
      }

      setAdministradores(data.administradores || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar administradores'));
      console.error('Erro ao carregar administradores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdministradores();
  }, []);

  const refetch = async () => {
    await loadAdministradores();
  };

  return { administradores, loading, error, refetch };
}
