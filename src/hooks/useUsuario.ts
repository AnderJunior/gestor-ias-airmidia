'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from './useAuth';
import { getUsuario, Usuario, clearUsuarioCache } from '@/lib/api/usuarios';
import { supabase } from '@/lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useUsuario() {
  const { user } = useAuth();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setUsuario(null);
      setLoading(false);
      return;
    }

    const userId = user.id; // Capturar valor para garantir tipo não-null
    let isMounted = true;

    async function setupRealtime() {
      try {
        setLoading(true);
        
        // Carregar dados iniciais
        const data = await getUsuario(userId);
        if (!isMounted) return;
        
        setUsuario(data);
        setLoading(false);

        // Limpar subscription anterior se existir
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current);
        }

        // Criar subscription para mudanças na tabela usuarios
        const channel = supabase
          .channel(`usuario:${userId}`, {
            config: {
              broadcast: { self: true },
            },
          })
          .on(
            'postgres_changes',
            {
              event: '*', // Escutar INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'usuarios',
              filter: `id=eq.${userId}`,
            },
            async (payload) => {
              if (!isMounted) return;

              // Recarregar dados do usuário quando houver mudanças
              try {
                const updatedData = await getUsuario(userId);
                if (isMounted) {
                  setUsuario(updatedData);
                }
              } catch (err) {
                // Erro silencioso ao atualizar via realtime
              }
            }
          )
          .subscribe();

        channelRef.current = channel;
      } catch (error) {
        if (isMounted) {
          console.error('Erro ao carregar usuário:', error);
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
    usuario, 
    loading, 
    refetch: async () => {
      if (user?.id) {
        clearUsuarioCache(user.id);
        setLoading(true);
        try {
          const data = await getUsuario(user.id);
          setUsuario(data);
        } catch (error) {
          console.error('Erro ao recarregar usuário:', error);
        } finally {
          setLoading(false);
        }
      }
    } 
  };
}

