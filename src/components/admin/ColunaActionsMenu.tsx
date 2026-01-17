'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

interface ColunaActionsMenuProps {
  onEditarNome: () => void;
  onExcluir: () => void;
  canExcluir?: boolean;
}

export function ColunaActionsMenu({ onEditarNome, onExcluir, canExcluir = true }: ColunaActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && buttonRef.current && mounted) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + window.scrollY + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [isOpen, mounted]);

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
        <button
          onClick={() => handleOptionClick(onEditarNome)}
          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
        >
          Editar coluna
        </button>
        {canExcluir && (
          <button
            onClick={() => handleOptionClick(onExcluir)}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Excluir coluna
          </button>
        )}
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
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          title="Mais opções"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
      {mounted && menuContent && createPortal(menuContent, document.body)}
    </>
  );
}
