'use client';

import { useState, useMemo } from 'react';
import { Atendimento, StatusAtendimento, Agendamento, StatusAgendamento } from '@/types/domain';
import { formatSolicitadoEm } from '@/lib/utils/dates';
import { Pagination } from '@/components/ui/Pagination';
import { STATUS_OPTIONS } from '@/lib/constants';
import { updateAtendimentoStatus, deleteAtendimento } from '@/lib/api/atendimentos';
import { updateAgendamentoStatus, deleteAgendamento } from '@/lib/api/agendamentos';
import { Eye, Trash2 } from 'lucide-react';
import { StatusDropdown } from '@/components/ui/StatusDropdown';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface AtendimentoListProps {
  atendimentos?: Atendimento[];
  agendamentos?: Agendamento[];
  loading: boolean;
  onSelectAtendimento: (id: string) => void;
  onRefresh?: () => void;
  tipoMarcacao?: 'atendimento' | 'agendamento';
}

const STATUS_OPTIONS_AGENDAMENTO = [
  { value: 'agendado' as const, label: 'Agendado' },
  { value: 'concluido' as const, label: 'Realizado' },
  { value: 'cancelado' as const, label: 'Cancelado' },
] as const;

const ITEMS_PER_PAGE = 6;

export function AtendimentoList({ 
  atendimentos = [], 
  agendamentos = [], 
  loading, 
  onSelectAtendimento, 
  onRefresh,
  tipoMarcacao = 'atendimento',
}: AtendimentoListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<{ id: string; status: StatusAtendimento | StatusAgendamento } | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const isAgendamento = tipoMarcacao === 'agendamento';
  const items = isAgendamento ? agendamentos : atendimentos;
  const statusOptions = isAgendamento ? STATUS_OPTIONS_AGENDAMENTO : STATUS_OPTIONS;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">Nenhum {isAgendamento ? 'agendamento' : 'atendimento'} encontrado</p>
      </div>
    );
  }

  // Calcular paginação
  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentItems = items.slice(startIndex, endIndex);

  const handleStatusChange = (newStatus: StatusAtendimento | StatusAgendamento, itemId: string) => {
    if (isAgendamento) {
      // Para agendamentos, atualizar diretamente
      performStatusUpdate(itemId, newStatus as StatusAgendamento);
    } else {
      // Para atendimentos, converter 'aberto' para 'em_andamento' (mesmo comportamento do kanban)
      let finalStatus = newStatus as StatusAtendimento;
      if (finalStatus === 'aberto') {
        finalStatus = 'em_andamento';
      }
      
      // Se estiver finalizando, mostrar modal de confirmação
      if (finalStatus === 'encerrado') {
        setPendingUpdate({ id: itemId, status: finalStatus });
        setShowConfirmModal(true);
        return;
      }
      
      // Para outros status, atualizar diretamente
      performStatusUpdate(itemId, finalStatus);
    }
  };

  const performStatusUpdate = async (itemId: string, status: StatusAtendimento | StatusAgendamento) => {
    setUpdatingStatus(itemId);
    try {
      if (isAgendamento) {
        await updateAgendamentoStatus(itemId, status as StatusAgendamento);
      } else {
        await updateAtendimentoStatus(itemId, status as StatusAtendimento);
      }
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert(`Erro ao atualizar status do ${isAgendamento ? 'agendamento' : 'atendimento'}`);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleConfirmFinalizacao = async () => {
    if (!pendingUpdate) return;

    setUpdatingStatus(pendingUpdate.id);
    try {
      if (isAgendamento) {
        await updateAgendamentoStatus(pendingUpdate.id, pendingUpdate.status as StatusAgendamento);
      } else {
        await updateAtendimentoStatus(pendingUpdate.id, pendingUpdate.status as StatusAtendimento);
      }
      if (onRefresh) {
        onRefresh();
      }
      setShowConfirmModal(false);
      setPendingUpdate(null);
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert(`Erro ao atualizar status do ${isAgendamento ? 'agendamento' : 'atendimento'}. Tente novamente.`);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleCancelFinalizacao = () => {
    setShowConfirmModal(false);
    setPendingUpdate(null);
  };

  const handleView = (e: React.MouseEvent, atendimentoId: string) => {
    e.stopPropagation();
    onSelectAtendimento(atendimentoId);
  };

  const handleDelete = (e: React.MouseEvent, atendimentoId: string) => {
    e.stopPropagation();
    setPendingDeleteId(atendimentoId);
    setShowDeleteModal(true);
  };

  const handleWhatsApp = (e: React.MouseEvent, telefone: string) => {
    e.stopPropagation();
    // Remove caracteres não numéricos do telefone
    const numeroLimpo = telefone.replace(/\D/g, '');
    // Abre o WhatsApp Web/App com o número
    window.open(`https://wa.me/${numeroLimpo}`, '_blank');
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;

    setDeletingId(pendingDeleteId);
    try {
      if (isAgendamento) {
        await deleteAgendamento(pendingDeleteId);
      } else {
        await deleteAtendimento(pendingDeleteId);
      }
      if (onRefresh) {
        onRefresh();
      }
      setShowDeleteModal(false);
      setPendingDeleteId(null);
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
    setPendingDeleteId(null);
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

  const itemParaConfirmar = pendingUpdate 
    ? (isAgendamento 
        ? agendamentos.find(a => a.id === pendingUpdate.id)
        : atendimentos.find(a => a.id === pendingUpdate.id))
    : null;

  const itemParaExcluir = pendingDeleteId
    ? (isAgendamento
        ? agendamentos.find(a => a.id === pendingDeleteId)
        : atendimentos.find(a => a.id === pendingDeleteId))
    : null;

  const itemNome = isAgendamento
    ? (itemParaConfirmar as Agendamento | undefined)?.cliente_nome || (itemParaExcluir as Agendamento | undefined)?.cliente_nome
    : (itemParaConfirmar as Atendimento | undefined)?.cliente_nome || (itemParaExcluir as Atendimento | undefined)?.cliente_nome;

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
              disabled={updatingStatus === pendingUpdate?.id}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmFinalizacao}
              disabled={updatingStatus === pendingUpdate?.id}
            >
              {updatingStatus === pendingUpdate?.id ? (isAgendamento ? 'Atualizando...' : 'Finalizando...') : 'Confirmar'}
            </Button>
          </div>
        </div>
      </Modal>

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
              disabled={deletingId === pendingDeleteId}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              disabled={deletingId === pendingDeleteId}
            >
              {deletingId === pendingDeleteId ? 'Excluindo...' : 'Confirmar Exclusão'}
            </Button>
          </div>
        </div>
      </Modal>

      <div className="w-full">
        <div className="bg-white overflow-hidden rounded-t-xl">
        <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th className="px-6 py-3 text-left text-sm font-bold text-gray-700 bg-gray-50 rounded-tl-xl">Nome do Cliente</th>
              <th className="px-6 py-3 text-left text-sm font-bold text-gray-700 bg-gray-50">Telefone</th>
              <th className="px-6 py-3 text-left text-sm font-bold text-gray-700 bg-gray-50">
                {isAgendamento ? 'Data e Hora' : 'Solicitado em'}
              </th>
              <th className="px-6 py-3 text-left text-sm font-bold text-gray-700 bg-gray-50">Status</th>
              <th className="px-6 py-3 text-right text-sm font-bold text-gray-700 bg-gray-50 rounded-tr-xl">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {currentItems.map((item) => {
              const itemData = item as Atendimento | Agendamento;
              const clienteNome = itemData.cliente_nome;
              const clienteFoto = itemData.cliente_foto_perfil;
              const clienteId = itemData.cliente_id;
              const telefoneCliente = isAgendamento 
                ? (itemData as Agendamento).telefone_cliente || ''
                : (itemData as Atendimento).telefone_cliente;
              const dataHora = isAgendamento
                ? (itemData as Agendamento).data_e_hora
                : (itemData as Atendimento).created_at;
              const status = itemData.status;

              return (
                <tr
                  key={itemData.id}
                  onClick={() => onSelectAtendimento(itemData.id)}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 text-sm text-gray-900 font-bold">
                    <div className="flex items-center gap-3">
                      {clienteFoto ? (
                        <img
                          src={clienteFoto}
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
                      <span>
                        {clienteNome || `Cliente ${clienteId.substring(0, 8)}`}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{telefoneCliente || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatSolicitadoEm(dataHora)}</td>
                  <td className="px-6 py-4">
                    <div onClick={(e) => e.stopPropagation()}>
                      <StatusDropdown
                        value={isAgendamento 
                          ? (status as StatusAgendamento)
                          : (status === 'aberto' ? 'em_andamento' : status as StatusAtendimento)
                        }
                        options={statusOptions as readonly { value: StatusAtendimento | StatusAgendamento; label: string }[]}
                        onChange={(newStatus) => handleStatusChange(newStatus, itemData.id)}
                        disabled={updatingStatus === itemData.id}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 justify-end">
                      {telefoneCliente && (
                        <button
                          onClick={(e) => handleWhatsApp(e, telefoneCliente)}
                          className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Abrir WhatsApp"
                        >
                          <WhatsAppIcon className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleView(e, itemData.id)}
                        className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Visualizar"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, itemData.id)}
                        disabled={deletingId === itemData.id}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Excluir"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
      </div>
    </>
  );
}
