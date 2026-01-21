'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Atendimento, Agendamento } from '@/types/domain';
import { formatTimeAgo } from '@/lib/utils/dates';
import { updateAtendimentoStatus } from '@/lib/api/atendimentos';
import { updateAgendamentoStatus } from '@/lib/api/agendamentos';
import { Phone, MoreVertical } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { filterWhatsAppUrl } from '@/lib/utils/images';

interface AtendimentoKanbanProps {
  atendimentos?: Atendimento[];
  agendamentos?: Agendamento[];
  loading: boolean;
  onSelectAtendimento: (id: string) => void;
  onStatusUpdate?: () => void;
  tipoMarcacao?: 'atendimento' | 'agendamento';
}

type KanbanStatusAtendimento = 'em_andamento' | 'encerrado';
type KanbanStatusAgendamento = 'agendado' | 'concluido' | 'cancelado';
type KanbanStatus = KanbanStatusAtendimento | KanbanStatusAgendamento;

interface KanbanColumn {
  id: KanbanStatus;
  title: string;
  topBorderColor: string;
  borderColor: string;
}

const columnsAtendimento: KanbanColumn[] = [
  { id: 'em_andamento', title: 'Em andamento', topBorderColor: 'border-blue-500', borderColor: '#3b82f6' },
  { id: 'encerrado', title: 'Finalizado', topBorderColor: 'border-gray-400', borderColor: '#9ca3af' },
];

const columnsAgendamento: KanbanColumn[] = [
  { id: 'agendado', title: 'Agendado', topBorderColor: 'border-blue-500', borderColor: '#3b82f6' },
  { id: 'concluido', title: 'Realizado', topBorderColor: 'border-green-500', borderColor: '#10b981' },
  { id: 'cancelado', title: 'Cancelado', topBorderColor: 'border-red-500', borderColor: '#ef4444' },
];

export function AtendimentoKanban({
  atendimentos = [],
  agendamentos = [],
  loading,
  onSelectAtendimento,
  onStatusUpdate,
  tipoMarcacao = 'atendimento',
}: AtendimentoKanbanProps) {
  const router = useRouter();
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [draggedItemStatus, setDraggedItemStatus] = useState<KanbanStatus | 'aberto' | 'confirmado' | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<KanbanStatus | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<{ id: string; status: KanbanStatus } | null>(null);
  // Estado para atualizações otimistas: mapeia ID do item para o novo status
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, KanbanStatus>>(new Map());

  const isAgendamento = tipoMarcacao === 'agendamento';
  const columns = isAgendamento ? columnsAgendamento : columnsAtendimento;

  // Limpar atualizações otimistas apenas quando os dados realmente mudarem com o status correto
  useEffect(() => {
    setOptimisticUpdates(prev => {
      const newMap = new Map(prev);
      // Remover apenas as atualizações otimistas que já foram sincronizadas
      // (ou seja, quando o status no servidor corresponde ao status otimista)
      for (const [itemId, optimisticStatus] of prev.entries()) {
        if (isAgendamento) {
          const agendamento = agendamentos.find(a => a.id === itemId);
          if (agendamento) {
            // Para coluna "agendado", aceita tanto 'agendado' quanto 'confirmado'
            if (optimisticStatus === 'agendado' && (agendamento.status === 'agendado' || agendamento.status === 'confirmado')) {
              newMap.delete(itemId);
            } else if (agendamento.status === optimisticStatus) {
              newMap.delete(itemId);
            }
          }
        } else {
          const atendimento = atendimentos.find(a => a.id === itemId);
          if (atendimento && atendimento.status === optimisticStatus) {
            newMap.delete(itemId);
          }
        }
      }
      return newMap;
    });
  }, [atendimentos, agendamentos, isAgendamento]);

  // Agrupar dados por status baseado no tipo, aplicando atualizações otimistas
  const dadosPorStatus = useMemo<{
    agendado?: Agendamento[];
    concluido?: Agendamento[];
    cancelado?: Agendamento[];
    em_andamento?: Atendimento[];
    encerrado?: Atendimento[];
  }>(() => {
    if (isAgendamento) {
      // Aplicar atualizações otimistas e agrupar diretamente
      const agendados: Agendamento[] = [];
      const concluidos: Agendamento[] = [];
      const cancelados: Agendamento[] = [];

      agendamentos.forEach(agendamento => {
        const optimisticStatus = optimisticUpdates.get(agendamento.id);
        const finalStatus = optimisticStatus || agendamento.status;
        
        if (finalStatus === 'agendado' || finalStatus === 'confirmado') {
          agendados.push({ ...agendamento, status: finalStatus as any });
        } else if (finalStatus === 'concluido') {
          concluidos.push({ ...agendamento, status: finalStatus as any });
        } else if (finalStatus === 'cancelado') {
          cancelados.push({ ...agendamento, status: finalStatus as any });
        }
      });

      return { agendado: agendados, concluido: concluidos, cancelado: cancelados };
    } else {
      // Aplicar atualizações otimistas e agrupar diretamente
      const emAndamento: Atendimento[] = [];
      const encerrados: Atendimento[] = [];

      atendimentos.forEach(atendimento => {
        const optimisticStatus = optimisticUpdates.get(atendimento.id);
        const finalStatus = optimisticStatus || atendimento.status;
        
        if (finalStatus === 'em_andamento' || finalStatus === 'aberto' || !finalStatus) {
          emAndamento.push({ ...atendimento, status: finalStatus === 'aberto' || !finalStatus ? 'em_andamento' as any : finalStatus as any });
        } else if (finalStatus === 'encerrado') {
          encerrados.push({ ...atendimento, status: finalStatus as any });
        }
      });

      return { em_andamento: emAndamento, encerrado: encerrados };
    }
  }, [atendimentos, agendamentos, isAgendamento, optimisticUpdates]);

  const handleDragStart = (e: React.DragEvent, itemId: string, currentStatus: string) => {
    setDraggedItem(itemId);
    setDraggedItemStatus(currentStatus as KanbanStatus | 'aberto' | 'confirmado');
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetStatus: KanbanStatus) => {
    e.preventDefault();
    
    if (isAgendamento) {
      // Para agendamentos: pode mover de qualquer status para qualquer coluna
      e.dataTransfer.dropEffect = 'move';
      setDragOverColumn(targetStatus);
    } else {
      // Para atendimentos: permitir drop apenas se estiver movendo de "em_andamento" para "encerrado"
      // ou se o status atual for "aberto" (pode ir para qualquer coluna)
      const canDrop = draggedItemStatus === 'em_andamento' || draggedItemStatus === 'aberto';
      if (canDrop) {
        e.dataTransfer.dropEffect = 'move';
        setDragOverColumn(targetStatus);
      } else {
        e.dataTransfer.dropEffect = 'none';
        setDragOverColumn(null);
      }
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: KanbanStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    
    if (!draggedItem) return;

    if (isAgendamento) {
      // Não fazer nada se já estiver no status de destino
      const agendamento = agendamentos.find(a => a.id === draggedItem);
      if (agendamento) {
        // Verificar status atual considerando atualizações otimistas
        const currentStatus = optimisticUpdates.get(draggedItem) || agendamento.status;
        
        // Se o destino for "agendado", verificar se já está em "agendado" ou "confirmado"
        if (targetStatus === 'agendado' && (currentStatus === 'agendado' || currentStatus === 'confirmado')) {
          setDraggedItem(null);
          setDraggedItemStatus(null);
          return;
        }
        // Para outros status, verificar se já está no status de destino
        if (targetStatus !== 'agendado' && currentStatus === targetStatus) {
          setDraggedItem(null);
          setDraggedItemStatus(null);
          return;
        }
      }

      // ATUALIZAÇÃO OTIMISTA: atualizar UI imediatamente
      // Para coluna "agendado", sempre usar 'agendado' como status otimista
      const finalStatus = targetStatus === 'agendado' ? 'agendado' : targetStatus;
      setOptimisticUpdates(prev => {
        const newMap = new Map(prev);
        newMap.set(draggedItem, finalStatus);
        return newMap;
      });
      setDraggedItem(null);
      setDraggedItemStatus(null);

      // Atualizar no Supabase em background (sem bloquear)
      // Para coluna "agendado", sempre atualizar para 'agendado' no servidor
      updateAgendamentoStatus(draggedItem, finalStatus as 'agendado' | 'confirmado' | 'cancelado' | 'concluido')
        .then(() => {
          // Sincronizar dados em background
          if (onStatusUpdate) {
            onStatusUpdate();
          }
        })
        .catch((error) => {
          console.error('Erro ao atualizar status:', error);
          // Reverter atualização otimista em caso de erro
          setOptimisticUpdates(prev => {
            const newMap = new Map(prev);
            newMap.delete(draggedItem);
            return newMap;
          });
          alert('Erro ao atualizar status do agendamento. Tente novamente.');
        });
    } else {
      // Validar se pode mover para o status de destino (atendimentos)
      if (draggedItemStatus !== 'em_andamento' && draggedItemStatus !== 'aberto') {
        setDraggedItem(null);
        setDraggedItemStatus(null);
        return;
      }

      // Não fazer nada se já estiver no status de destino
      const atendimento = atendimentos.find(a => a.id === draggedItem);
      if (atendimento) {
        // Verificar status atual considerando atualizações otimistas
        const currentStatus = optimisticUpdates.get(draggedItem) || atendimento.status;
        if (currentStatus === targetStatus) {
          setDraggedItem(null);
          setDraggedItemStatus(null);
          return;
        }
      }

      // Se estiver movendo para "encerrado", mostrar modal de confirmação
      if (targetStatus === 'encerrado') {
        setPendingUpdate({ id: draggedItem, status: targetStatus });
        setShowConfirmModal(true);
        setDraggedItem(null);
        setDraggedItemStatus(null);
        return;
      }

      // ATUALIZAÇÃO OTIMISTA: atualizar UI imediatamente
      setOptimisticUpdates(prev => {
        const newMap = new Map(prev);
        newMap.set(draggedItem, targetStatus);
        return newMap;
      });
      setDraggedItem(null);
      setDraggedItemStatus(null);

      // Atualizar no Supabase em background (sem bloquear)
      updateAtendimentoStatus(draggedItem, targetStatus as 'em_andamento' | 'encerrado')
        .then(() => {
          // Sincronizar dados em background
          if (onStatusUpdate) {
            onStatusUpdate();
          }
        })
        .catch((error) => {
          console.error('Erro ao atualizar status:', error);
          // Reverter atualização otimista em caso de erro
          setOptimisticUpdates(prev => {
            const newMap = new Map(prev);
            newMap.delete(draggedItem);
            return newMap;
          });
          alert('Erro ao atualizar status do atendimento. Tente novamente.');
        });
    }
  };

  const handleConfirmFinalizacao = async () => {
    if (!pendingUpdate) return;

    // ATUALIZAÇÃO OTIMISTA: atualizar UI imediatamente
    setOptimisticUpdates(prev => {
      const newMap = new Map(prev);
      newMap.set(pendingUpdate.id, pendingUpdate.status);
      return newMap;
    });
    setShowConfirmModal(false);
    const updateId = pendingUpdate.id;
    const updateStatus = pendingUpdate.status;
    setPendingUpdate(null);

    // Atualizar no Supabase em background (sem bloquear)
    const updatePromise = isAgendamento
      ? updateAgendamentoStatus(updateId, updateStatus as 'agendado' | 'confirmado' | 'cancelado' | 'concluido')
      : updateAtendimentoStatus(updateId, updateStatus as 'em_andamento' | 'encerrado');

    updatePromise
      .then(() => {
        // Sincronizar dados em background
        if (onStatusUpdate) {
          onStatusUpdate();
        }
      })
      .catch((error) => {
        console.error('Erro ao atualizar status:', error);
        // Reverter atualização otimista em caso de erro
        setOptimisticUpdates(prev => {
          const newMap = new Map(prev);
          newMap.delete(updateId);
          return newMap;
        });
        alert(`Erro ao atualizar status do ${isAgendamento ? 'agendamento' : 'atendimento'}. Tente novamente.`);
      });
  };

  const handleCancelFinalizacao = () => {
    setShowConfirmModal(false);
    setPendingUpdate(null);
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getAvatarColor = (name?: string) => {
    if (!name) return 'bg-gray-400';
    const colors = [
      'bg-red-400',
      'bg-blue-400',
      'bg-green-400',
      'bg-yellow-400',
      'bg-purple-400',
      'bg-pink-400',
      'bg-indigo-400',
      'bg-orange-400',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const handleWhatsApp = (e: React.MouseEvent, telefone: string) => {
    e.stopPropagation();
    // Remove caracteres não numéricos do telefone
    const numeroLimpo = telefone.replace(/\D/g, '');
    // Abre o WhatsApp Web/App com o número
    window.open(`https://wa.me/${numeroLimpo}`, '_blank');
  };

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const itemParaConfirmar = pendingUpdate 
    ? (isAgendamento 
        ? agendamentos.find(a => a.id === pendingUpdate.id)
        : atendimentos.find(a => a.id === pendingUpdate.id))
    : null;

  const itemNome = isAgendamento 
    ? (itemParaConfirmar as Agendamento | undefined)?.cliente_nome
    : (itemParaConfirmar as Atendimento | undefined)?.cliente_nome;

  return (
    <>
      <Modal
        isOpen={showConfirmModal}
        onClose={handleCancelFinalizacao}
        title={isAgendamento ? "Confirmar Alteração" : "Confirmar Finalização"}
        closeOnClickOutside={false}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Deseja realmente {isAgendamento ? 'alterar o status' : 'finalizar o atendimento'} do lead{' '}
            <strong>{itemNome || 'Cliente'}</strong>?
          </p>
          <p className="text-sm text-gray-500">
            {isAgendamento 
              ? 'Esta ação alterará o status do agendamento.'
              : 'Esta ação moverá o atendimento para a coluna de finalizados.'}
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={handleCancelFinalizacao}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmFinalizacao}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>

      <div className="flex gap-6 overflow-x-auto pb-4">
        {columns.map((column) => {
        const columnItems = (dadosPorStatus[column.id as keyof typeof dadosPorStatus] || []) as (Atendimento | Agendamento)[];
        const clientCount = columnItems.length;

        const isDragOver = dragOverColumn === column.id;
        const canDropHere = isAgendamento 
          ? true // Para agendamentos, sempre permite drop
          : (draggedItemStatus === 'em_andamento' || draggedItemStatus === 'aberto');

        const getColumnTextColor = () => {
          if (isAgendamento) {
            if (column.id === 'agendado') return 'text-blue-600';
            if (column.id === 'concluido') return 'text-green-600';
            if (column.id === 'cancelado') return 'text-red-600';
          } else {
            return column.id === 'em_andamento' ? 'text-blue-600' : 'text-gray-500';
          }
          return 'text-gray-500';
        };

        return (
          <div
            key={column.id}
            className={`flex-shrink-0 w-80 bg-white rounded-lg shadow-sm border-l border-r border-b border-gray-50 transition-all flex flex-col ${
              isDragOver && canDropHere ? 'bg-blue-50 border-[#9a9a9a] border-opacity-50 shadow-md' : ''
            }`}
            style={{ borderTopWidth: '4px', borderTopStyle: 'solid', borderTopColor: column.borderColor }}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Header da coluna */}
            <div className="p-4 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-sm font-medium ${getColumnTextColor()}`}>
                  {column.title}
                </h3>
                <span className="text-gray-600 text-sm">
                  {clientCount} {clientCount === 1 
                    ? (isAgendamento ? 'agendamento' : 'atendimento')
                    : (isAgendamento ? 'agendamentos' : 'atendimentos')}
                </span>
              </div>
            </div>

            {/* Cards */}
            <div className="p-4 space-y-3">
              {columnItems.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-lg py-12 text-center">
                  <span className="text-gray-400 text-sm">
                    Nenhum {isAgendamento ? 'agendamento' : 'atendimento'}
                  </span>
                </div>
              ) : (
                columnItems.map((item) => {
                  const isDragging = draggedItem === item.id;
                  
                  const itemData = item as Atendimento | Agendamento;
                  const clienteNome = itemData.cliente_nome;
                  const clienteFoto = itemData.cliente_foto_perfil;
                  const telefoneCliente = isAgendamento 
                    ? (itemData as Agendamento).telefone_cliente || ''
                    : (itemData as Atendimento).telefone_cliente;
                  const clienteId = itemData.cliente_id;
                  const createdAt = itemData.created_at;
                  const status = itemData.status;

                  // Determinar se o item pode ser arrastado
                  const canDrag = isAgendamento
                    ? true // Para agendamentos, sempre permite arrastar
                    : (status === 'em_andamento' || status === 'aberto' || !status);

                  return (
                    <div
                      key={item.id}
                      draggable={canDrag}
                      onDragStart={(e) => handleDragStart(e, item.id, status || (isAgendamento ? 'agendado' : 'aberto'))}
                      onDragEnd={() => {
                        setDraggedItem(null);
                        setDraggedItemStatus(null);
                        setDragOverColumn(null);
                      }}
                      onClick={() => {
                        // Navegar para a página de mensagens com o cliente_id
                        router.push(`/mensagens?cliente_id=${clienteId}`);
                      }}
                      className={`
                        bg-white border border-gray-200 rounded-lg p-4 transition-all
                        ${isDragging ? 'opacity-50 cursor-grabbing' : 'cursor-pointer hover:shadow-md'}
                        ${canDrag ? 'hover:border-gray-400' : 'cursor-not-allowed opacity-60'}
                      `}
                    >
                      {/* Primeira linha: Foto Cliente | Nome | Ícone WhatsApp */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {filterWhatsAppUrl(clienteFoto) ? (
                            <img
                              src={filterWhatsAppUrl(clienteFoto)!}
                              alt={clienteNome || 'Cliente'}
                              className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-gray-200"
                            />
                          ) : (
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${getAvatarColor(
                                clienteNome
                              )}`}
                            >
                              {getInitials(clienteNome)}
                            </div>
                          )}
                          <h4 className="text-gray-900 text-sm font-semibold truncate">
                            {clienteNome || `Cliente ${clienteId.substring(0, 8)}`}
                          </h4>
                        </div>
                        {telefoneCliente && (
                          <button
                            onClick={(e) => handleWhatsApp(e, telefoneCliente)}
                            className="p-1 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors flex-shrink-0"
                            title="Abrir WhatsApp"
                          >
                            <WhatsAppIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Segunda linha: Telefone Cliente | Tempo cadastrado */}
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        {telefoneCliente && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span>{telefoneCliente}</span>
                          </div>
                        )}
                        <span className="text-gray-400 text-xs">
                          {formatTimeAgo(createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
      </div>
    </>
  );
}
