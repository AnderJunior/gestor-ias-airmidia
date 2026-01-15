'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { getAtendimentoById, deleteAtendimento } from '@/lib/api/atendimentos';
import { getAgendamentoById, deleteAgendamento } from '@/lib/api/agendamentos';
import { supabase } from '@/lib/supabaseClient';
import { Atendimento, Agendamento, StatusAgendamento } from '@/types/domain';
import { Trash2, Calendar, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { formatDateTime } from '@/lib/utils/dates';
import { useUsuario } from '@/hooks/useUsuario';

interface AtendimentoSidebarProps {
  atendimentoId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export function AtendimentoSidebar({ atendimentoId, isOpen, onClose, onRefresh }: AtendimentoSidebarProps) {
  const { usuario } = useUsuario();
  const isAgendamento = usuario?.tipo_marcacao === 'agendamento';
  
  const [atendimento, setAtendimento] = useState<Atendimento | null>(null);
  const [agendamento, setAgendamento] = useState<Agendamento | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen || !atendimentoId) {
      setAtendimento(null);
      setAgendamento(null);
      // Limpar subscription quando o sidebar fechar
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    let isMounted = true;

    async function setupRealtime() {
      if (!atendimentoId) return;
      
      const currentAtendimentoId = atendimentoId; // Capturar valor para garantir tipo não-null
      
      try {
        setLoading(true);

        if (isAgendamento) {
          // Carregar agendamento inicial
          const data = await getAgendamentoById(currentAtendimentoId);
          if (!isMounted) return;

          setAgendamento(data);
          setLoading(false);

          // Armazenar cliente_id para usar no filtro do realtime
          const clienteId = data?.cliente_id;

          // Limpar subscription anterior se existir
          if (channelRef.current) {
            await supabase.removeChannel(channelRef.current);
          }

          // Criar subscription para mudanças neste agendamento específico
          const channel = supabase
            .channel(`agendamento-sidebar:${currentAtendimentoId}`)
            .on(
              'postgres_changes',
              {
                event: '*', // Escutar INSERT, UPDATE, DELETE
                schema: 'public',
                table: 'agendamentos',
                filter: `id=eq.${currentAtendimentoId}`,
              },
              async (payload) => {
                if (!isMounted) return;

                // Se foi deletado, fechar o sidebar
                if (payload.eventType === 'DELETE') {
                  if (onRefresh) {
                    onRefresh();
                  }
                  onClose();
                  return;
                }

                // Recarregar agendamento quando houver mudanças
                try {
                  const updatedData = await getAgendamentoById(currentAtendimentoId);
                  if (isMounted) {
                    setAgendamento(updatedData);
                  }
                } catch (err) {
                  console.error('Erro ao atualizar agendamento via realtime:', err);
                }
              }
            );

          // Escutar mudanças na tabela clientes apenas se houver cliente_id
          if (clienteId) {
            channel.on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'clientes',
                filter: `id=eq.${clienteId}`,
              },
              async (payload) => {
                if (!isMounted) return;

                // Recarregar agendamento quando dados do cliente mudarem
                try {
                  const updatedData = await getAgendamentoById(currentAtendimentoId);
                  if (isMounted) {
                    setAgendamento(updatedData);
                  }
                } catch (err) {
                  console.error('Erro ao atualizar agendamento após mudança no cliente:', err);
                }
              }
            );
          }

          channel.subscribe();

          channelRef.current = channel;
        } else {
          // Carregar atendimento inicial
          const data = await getAtendimentoById(currentAtendimentoId);
          if (!isMounted) return;

          setAtendimento(data);
          setLoading(false);

          // Armazenar cliente_id para usar no filtro do realtime
          const clienteId = data?.cliente_id;

          // Limpar subscription anterior se existir
          if (channelRef.current) {
            await supabase.removeChannel(channelRef.current);
          }

          // Criar subscription para mudanças neste atendimento específico
          const channel = supabase
            .channel(`atendimento-sidebar:${currentAtendimentoId}`)
            .on(
              'postgres_changes',
              {
                event: '*', // Escutar INSERT, UPDATE, DELETE
                schema: 'public',
                table: 'atendimentos_solicitado',
                filter: `id=eq.${currentAtendimentoId}`,
              },
              async (payload) => {
                if (!isMounted) return;

                // Se foi deletado, fechar o sidebar
                if (payload.eventType === 'DELETE') {
                  if (onRefresh) {
                    onRefresh();
                  }
                  onClose();
                  return;
                }

                // Recarregar atendimento quando houver mudanças
                try {
                  const updatedData = await getAtendimentoById(currentAtendimentoId);
                  if (isMounted) {
                    setAtendimento(updatedData);
                  }
                } catch (err) {
                  console.error('Erro ao atualizar atendimento via realtime:', err);
                }
              }
            );

          // Escutar mudanças na tabela clientes apenas se houver cliente_id
          if (clienteId) {
            channel.on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'clientes',
                filter: `id=eq.${clienteId}`,
              },
              async (payload) => {
                if (!isMounted) return;

                // Recarregar atendimento quando dados do cliente mudarem
                try {
                  const updatedData = await getAtendimentoById(currentAtendimentoId);
                  if (isMounted) {
                    setAtendimento(updatedData);
                  }
                } catch (err) {
                  console.error('Erro ao atualizar atendimento após mudança no cliente:', err);
                }
              }
            );
          }

          channel.subscribe();

          channelRef.current = channel;
        }
      } catch (error) {
        if (isMounted) {
          console.error('Erro ao carregar dados:', error);
          setLoading(false);
        }
      }
    }

    setupRealtime();

    // Cleanup: remover subscription quando o componente desmontar ou atendimentoId mudar
    return () => {
      isMounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [isOpen, atendimentoId, onClose, onRefresh, isAgendamento]);

  const handleDelete = () => {
    if (atendimentoId) {
      setShowDeleteModal(true);
    }
  };

  const handleConfirmDelete = async () => {
    if (!atendimentoId) return;

    setDeletingId(atendimentoId);
    try {
      if (isAgendamento) {
        await deleteAgendamento(atendimentoId);
      } else {
        await deleteAtendimento(atendimentoId);
      }
      if (onRefresh) {
        onRefresh();
      }
      setShowDeleteModal(false);
      onClose();
    } catch (error: any) {
      console.error(`Erro ao excluir ${isAgendamento ? 'agendamento' : 'atendimento'}:`, error);
      const errorMessage = error?.message || `Erro ao excluir ${isAgendamento ? 'agendamento' : 'atendimento'}. Tente novamente.`;
      alert(errorMessage);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
  };

  const handleWhatsApp = () => {
    const telefone = isAgendamento ? agendamento?.telefone_cliente : atendimento?.telefone_cliente;
    if (!telefone) return;
    // Remove caracteres não numéricos do telefone
    const numeroLimpo = telefone.replace(/\D/g, '');
    // Abre o WhatsApp Web/App com o número
    window.open(`https://wa.me/${numeroLimpo}`, '_blank');
  };

  const getStatusLabel = (status: StatusAgendamento) => {
    const labels = {
      agendado: 'Agendado',
      confirmado: 'Confirmado',
      cancelado: 'Cancelado',
      concluido: 'Realizado',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: StatusAgendamento) => {
    const colors = {
      agendado: 'bg-blue-100 text-blue-700',
      confirmado: 'bg-green-100 text-green-700',
      cancelado: 'bg-red-100 text-red-700',
      concluido: 'bg-gray-100 text-gray-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const itemNome = isAgendamento 
    ? agendamento?.cliente_nome 
    : atendimento?.cliente_nome;

  const WhatsAppIcon = ({ className }: { className?: string }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="https://www.w3.org/2000/svg"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={showDeleteModal}
        onClose={handleCancelDelete}
        title="Confirmar Exclusão"
        closeOnClickOutside={false}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Deseja realmente excluir o {isAgendamento ? 'agendamento' : 'atendimento'} do lead{' '}
            <strong>{itemNome || 'Cliente'}</strong>?
          </p>
          <p className="text-sm text-gray-500">
            Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={handleCancelDelete}
              disabled={deletingId === atendimentoId}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              disabled={deletingId === atendimentoId}
            >
              {deletingId === atendimentoId ? 'Excluindo...' : 'Confirmar Exclusão'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {isAgendamento ? 'Detalhes do Agendamento' : 'Detalhes do Atendimento'}
          </h2>
          <div className="flex items-center gap-2">
            {atendimentoId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                title={`Excluir ${isAgendamento ? 'agendamento' : 'atendimento'}`}
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center text-gray-500 py-12">
              <p>Carregando...</p>
            </div>
          ) : (isAgendamento ? agendamento : atendimento) ? (
            <div className="space-y-6">
              {isAgendamento && agendamento ? (
                <>
                  {/* Status, Data/Hora e Resumo da Conversa */}
                  <div className="space-y-4">
                    {/* Status e Data/Hora lado a lado, alinhados à esquerda */}
                    <div className="flex items-start gap-4">
                      {/* Status do Agendamento */}
                      <div className="flex-shrink-0">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Status</h3>
                        <div className={`inline-flex items-center px-3 py-1.5 rounded-lg font-semibold text-sm ${getStatusColor(agendamento.status)}`}>
                          {getStatusLabel(agendamento.status)}
                        </div>
                      </div>

                      {/* Data e Hora Agendadas */}
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Data e Hora Agendadas</h3>
                        <div className="bg-gray-50 rounded-lg p-2 border border-gray-200 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <span className="text-gray-800 font-medium text-sm">
                            {formatDateTime(agendamento.data_e_hora)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Resumo da Conversa */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Resumo da Conversa</h3>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        {agendamento.resumo_conversa ? (
                          <p className="text-gray-800 whitespace-pre-wrap">{agendamento.resumo_conversa}</p>
                        ) : (
                          <p className="text-gray-400 italic">Nenhum resumo disponível</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Link da Reunião */}
                  {agendamento.link_agendamento && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Link da Reunião</h3>
                      <a
                        href={agendamento.link_agendamento}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-50 rounded-lg p-4 border border-blue-200 flex items-center gap-2 hover:bg-blue-100 transition-colors"
                      >
                        <LinkIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <span className="text-blue-600 font-medium truncate flex-1">
                          {agendamento.link_agendamento}
                        </span>
                        <ExternalLink className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      </a>
                    </div>
                  )}

                  {/* Botão Chamar no WhatsApp */}
                  {agendamento.telefone_cliente && (
                    <div>
                      <Button
                        variant="primary"
                        onClick={handleWhatsApp}
                        className="w-full flex items-center justify-center gap-2"
                      >
                        <WhatsAppIcon className="w-5 h-5" />
                        Chamar no WhatsApp
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Resumo do Atendimento */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Resumo do Atendimento</h3>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      {atendimento?.resumo_conversa ? (
                        <p className="text-gray-800 whitespace-pre-wrap">{atendimento.resumo_conversa}</p>
                      ) : (
                        <p className="text-gray-400 italic">Nenhum resumo disponível</p>
                      )}
                    </div>
                  </div>

                  {/* Botão Chamar no WhatsApp */}
                  {atendimento?.telefone_cliente && (
                    <div>
                      <Button
                        variant="primary"
                        onClick={handleWhatsApp}
                        className="w-full flex items-center justify-center gap-2"
                      >
                        <WhatsAppIcon className="w-5 h-5" />
                        Chamar no WhatsApp
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-12">
              <p>{isAgendamento ? 'Agendamento' : 'Atendimento'} não encontrado</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

