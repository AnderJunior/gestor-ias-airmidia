'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import {
  clearPresentationSession,
  getPresentationSession,
  type PresentationSessionState,
} from '@/lib/presentationSession';

export function PresentationBar() {
  const { user } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<PresentationSessionState | null>(null);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const checkState = () => {
      setState(getPresentationSession());
    };
    
    // Verificar estado inicial
    checkState();
    
    // Escutar mudanças no sessionStorage (caso seja alterado em outra aba)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'presentationSession') {
        checkState();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Também verificar periodicamente (para mudanças na mesma aba)
    const interval = setInterval(checkState, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Se não houver estado salvo, não renderiza nada
  const shouldShow = useMemo(() => {
    if (!state) return false;
    if (!user?.id) return false;
    // Mostrar apenas quando o usuário atual não for o admin salvo (ou seja, estamos “dentro” do cliente)
    return user.id !== state.admin.userId;
  }, [state, user?.id]);

  const handleExit = async () => {
    if (!state) return;
    setExiting(true);
    try {
      const { error } = await supabase.auth.setSession({
        access_token: state.admin.access_token,
        refresh_token: state.admin.refresh_token,
      });

      // Se falhar (token expirado, etc.), cair para logout normal
      if (error) {
        clearPresentationSession();
        await supabase.auth.signOut();
        router.push('/login');
        return;
      }

      clearPresentationSession();
      router.push(state.returnTo || '/admin/clientes');
      router.refresh();
    } finally {
      setExiting(false);
    }
  };

  if (!shouldShow || !state) return null;

  return (
    <div className="w-full text-white border-b border-black/10" style={{ backgroundColor: '#880BDB' }}>
      <div className="px-8 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-[220px]">
          <span className="inline-flex items-center gap-2 bg-amber-400 text-black font-semibold text-sm px-3 py-1 rounded-full">
            Modo de apresentação
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-black/10 text-black text-xs font-bold">
              i
            </span>
          </span>
        </div>

        <div className="flex-1 text-center font-semibold truncate text-white">
          Você está gerenciando a conta de {state.cliente.email}
        </div>

        <div className="min-w-[220px] flex justify-end">
          <button
            onClick={handleExit}
            disabled={exiting}
            className="bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed font-semibold text-sm px-5 py-2 rounded-lg transition-colors"
            style={{ color: '#880BDB' }}
          >
            {exiting ? 'Saindo...' : 'Sair'}
          </button>
        </div>
      </div>
    </div>
  );
}

