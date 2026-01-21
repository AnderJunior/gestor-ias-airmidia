'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { getAdministradores, Usuario } from '@/lib/api/usuarios';

interface SelecionarResponsavelPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (admin: Usuario | null) => void;
  responsavelAtual?: Usuario | null;
  buttonRef: React.RefObject<HTMLButtonElement>;
}

export function SelecionarResponsavelPopover({
  isOpen,
  onClose,
  onSelect,
  responsavelAtual,
  buttonRef,
}: SelecionarResponsavelPopoverProps) {
  const [administradores, setAdministradores] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadAdministradores();
    }
  }, [isOpen]);

  // Calcular posição do popover
  useEffect(() => {
    if (isOpen && buttonRef.current && mounted) {
      const updatePosition = () => {
        if (!buttonRef.current) return;
        
        const buttonRect = buttonRef.current.getBoundingClientRect();
        const popoverWidth = 320; // largura fixa do popover (w-80)
        
        // Tentar obter altura real do popover se já foi renderizado
        let popoverHeight = 300; // altura padrão estimada (reduzida)
        if (popoverRef.current) {
          popoverHeight = popoverRef.current.getBoundingClientRect().height;
        }
        
        // Posicionar acima do botão: bottom do popover alinhado com top do botão - 4px de gap
        // Isso garante que o popover fique completamente acima, sem sobrepor
        let top = buttonRect.top - popoverHeight - 4;
        let left = buttonRect.left;

        // Ajustar se sair da tela à direita
        if (left + popoverWidth > window.innerWidth) {
          left = window.innerWidth - popoverWidth - 8;
        }

        // Ajustar se sair da tela à esquerda
        if (left < 8) {
          left = 8;
        }

        // Se não há espaço suficiente acima, posicionar abaixo
        const spaceAbove = buttonRect.top;
        if (spaceAbove < popoverHeight + 4) {
          top = buttonRect.bottom + 4;
        } else {
          // Garantir que o popover não sobreponha o botão
          // O bottom do popover deve estar no máximo no top do botão - 4px
          const popoverBottom = top + popoverHeight;
          if (popoverBottom > buttonRect.top - 4) {
            top = buttonRect.top - popoverHeight - 4;
          }
        }

        setPosition({ top, left });
      };

      // Calcular posição inicial
      updatePosition();
      
      // Recalcular após o popover ser renderizado para usar altura real
      const timeoutId = setTimeout(() => {
        updatePosition();
      }, 0);

      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen, mounted, buttonRef]);

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, buttonRef]);

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

  if (!isOpen || !mounted) return null;

  const popoverContent = (
    <div
      ref={popoverRef}
      className="fixed bg-white rounded-lg shadow-lg border border-gray-200 z-[10000] w-80"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Cabeçalho */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Selecionar Responsável</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Campo de busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Pesquisar membros"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            autoFocus
          />
        </div>

        {/* Lista de administradores */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            {searchTerm ? 'Nenhum membro encontrado' : 'Nenhum administrador disponível'}
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {/* Membros do Cartão (se houver responsável atual) */}
            {responsavelAtual && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  Membro Atual
                </h3>
                <div className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group">
                  <button
                    onClick={() => {
                      onSelect(responsavelAtual);
                      onClose();
                    }}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 text-xs ${getAvatarColor(
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Passar null para remover o responsável
                      onSelect(null);
                      onClose();
                    }}
                    className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors opacity-0 group-hover:opacity-100"
                    title="Remover responsável"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
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
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 text-xs ${getAvatarColor(
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
    </div>
  );

  return createPortal(popoverContent, document.body);
}
