'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/lib/constants';
import { useNotifications } from '@/contexts/NotificationsContext';
import { NotificationsModal } from '@/components/notifications/NotificationsModal';
import { useAuth } from '@/hooks/useAuth';
import { getAtendimentosRecentes } from '@/lib/api/atendimentos';

const pageTitles: Record<string, string> = {
  [ROUTES.DASHBOARD]: 'Dashboard',
  [ROUTES.ATENDIMENTO]: 'Atendimento',
  [ROUTES.MENSAGENS]: 'Mensagens',
  [ROUTES.CONFIGURACOES]: 'Configurações',
  [ROUTES.ADMIN_DASHBOARD]: 'Dashboard',
  [ROUTES.ADMIN_CLIENTES]: 'Clientes',
};

export function Topbar() {
  const pathname = usePathname();
  
  // Verificar se é a página de detalhes do cliente
  const isClienteDetailPage = pathname.startsWith('/admin/clientes/') && pathname !== ROUTES.ADMIN_CLIENTES;
  
  const pageTitle = isClienteDetailPage 
    ? 'Detalhes do cliente'
    : (pageTitles[pathname] || 'Dashboard');
  const { unreadCount } = useNotifications();
  const { user } = useAuth();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadAtendimentosCount, setUnreadAtendimentosCount] = useState(0);

  // Carregar IDs de atendimentos lidos do localStorage
  const loadReadAtendimentosIds = (): Set<string> => {
    if (typeof window === 'undefined') return new Set();
    const stored = localStorage.getItem('readAtendimentosIds');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  };

  // Calcular notificações não lidas de atendimentos
  useEffect(() => {
    if (!user?.id) {
      setUnreadAtendimentosCount(0);
      return;
    }

    const calculateUnreadAtendimentos = async () => {
      try {
        const atendimentos = await getAtendimentosRecentes(user.id);
        const readAtendimentosIds = loadReadAtendimentosIds();
        
        // Contar atendimentos não lidos
        const unreadCount = atendimentos.filter(
          atendimento => !readAtendimentosIds.has(atendimento.id)
        ).length;
        
        setUnreadAtendimentosCount(unreadCount);
      } catch (error) {
        console.error('Erro ao calcular atendimentos não lidos:', error);
        setUnreadAtendimentosCount(0);
      }
    };

    calculateUnreadAtendimentos();

    // Atualizar a cada 30 segundos
    const interval = setInterval(calculateUnreadAtendimentos, 30000);

    // Escutar mudanças no localStorage para atualizar quando notificações forem marcadas como lidas
    const handleStorageChange = () => {
      calculateUnreadAtendimentos();
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Também escutar eventos customizados quando notificações são marcadas como lidas na mesma aba
    window.addEventListener('atendimentoMarkedAsRead', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('atendimentoMarkedAsRead', handleStorageChange);
    };
  }, [user?.id]);

  // Atualizar contador quando o modal de notificações for fechado
  useEffect(() => {
    if (!isNotificationsOpen && user?.id) {
      // Recalcular quando o modal fechar para atualizar o contador
      const calculateUnreadAtendimentos = async () => {
        try {
          const atendimentos = await getAtendimentosRecentes(user.id);
          const readAtendimentosIds = loadReadAtendimentosIds();
          
          const unreadCount = atendimentos.filter(
            atendimento => !readAtendimentosIds.has(atendimento.id)
          ).length;
          
          setUnreadAtendimentosCount(unreadCount);
        } catch (error) {
          console.error('Erro ao calcular atendimentos não lidos:', error);
        }
      };
      
      calculateUnreadAtendimentos();
    }
  }, [isNotificationsOpen, user?.id]);

  // Calcular total de notificações não lidas
  const totalUnreadCount = unreadCount + unreadAtendimentosCount;

  return (
    <>
      <header className="bg-white border-b border-gray-100 px-8 py-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bem-vindo de volta!</h1>
            <p className="text-sm text-gray-500 mt-1">{pageTitle}</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Ícone de Notificações */}
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {totalUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-primary-600 text-white text-xs font-semibold rounded-full flex items-center justify-center px-1.5">
                  {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
                </span>
              )}
            </button>
          
          <Link 
            href={ROUTES.CONFIGURACOES}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            title="Configurações"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
          
          {/* Barra de busca */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar..."
              className="pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent w-64"
            />
            <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>
    </header>
    <NotificationsModal isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
    </>
  );
}

