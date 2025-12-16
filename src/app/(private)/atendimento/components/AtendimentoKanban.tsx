'use client';

import { useState } from 'react';
import { Atendimento } from '@/types/domain';
import { formatTimeAgo } from '@/lib/utils/dates';
import { updateAtendimentoStatus } from '@/lib/api/atendimentos';
import { Phone, MoreVertical } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface AtendimentoKanbanProps {
  atendimentos: Atendimento[];
  loading: boolean;
  onSelectAtendimento: (id: string) => void;
  onStatusUpdate?: () => void;
}

type KanbanStatus = 'em_andamento' | 'encerrado';

interface KanbanColumn {
  id: KanbanStatus;
  title: string;
  topBorderColor: string;
}

const columns: KanbanColumn[] = [
  { id: 'em_andamento', title: 'Em andamento', topBorderColor: 'border-blue-500' },
  { id: 'encerrado', title: 'Finalizado', topBorderColor: 'border-gray-400' },
];

export function AtendimentoKanban({
  atendimentos,
  loading,
  onSelectAtendimento,
  onStatusUpdate,
}: AtendimentoKanbanProps) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [draggedItemStatus, setDraggedItemStatus] = useState<KanbanStatus | 'aberto' | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<KanbanStatus | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<{ id: string; status: KanbanStatus } | null>(null);

  // Agrupar atendimentos por status
  const atendimentosPorStatus = {
    em_andamento: atendimentos.filter((a) => a.status === 'em_andamento'),
    encerrado: atendimentos.filter((a) => a.status === 'encerrado'),
  };

  // Atendimentos sem status definido (aberto) vão para "em_andamento" por padrão
  const atendimentosAbertos = atendimentos.filter((a) => a.status === 'aberto' || !a.status);
  atendimentosPorStatus.em_andamento = [
    ...atendimentosPorStatus.em_andamento,
    ...atendimentosAbertos,
  ];

  const handleDragStart = (e: React.DragEvent, atendimentoId: string, currentStatus: string) => {
    setDraggedItem(atendimentoId);
    setDraggedItemStatus(currentStatus as KanbanStatus | 'aberto');
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetStatus: KanbanStatus) => {
    e.preventDefault();
    
    // Permitir drop apenas se estiver movendo de "em_andamento" para "encerrado"
    // ou se o status atual for "aberto" (pode ir para qualquer coluna)
    const canDrop = draggedItemStatus === 'em_andamento' || draggedItemStatus === 'aberto';
    
    if (canDrop) {
      e.dataTransfer.dropEffect = 'move';
      setDragOverColumn(targetStatus);
    } else {
      e.dataTransfer.dropEffect = 'none';
      setDragOverColumn(null);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: KanbanStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    
    if (!draggedItem) return;

    // Validar se pode mover para o status de destino
    // Permitir mover de "em_andamento" ou "aberto" para "encerrado"
    if (draggedItemStatus !== 'em_andamento' && draggedItemStatus !== 'aberto') {
      setDraggedItem(null);
      setDraggedItemStatus(null);
      return;
    }

    // Não fazer nada se já estiver no status de destino
    const atendimento = atendimentos.find(a => a.id === draggedItem);
    if (atendimento && atendimento.status === targetStatus) {
      setDraggedItem(null);
      setDraggedItemStatus(null);
      return;
    }

    // Se estiver movendo para "encerrado", mostrar modal de confirmação
    if (targetStatus === 'encerrado') {
      setPendingUpdate({ id: draggedItem, status: targetStatus });
      setShowConfirmModal(true);
      setDraggedItem(null);
      setDraggedItemStatus(null);
      return;
    }

    // Para outros status, atualizar diretamente
    setUpdating(draggedItem);
    try {
      await updateAtendimentoStatus(draggedItem, targetStatus);
      if (onStatusUpdate) {
        onStatusUpdate();
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status do atendimento. Tente novamente.');
    } finally {
      setUpdating(null);
      setDraggedItem(null);
      setDraggedItemStatus(null);
    }
  };

  const handleConfirmFinalizacao = async () => {
    if (!pendingUpdate) return;

    setUpdating(pendingUpdate.id);
    try {
      await updateAtendimentoStatus(pendingUpdate.id, pendingUpdate.status);
      if (onStatusUpdate) {
        onStatusUpdate();
      }
      setShowConfirmModal(false);
      setPendingUpdate(null);
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status do atendimento. Tente novamente.');
    } finally {
      setUpdating(null);
    }
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
      xmlns="http://www.w3.org/2000/svg"
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

  const atendimentoParaConfirmar = pendingUpdate 
    ? atendimentos.find(a => a.id === pendingUpdate.id)
    : null;

  return (
    <>
      <Modal
        isOpen={showConfirmModal}
        onClose={handleCancelFinalizacao}
        title="Confirmar Finalização"
        closeOnClickOutside={false}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Deseja realmente finalizar o atendimento do lead{' '}
            <strong>{atendimentoParaConfirmar?.cliente_nome || 'Cliente'}</strong>?
          </p>
          <p className="text-sm text-gray-500">
            Esta ação moverá o atendimento para a coluna de finalizados.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={handleCancelFinalizacao}
              disabled={updating === pendingUpdate?.id}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmFinalizacao}
              disabled={updating === pendingUpdate?.id}
            >
              {updating === pendingUpdate?.id ? 'Finalizando...' : 'Confirmar Finalização'}
            </Button>
          </div>
        </div>
      </Modal>

      <div className="flex gap-6 overflow-x-auto h-full pb-4">
        {columns.map((column) => {
        const columnAtendimentos = atendimentosPorStatus[column.id];
        const clientCount = columnAtendimentos.length;

        const isDragOver = dragOverColumn === column.id;
        const canDropHere = draggedItemStatus === 'em_andamento' || draggedItemStatus === 'aberto';

        return (
          <div
            key={column.id}
            className={`flex-shrink-0 w-80 h-full bg-white rounded-lg shadow-sm border-l border-r border-b border-gray-50 transition-all flex flex-col ${
              isDragOver && canDropHere ? 'bg-blue-50 border-[#9a9a9a] border-opacity-50 shadow-md' : ''
            }`}
            style={{ borderTopWidth: '4px', borderTopStyle: 'solid', borderTopColor: column.id === 'em_andamento' ? '#3b82f6' : '#9ca3af' }}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Header da coluna */}
            <div className="p-4 border-b border-gray-200 flex-shrink-0">
              {/* Primeira linha: nomeStatus | espaço | 3 pontos */}
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-sm font-medium ${
                  column.id === 'em_andamento' 
                    ? 'text-blue-600' 
                    : 'text-gray-500'
                }`}>
                  {column.title}
                </h3>
                <span className="text-gray-600 text-sm">{clientCount} {clientCount === 1 ? 'atendimento' : 'atendimentos'}</span>
              </div>
            </div>

            {/* Cards */}
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              {columnAtendimentos.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-lg py-12 text-center">
                  <span className="text-gray-400 text-sm">Nenhum atendimento</span>
                </div>
              ) : (
                columnAtendimentos.map((atendimento) => {
                  const isDragging = draggedItem === atendimento.id;
                  const isUpdating = updating === atendimento.id;

                  return (
                    <div
                      key={atendimento.id}
                      draggable={!isUpdating && (atendimento.status === 'em_andamento' || atendimento.status === 'aberto' || !atendimento.status)}
                      onDragStart={(e) => handleDragStart(e, atendimento.id, atendimento.status || 'aberto')}
                      onDragEnd={() => {
                        setDraggedItem(null);
                        setDraggedItemStatus(null);
                        setDragOverColumn(null);
                      }}
                      onClick={() => onSelectAtendimento(atendimento.id)}
                      className={`
                        bg-white border border-gray-200 rounded-lg p-4 transition-all
                        ${isDragging ? 'opacity-50 cursor-grabbing' : ''}
                        ${isUpdating ? 'opacity-50 cursor-wait' : 'cursor-grab hover:shadow-md'}
                        ${!isUpdating && (atendimento.status === 'em_andamento' || atendimento.status === 'aberto' || !atendimento.status) ? 'hover:border-gray-400' : 'cursor-not-allowed opacity-60'}
                      `}
                    >
                      {/* Primeira linha: Foto Cliente | Nome | Ícone WhatsApp */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {atendimento.cliente_foto_perfil ? (
                            <img
                              src={atendimento.cliente_foto_perfil}
                              alt={atendimento.cliente_nome || 'Cliente'}
                              className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-gray-200"
                            />
                          ) : (
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${getAvatarColor(
                                atendimento.cliente_nome
                              )}`}
                            >
                              {getInitials(atendimento.cliente_nome)}
                            </div>
                          )}
                          <h4 className="text-gray-900 text-sm font-semibold truncate">
                            {atendimento.cliente_nome ||
                              `Cliente ${atendimento.cliente_id.substring(0, 8)}`}
                          </h4>
                        </div>
                        <button
                          onClick={(e) => handleWhatsApp(e, atendimento.telefone_cliente)}
                          className="p-1 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors flex-shrink-0"
                          title="Abrir WhatsApp"
                        >
                          <WhatsAppIcon className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Segunda linha: Telefone Cliente | Tempo cadastrado */}
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>{atendimento.telefone_cliente}</span>
                        </div>
                        <span className="text-gray-400 text-xs">
                          {formatTimeAgo(atendimento.created_at)}
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
