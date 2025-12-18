'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAdminClientes } from '@/hooks/useAdminClientes';
import { getWhatsAppInstances } from '@/lib/api/whatsapp';
import { Usuario } from '@/lib/api/usuarios';
import { WhatsAppInstance } from '@/types/domain';
import { Pagination } from '@/components/ui/Pagination';
import { CriarClienteModal } from '@/components/admin/CriarClienteModal';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { ClienteActionsMenu } from '@/components/admin/ClienteActionsMenu';
import { EditarNomeInstanciaModal } from '@/components/admin/EditarNomeInstanciaModal';
import { EditarClienteModal } from '@/components/admin/EditarClienteModal';

interface ClienteComStatus extends Usuario {
  statusEvolution?: 'conectado' | 'desconectado' | 'conectando' | 'erro';
  instancias?: WhatsAppInstance[];
}

const ITEMS_PER_PAGE = 6;

export default function AdminClientesPage() {
  const { clientes, loading, refetch } = useAdminClientes();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [clientesComStatus, setClientesComStatus] = useState<ClienteComStatus[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [clienteParaExcluir, setClienteParaExcluir] = useState<ClienteComStatus | null>(null);
  const [nomeConfirmacao, setNomeConfirmacao] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [showEditInstanceModal, setShowEditInstanceModal] = useState(false);
  const [showEditClienteModal, setShowEditClienteModal] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteComStatus | null>(null);
  const [instanciaSelecionada, setInstanciaSelecionada] = useState<WhatsAppInstance | null>(null);
  const [showPublicarModal, setShowPublicarModal] = useState(false);
  const [showVoltarTesteModal, setShowVoltarTesteModal] = useState(false);
  const [clienteParaPublicar, setClienteParaPublicar] = useState<ClienteComStatus | null>(null);
  const [updatingFase, setUpdatingFase] = useState(false);

  // Buscar status de conexão para cada cliente
  useEffect(() => {
    async function loadStatus() {
      if (!clientes.length) {
        setClientesComStatus([]);
        setLoadingStatus(false);
        return;
      }

      setLoadingStatus(true);
      const clientesComStatusData: ClienteComStatus[] = await Promise.all(
        clientes.map(async (cliente) => {
          try {
            const instancias = await getWhatsAppInstances(cliente.id);
            const statusEvolution = instancias.length > 0 
              ? instancias[0].status 
              : 'desconectado';
            
            return {
              ...cliente,
              statusEvolution,
              instancias,
            };
          } catch (error) {
            console.error(`Erro ao buscar status para cliente ${cliente.id}:`, error);
            return {
              ...cliente,
              statusEvolution: 'desconectado' as const,
              instancias: [],
            };
          }
        })
      );

      setClientesComStatus(clientesComStatusData);
      setLoadingStatus(false);
    }

    if (!loading) {
      loadStatus();
    }
  }, [clientes, loading]);

  // Filtrar clientes por termo de busca
  const clientesFiltrados = useMemo(() => {
    if (!searchTerm) return clientesComStatus;
    
    const termo = searchTerm.toLowerCase();
    return clientesComStatus.filter(cliente =>
      cliente.nome?.toLowerCase().includes(termo) ||
      cliente.telefone_ia?.includes(termo)
    );
  }, [clientesComStatus, searchTerm]);

  // Calcular paginação
  const totalPages = Math.ceil(clientesFiltrados.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentItems = clientesFiltrados.slice(startIndex, endIndex);

  // Resetar página quando o termo de busca mudar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Formatar telefone para exibição
  const formatarTelefone = (telefone: string | null) => {
    if (!telefone) return '-';
    const numeros = telefone.replace(/\D/g, '');
    if (numeros.length === 11) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
    } else if (numeros.length === 10) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
    }
    return telefone;
  };

  // Formatar status de conexão
  const formatarStatusConexao = (status?: string) => {
    switch (status) {
      case 'conectado':
        return { texto: 'Conectado', cor: 'text-green-600 bg-green-50' };
      case 'conectando':
        return { texto: 'Conectando', cor: 'text-yellow-600 bg-yellow-50' };
      case 'erro':
        return { texto: 'Erro', cor: 'text-red-600 bg-red-50' };
      default:
        return { texto: 'Desconectado', cor: 'text-gray-600 bg-gray-50' };
    }
  };

  // Formatar tipo de marcação
  const formatarTipoMarcacao = (tipo?: string) => {
    switch (tipo) {
      case 'atendimento':
        return 'Atendimento';
      case 'agendamento':
        return 'Agendamento';
      default:
        return 'Não definido';
    }
  };

  // Formatar fase
  const formatarFase = (fase?: string) => {
    switch (fase) {
      case 'teste':
        return { texto: 'Teste', cor: 'text-yellow-600 bg-yellow-50' };
      case 'producao':
        return { texto: 'Publicado', cor: 'text-green-600 bg-green-50' };
      default:
        return { texto: 'Não definido', cor: 'text-gray-600 bg-gray-50' };
    }
  };

  // Formatar status (ativo/inativo)
  const formatarStatus = (ativo?: boolean) => {
    if (ativo === true || ativo === undefined) {
      return { texto: 'Ativo', cor: 'text-green-600 bg-green-50' };
    } else {
      return { texto: 'Inativo', cor: 'text-red-600 bg-red-50' };
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getAvatarColor = (name?: string | null) => {
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

  const handleDeleteClick = (e: React.MouseEvent, cliente: ClienteComStatus) => {
    e.stopPropagation();
    setClienteParaExcluir(cliente);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    // Abrir modal de confirmação com nome
    setShowDeleteModal(false);
    setShowConfirmDeleteModal(true);
    setNomeConfirmacao('');
  };

  const handleFinalDelete = async () => {
    if (!clienteParaExcluir) return;

    // Verificar se o nome está correto
    if (nomeConfirmacao.trim() !== clienteParaExcluir.nome?.trim()) {
      return;
    }

    setDeleting(true);
    try {
      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(`/api/admin/excluir-cliente?id=${clienteParaExcluir.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao excluir cliente');
      }

      // Fechar modais e atualizar lista
      setShowConfirmDeleteModal(false);
      setShowDeleteModal(false);
      setClienteParaExcluir(null);
      setNomeConfirmacao('');
      refetch();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir cliente. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelConfirmDelete = () => {
    setShowConfirmDeleteModal(false);
    setNomeConfirmacao('');
    // Voltar para o modal anterior
    setShowDeleteModal(true);
  };

  const handleDesativar = async () => {
    if (!clienteParaExcluir) return;

    setDeactivating(true);
    try {
      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const response = await fetch('/api/admin/desativar-cliente', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          clienteId: clienteParaExcluir.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao desativar cliente');
      }

      // Fechar modal e atualizar lista
      setShowDeleteModal(false);
      setClienteParaExcluir(null);
      refetch();
    } catch (err: any) {
      alert(err.message || 'Erro ao desativar cliente. Tente novamente.');
    } finally {
      setDeactivating(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setShowConfirmDeleteModal(false);
    setClienteParaExcluir(null);
    setNomeConfirmacao('');
  };

  const handleEditInstance = (cliente: ClienteComStatus) => {
    const instancia = cliente.instancias && cliente.instancias.length > 0 
      ? cliente.instancias[0] 
      : null;
    
    if (!instancia) {
      alert('Este cliente não possui instância WhatsApp cadastrada.');
      return;
    }

    setInstanciaSelecionada(instancia);
    setShowEditInstanceModal(true);
  };

  const handleEditCliente = (cliente: ClienteComStatus) => {
    setClienteSelecionado(cliente);
    setShowEditClienteModal(true);
  };

  const handleDesativarCliente = (cliente: ClienteComStatus) => {
    setClienteParaExcluir(cliente);
    setShowDeleteModal(true);
  };

  const handlePublicarAgente = (cliente: ClienteComStatus) => {
    setClienteParaPublicar(cliente);
    if (cliente.fase === 'producao') {
      setShowVoltarTesteModal(true);
    } else {
      setShowPublicarModal(true);
    }
  };

  const handleConfirmarPublicar = async () => {
    if (!clienteParaPublicar) return;

    setUpdatingFase(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const response = await fetch('/api/admin/atualizar-fase-cliente', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          clienteId: clienteParaPublicar.id,
          fase: 'producao',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao publicar agente');
      }

      setShowPublicarModal(false);
      setClienteParaPublicar(null);
      refetch();
    } catch (err: any) {
      alert(err.message || 'Erro ao publicar agente. Tente novamente.');
    } finally {
      setUpdatingFase(false);
    }
  };

  const handleConfirmarVoltarTeste = async () => {
    if (!clienteParaPublicar) return;

    setUpdatingFase(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const response = await fetch('/api/admin/atualizar-fase-cliente', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          clienteId: clienteParaPublicar.id,
          fase: 'teste',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao voltar para teste');
      }

      setShowVoltarTesteModal(false);
      setClienteParaPublicar(null);
      refetch();
    } catch (err: any) {
      alert(err.message || 'Erro ao voltar para teste. Tente novamente.');
    } finally {
      setUpdatingFase(false);
    }
  };

  const handleCancelPublicar = () => {
    setShowPublicarModal(false);
    setShowVoltarTesteModal(false);
    setClienteParaPublicar(null);
  };

  const handleSuccessEdit = () => {
    refetch();
  };

  if (loading || loadingStatus) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (clientesFiltrados.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">Nenhum cliente encontrado</p>
      </div>
    );
  }

  return (
    <>
      <CriarClienteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          refetch();
          setIsModalOpen(false);
        }}
      />

      <Modal
        isOpen={showDeleteModal}
        onClose={handleCancelDelete}
        title="Desativar ou Excluir Cliente"
        closeOnClickOutside={!deleting && !deactivating}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Você não acha melhor desativar? Se excluir, todos os dados desse cliente serão excluídos permanentemente.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              disabled={deleting || deactivating}
            >
              Excluir
            </Button>
            <Button
              variant="primary"
              onClick={handleDesativar}
              disabled={deleting || deactivating}
            >
              {deactivating ? 'Desativando...' : 'Desativar'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showConfirmDeleteModal}
        onClose={handleCancelConfirmDelete}
        title="Confirmar Exclusão"
        closeOnClickOutside={!deleting}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Para que a exclusão seja feita, digite o nome do cliente corretamente abaixo <strong>{clienteParaExcluir?.nome || 'Cliente'}</strong>.
          </p>
          <Input
            label="Nome do Cliente"
            type="text"
            value={nomeConfirmacao}
            onChange={(e) => setNomeConfirmacao(e.target.value)}
            placeholder="Digite o nome do cliente"
            disabled={deleting}
            autoFocus
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={handleCancelConfirmDelete}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleFinalDelete}
              disabled={deleting || nomeConfirmacao.trim() !== clienteParaExcluir?.nome?.trim()}
            >
              {deleting ? 'Excluindo...' : 'Confirmar Exclusão'}
            </Button>
          </div>
        </div>
      </Modal>

      <div className="w-full">
        {/* Barra de busca e botão adicionar */}
        <div className="mb-6 flex items-center gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="primary"
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            Adicionar Cliente
          </Button>
        </div>

      {/* Tabela de clientes */}
      <div className="bg-white overflow-hidden rounded-t-xl">
        <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th className="px-6 py-3 text-left text-sm font-bold text-gray-700 bg-gray-50 rounded-tl-xl">Nome do Cliente</th>
              <th className="px-6 py-3 text-left text-sm font-bold text-gray-700 bg-gray-50">Telefone IA</th>
              <th className="px-6 py-3 text-left text-sm font-bold text-gray-700 bg-gray-50">Status Conexão Evolution</th>
              <th className="px-6 py-3 text-left text-sm font-bold text-gray-700 bg-gray-50">Tipo Marcação</th>
              <th className="px-6 py-3 text-left text-sm font-bold text-gray-700 bg-gray-50">Fase</th>
              <th className="px-6 py-3 text-left text-sm font-bold text-gray-700 bg-gray-50">Status</th>
              <th className="px-6 py-3 text-right text-sm font-bold text-gray-700 bg-gray-50 rounded-tr-xl">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {currentItems.map((cliente) => {
              const statusConexao = formatarStatusConexao(cliente.statusEvolution);
              const fase = formatarFase(cliente.fase);
              const status = formatarStatus(cliente.ativo);

              return (
                <tr
                  key={cliente.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 text-sm text-gray-900 font-bold">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 border border-gray-200 ${getAvatarColor(
                          cliente.nome
                        )}`}
                      >
                        {getInitials(cliente.nome)}
                      </div>
                      <span>
                        {cliente.nome || `Cliente ${cliente.id.substring(0, 8)}`}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatarTelefone(cliente.telefone_ia)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusConexao.cor}`}>
                      {statusConexao.texto}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatarTipoMarcacao(cliente.tipo_marcacao)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${fase.cor}`}>
                      {fase.texto}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${status.cor}`}>
                      {status.texto}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => handleDeleteClick(e, cliente)}
                        disabled={deleting}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Excluir cliente"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      <ClienteActionsMenu
                        fase={cliente.fase}
                        onPublicarAgente={() => handlePublicarAgente(cliente)}
                        onEditInstance={() => handleEditInstance(cliente)}
                        onEditCliente={() => handleEditCliente(cliente)}
                        onDesativar={() => handleDesativarCliente(cliente)}
                      />
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

      <EditarNomeInstanciaModal
        isOpen={showEditInstanceModal}
        onClose={() => {
          setShowEditInstanceModal(false);
          setInstanciaSelecionada(null);
        }}
        instancia={instanciaSelecionada}
        onSuccess={handleSuccessEdit}
      />

      <EditarClienteModal
        isOpen={showEditClienteModal}
        onClose={() => {
          setShowEditClienteModal(false);
          setClienteSelecionado(null);
        }}
        cliente={clienteSelecionado}
        onSuccess={handleSuccessEdit}
      />

      <Modal
        isOpen={showPublicarModal}
        onClose={handleCancelPublicar}
        title="Publicar Agente"
        closeOnClickOutside={!updatingFase}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Tem certeza que deseja publicar este agente? O agente sairá do modo teste para produção, e a fase do cliente será alterada de <strong>Teste</strong> para <strong>Publicado</strong>.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={handleCancelPublicar}
              disabled={updatingFase}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmarPublicar}
              disabled={updatingFase}
            >
              {updatingFase ? 'Publicando...' : 'Confirmar Publicação'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showVoltarTesteModal}
        onClose={handleCancelPublicar}
        title="Voltar para Teste"
        closeOnClickOutside={!updatingFase}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Tem certeza que deseja voltar este agente para a fase de teste? A fase do cliente será alterada de <strong>Publicado</strong> para <strong>Teste</strong>.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={handleCancelPublicar}
              disabled={updatingFase}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmarVoltarTeste}
              disabled={updatingFase}
            >
              {updatingFase ? 'Voltando...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      </Modal>
      </div>
    </>
  );
}
