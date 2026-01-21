'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAdministradores, AdministradorComEmail } from '@/hooks/useAdministradores';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { CriarAdministradorModal } from './CriarAdministradorModal';
import { CredenciaisPopup } from '@/components/admin/CredenciaisPopup';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Pagination } from '@/components/ui/Pagination';

const ITEMS_PER_PAGE = 6;

export function AdministradoresConfigSection() {
  const { administradores, loading, refetch } = useAdministradores();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [administradorParaExcluir, setAdministradorParaExcluir] = useState<{ id: string; nome: string | null; email: string | null } | null>(null);
  const [nomeConfirmacao, setNomeConfirmacao] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showCredenciaisPopup, setShowCredenciaisPopup] = useState(false);
  const [credenciaisData, setCredenciaisData] = useState<{
    email: string;
    senha: string;
  } | null>(null);

  // Filtrar administradores por termo de busca
  const administradoresFiltrados = useMemo(() => {
    if (!searchTerm) return administradores;
    
    const termo = searchTerm.toLowerCase();
    return administradores.filter(admin =>
      admin.nome?.toLowerCase().includes(termo) ||
      admin.id.toLowerCase().includes(termo) ||
      admin.email?.toLowerCase().includes(termo)
    );
  }, [administradores, searchTerm]);

  // Calcular paginação
  const totalPages = Math.ceil(administradoresFiltrados.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentItems = administradoresFiltrados.slice(startIndex, endIndex);

  // Resetar página quando o termo de busca mudar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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

  const handleDeleteClick = (e: React.MouseEvent, administrador: AdministradorComEmail) => {
    e.stopPropagation();
    setAdministradorParaExcluir(administrador);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    setShowDeleteModal(false);
    setShowConfirmDeleteModal(true);
    setNomeConfirmacao('');
  };

  const handleFinalDelete = async () => {
    if (!administradorParaExcluir) return;

    // Verificar se o nome está correto
    if (nomeConfirmacao.trim() !== administradorParaExcluir.nome?.trim()) {
      return;
    }

    setDeleting(true);
    try {
      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(`/api/admin/excluir-administrador?id=${administradorParaExcluir.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao excluir administrador');
      }

      // Fechar modais e atualizar lista
      setShowConfirmDeleteModal(false);
      setShowDeleteModal(false);
      setAdministradorParaExcluir(null);
      setNomeConfirmacao('');
      refetch();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir administrador. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelConfirmDelete = () => {
    setShowConfirmDeleteModal(false);
    setNomeConfirmacao('');
    setShowDeleteModal(true);
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setShowConfirmDeleteModal(false);
    setAdministradorParaExcluir(null);
    setNomeConfirmacao('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <>
      <CriarAdministradorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(credenciais) => {
          refetch();
          setIsModalOpen(false);
          if (credenciais) {
            setCredenciaisData(credenciais);
            setTimeout(() => {
              setShowCredenciaisPopup(true);
            }, 100);
          }
        }}
      />

      <Modal
        isOpen={showDeleteModal}
        onClose={handleCancelDelete}
        title="Excluir Administrador"
        closeOnClickOutside={!deleting}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Tem certeza que deseja excluir o administrador <strong>{administradorParaExcluir?.nome || 'Administrador'}</strong>?
          </p>
          <p className="text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            Esta ação não pode ser desfeita. Todos os dados deste administrador serão excluídos permanentemente.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={handleCancelDelete}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              Excluir
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
            Para confirmar a exclusão, digite o nome do administrador corretamente abaixo: <strong>{administradorParaExcluir?.nome || 'Administrador'}</strong>.
          </p>
          <Input
            label="Nome do Administrador"
            type="text"
            value={nomeConfirmacao}
            onChange={(e) => setNomeConfirmacao(e.target.value)}
            placeholder="Digite o nome do administrador"
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
              disabled={deleting || nomeConfirmacao.trim() !== administradorParaExcluir?.nome?.trim()}
            >
              {deleting ? 'Excluindo...' : 'Confirmar Exclusão'}
            </Button>
          </div>
        </div>
      </Modal>

      <div className="w-full space-y-6">
        {/* Barra de busca e botão adicionar */}
        <div className="mb-6 flex items-center gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Buscar por nome ou e-mail..."
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
            Adicionar Administrador
          </Button>
        </div>

        {/* Tabela de administradores */}
        {administradoresFiltrados.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">Nenhum administrador encontrado</p>
          </div>
        ) : (
          <>
            <div className="bg-white overflow-hidden rounded-t-xl">
              <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-bold text-gray-700 bg-gray-50 rounded-tl-xl">Nome do Administrador</th>
                    <th className="px-6 py-3 text-left text-sm font-bold text-gray-700 bg-gray-50">E-mail</th>
                    <th className="px-6 py-3 text-right text-sm font-bold text-gray-700 bg-gray-50 rounded-tr-xl">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {currentItems.map((administrador) => (
                    <tr
                      key={administrador.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-900 font-bold">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 border border-gray-200 ${getAvatarColor(
                              administrador.nome
                            )}`}
                          >
                            {getInitials(administrador.nome)}
                          </div>
                          <span>{administrador.nome || `Administrador ${administrador.id.substring(0, 8)}`}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{administrador.email || '-'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => handleDeleteClick(e, administrador)}
                            disabled={deleting}
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Excluir administrador"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
          </>
        )}

        {showCredenciaisPopup && credenciaisData && (
          <CredenciaisPopup
            email={credenciaisData.email}
            senha={credenciaisData.senha}
            tipoCliente="administracao"
            onClose={() => {
              setShowCredenciaisPopup(false);
              setCredenciaisData(null);
            }}
          />
        )}
      </div>
    </>
  );
}
