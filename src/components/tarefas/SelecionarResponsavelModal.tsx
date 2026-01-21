'use client';

import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { getAdministradores, Usuario } from '@/lib/api/usuarios';
import { Modal } from '@/components/ui/Modal';

interface SelecionarResponsavelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (admin: Usuario) => void;
  responsavelAtual?: Usuario | null;
}

export function SelecionarResponsavelModal({
  isOpen,
  onClose,
  onSelect,
  responsavelAtual,
}: SelecionarResponsavelModalProps) {
  const [administradores, setAdministradores] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadAdministradores();
    }
  }, [isOpen]);

  const loadAdministradores = async () => {
    try {
      setLoading(true);
      const admins = await getAdministradores();
      setAdministradores(admins);
    } catch (error) {
      console.error('Erro ao carregar administradores:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAdmins = administradores.filter((admin) =>
    admin.nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getAvatarColor = (name: string | null) => {
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Selecionar Responsável">
      <div className="space-y-4">
        {/* Campo de busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Pesquisar membros"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Lista de administradores */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchTerm ? 'Nenhum membro encontrado' : 'Nenhum administrador disponível'}
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {/* Membros do Cartão (se houver responsável atual) */}
            {responsavelAtual && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  Membro Atual
                </h3>
                <button
                  onClick={() => {
                    onSelect(responsavelAtual);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${getAvatarColor(
                      responsavelAtual.nome
                    )}`}
                  >
                    {getInitials(responsavelAtual.nome)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {responsavelAtual.nome || 'Sem nome'}
                    </p>
                  </div>
                </button>
              </div>
            )}

            {/* Membros do Quadro */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Membros do Quadro
              </h3>
              <div className="space-y-1">
                {filteredAdmins
                  .filter((admin) => admin.id !== responsavelAtual?.id)
                  .map((admin) => (
                    <button
                      key={admin.id}
                      onClick={() => {
                        onSelect(admin);
                        onClose();
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${getAvatarColor(
                          admin.nome
                        )}`}
                      >
                        {getInitials(admin.nome)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {admin.nome || 'Sem nome'}
                        </p>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
