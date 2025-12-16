'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useAuth } from '@/hooks/useAuth';
import { getAtendimentosRecentes } from '@/lib/api/atendimentos';
import { Atendimento } from '@/types/domain';
import { ROUTES } from '@/lib/constants';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AtendimentoNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: Date;
  atendimentoId: string;
}

export function NotificationsModal({ isOpen, onClose }: NotificationsModalProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } = useNotifications();
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [atendimentosNotifications, setAtendimentosNotifications] = useState<AtendimentoNotification[]>([]);
  
  // Carregar IDs de atendimentos lidos do localStorage
  const loadReadAtendimentosIds = (): Set<string> => {
    if (typeof window === 'undefined') return new Set();
    const stored = localStorage.getItem('readAtendimentosIds');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  };

  const [readAtendimentosIds, setReadAtendimentosIds] = useState<Set<string>>(loadReadAtendimentosIds());

  // Salvar IDs de atendimentos lidos no localStorage
  const saveReadAtendimentosIds = (ids: Set<string>) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('readAtendimentosIds', JSON.stringify([...ids]));
    }
  };

  useEffect(() => {
    if (isOpen && user?.id) {
      setIsLoading(true);
      loadAtendimentosRecentes();
    }
  }, [isOpen, user?.id]);

  const loadAtendimentosRecentes = async () => {
    if (!user?.id) return;

    try {
      const atendimentos = await getAtendimentosRecentes(user.id);
      
      // Converter atendimentos em notificações
      const novasNotificacoes: AtendimentoNotification[] = atendimentos.map((atendimento: Atendimento) => {
        const dataCriacao = new Date(atendimento.created_at);
        const horasAtras = Math.floor((Date.now() - dataCriacao.getTime()) / (1000 * 60 * 60));
        const minutosAtras = Math.floor((Date.now() - dataCriacao.getTime()) / (1000 * 60));
        
        let tempoAtras = '';
        if (horasAtras > 0) {
          tempoAtras = `${horasAtras} hora${horasAtras > 1 ? 's' : ''} atrás`;
        } else if (minutosAtras > 0) {
          tempoAtras = `${minutosAtras} minuto${minutosAtras > 1 ? 's' : ''} atrás`;
        } else {
          tempoAtras = 'Agora';
        }

        return {
          id: `atendimento-${atendimento.id}`,
          title: `Nova solicitação de atendimento`,
          message: `Cliente: ${atendimento.cliente_nome || 'Sem nome'}\nTelefone: ${atendimento.telefone_cliente}\n${tempoAtras}`,
          type: 'info' as const,
          read: readAtendimentosIds.has(atendimento.id),
          createdAt: dataCriacao,
          atendimentoId: atendimento.id,
        };
      });

      setAtendimentosNotifications(novasNotificacoes);
    } catch (error) {
      console.error('Erro ao carregar atendimentos recentes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAtendimentoClick = (atendimentoId: string, notificationId: string) => {
    // Marcar como lida
    setReadAtendimentosIds(prev => new Set([...prev, atendimentoId]));
    
    // Fechar modal e navegar para a página de atendimento
    onClose();
    router.push(ROUTES.ATENDIMENTO);
    
    // Usar um pequeno delay para garantir que a página carregou antes de tentar abrir o atendimento
    setTimeout(() => {
      // Disparar um evento customizado para abrir o atendimento
      window.dispatchEvent(new CustomEvent('openAtendimento', { detail: { atendimentoId } }));
    }, 100);
  };

  const markAtendimentoAsRead = (notificationId: string) => {
    const notification = atendimentosNotifications.find(n => n.id === notificationId);
    if (notification) {
      const newSet = new Set([...readAtendimentosIds, notification.atendimentoId]);
      setReadAtendimentosIds(newSet);
      saveReadAtendimentosIds(newSet);
      // Atualizar o estado das notificações para refletir a mudança na UI
      setAtendimentosNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
      );
      // Disparar evento para atualizar o contador no Topbar
      window.dispatchEvent(new CustomEvent('atendimentoMarkedAsRead'));
    }
  };

  const markAllAtendimentosAsRead = () => {
    const allIds = atendimentosNotifications.map(n => n.atendimentoId);
    const newSet = new Set([...readAtendimentosIds, ...allIds]);
    setReadAtendimentosIds(newSet);
    saveReadAtendimentosIds(newSet);
    // Atualizar o estado das notificações para refletir a mudança na UI
    setAtendimentosNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
    // Disparar evento para atualizar o contador no Topbar
    window.dispatchEvent(new CustomEvent('atendimentoMarkedAsRead'));
  };

  // Combinar notificações do contexto com notificações de atendimentos
  const allNotifications = [
    ...atendimentosNotifications.map(n => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      read: n.read,
      createdAt: n.createdAt,
      action: {
        label: 'Ver atendimento',
        onClick: () => handleAtendimentoClick(n.atendimentoId, n.id),
      },
    })),
    ...notifications,
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const totalUnreadCount = allNotifications.filter(n => !n.read).length;

  if (!isOpen) return null;

  const formatDate = (date: Date) => {
    const dataFormatada = date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const horaFormatada = date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${dataFormatada}, ${horaFormatada}`;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'success':
        return (
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
          </svg>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pt-16 pr-4">
      <div className="fixed inset-0 bg-black bg-opacity-25" onClick={onClose}></div>
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Notificações</h2>
            {totalUnreadCount > 0 && (
              <span className="text-sm text-gray-500">({totalUnreadCount} não lidas)</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {totalUnreadCount > 0 && (
              <button
                onClick={() => {
                  markAllAsRead();
                  markAllAtendimentosAsRead();
                }}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Marcar todas como lidas
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Fechar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
              <p>Carregando...</p>
            </div>
          ) : allNotifications.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <svg
                className="w-12 h-12 mx-auto mb-3 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <p>Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {allNotifications.map((notification) => {
                const isAtendimentoNotification = notification.id.startsWith('atendimento-');
                
                return (
                  <div
                    key={notification.id}
                    className={`px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                      !notification.read ? 'bg-primary-50' : ''
                    }`}
                    onClick={() => {
                      if (!notification.read) {
                        if (isAtendimentoNotification) {
                          markAtendimentoAsRead(notification.id);
                        } else {
                          markAsRead(notification.id);
                        }
                      }
                      if (notification.action) {
                        notification.action.onClick();
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-gray-900">{notification.title}</h3>
                          {!notification.read && (
                            <div className="flex-shrink-0 w-2 h-2 bg-primary-600 rounded-full mt-1.5"></div>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-gray-600 whitespace-pre-line">
                          {notification.message.split('\n').map((line, index) => (
                            <div key={index}>{line}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

