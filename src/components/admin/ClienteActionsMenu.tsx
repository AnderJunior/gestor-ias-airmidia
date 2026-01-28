'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

interface ClienteActionsMenuProps {
  fase?: 'teste' | 'producao';
  ativo?: boolean;
  onEditInstance: () => void;
  onEditCliente: () => void;
  onDesativar: () => void;
  onEntrarNaConta?: () => void;
}

export function ClienteActionsMenu({ fase, ativo, onEditInstance, onEditCliente, onDesativar, onEntrarNaConta }: ClienteActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Montar componente no cliente
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calcular posição do menu quando abrir
  useEffect(() => {
    if (isOpen && buttonRef.current && mounted) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + window.scrollY + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [isOpen, mounted]);

  // Fechar menu ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleOptionClick = (action: () => void) => {
    setIsOpen(false);
    // Pequeno delay para garantir que o dropdown feche antes do modal abrir
    setTimeout(() => {
      action();
    }, 100);
  };

  const menuContent = isOpen && mounted ? (
    <div
      ref={menuRef}
      className="fixed w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-[10000]"
      style={{
        top: `${menuPosition.top}px`,
        right: `${menuPosition.right}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="py-1">
        {onEntrarNaConta && (
          <button
            onClick={() => {
              if (onEntrarNaConta) {
                handleOptionClick(onEntrarNaConta);
              }
            }}
            className="w-full text-left px-4 py-2 text-sm text-primary-600 font-semibold hover:bg-primary-50 transition-colors border-b border-gray-200"
          >
            Entrar na Conta
          </button>
        )}
        <button
          onClick={() => handleOptionClick(onEditInstance)}
          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
        >
          Editar nome instância
        </button>
        <button
          onClick={() => handleOptionClick(onEditCliente)}
          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
        >
          Editar informações Cliente
        </button>
        <button
          onClick={() => handleOptionClick(onDesativar)}
          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
        >
          {ativo === false ? 'Ativar Cliente' : 'Desativar Cliente'}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          title="Mais opções"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>
      {mounted && menuContent && createPortal(menuContent, document.body)}
    </>
  );
}

