'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { StatusAtendimento } from '@/types/domain';

interface StatusOption {
  value: StatusAtendimento;
  label: string;
}

interface StatusDropdownProps {
  value: StatusAtendimento;
  options: readonly StatusOption[];
  onChange: (value: StatusAtendimento) => void;
  disabled?: boolean;
}

export function StatusDropdown({ value, options, onChange, disabled = false }: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Verificar se está montado no cliente
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calcular posição e direção do dropdown
  useEffect(() => {
    if (isOpen && buttonRef.current && mounted) {
      const updatePosition = () => {
        if (!buttonRef.current) return;
        
        const buttonRect = buttonRef.current.getBoundingClientRect();
        const dropdownHeight = options.length * 40 + 16; // altura aproximada do dropdown
        const spaceBelow = window.innerHeight - buttonRect.bottom;
        const spaceAbove = buttonRect.top;
        
        // Calcular posição
        let top = 0;
        let left = buttonRect.left;
        
        // Se não há espaço suficiente abaixo, mas há acima, abrir para cima
        if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
          setOpenUpward(true);
          top = buttonRect.top - dropdownHeight - 4; // 4px de margem
        } else {
          setOpenUpward(false);
          top = buttonRect.bottom + 4; // 4px de margem
        }

        // Ajustar se sair da tela à direita
        const dropdownWidth = 200; // w-[200px] - largura fixa
        if (left + dropdownWidth > window.innerWidth) {
          left = window.innerWidth - dropdownWidth - 8;
        }

        // Ajustar se sair da tela à esquerda
        if (left < 8) {
          left = 8;
        }

        setPosition({ top, left });
      };

      updatePosition();

      // Atualizar posição ao rolar ou redimensionar
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen, options.length, mounted]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      // Usar setTimeout para evitar que o clique que abre o dropdown também o feche
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  // Cores baseadas no status (seguindo o design das imagens)
  const getStatusColors = (status: StatusAtendimento) => {
    if (status === 'encerrado') {
      return {
        bg: 'bg-green-100',
        text: 'text-green-700',
        hover: 'hover:bg-green-200',
        selectedBg: 'bg-green-100',
      };
    }
    // em_andamento ou aberto (que será convertido)
    return {
      bg: 'bg-orange-100',
      text: 'text-orange-700',
      hover: 'hover:bg-orange-200',
      selectedBg: 'bg-orange-100',
    };
  };

  const colors = getStatusColors(value);

  const handleSelect = (optionValue: StatusAtendimento) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão do dropdown (estado fechado) */}
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) {
            setIsOpen(!isOpen);
          }
        }}
        disabled={disabled}
        className={`
          flex items-center justify-between gap-2 px-3 py-2 rounded-lg
          font-semibold text-sm transition-colors w-[200px]
          ${colors.bg} ${colors.text}
          ${disabled ? 'opacity-50 cursor-not-allowed' : `cursor-pointer ${colors.hover}`}
        `}
      >
        <span className="font-bold">{selectedOption.label}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? (openUpward ? 'rotate-180' : '') : ''}`} />
      </button>

      {/* Menu dropdown (estado aberto) - renderizado via Portal */}
      {isOpen && !disabled && mounted && createPortal(
        <div
          ref={menuRef}
          className="fixed bg-white rounded-lg shadow-lg border border-gray-200 z-[9999] w-[200px]"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const optionColors = getStatusColors(option.value);
            
            return (
              <button
                key={option.value}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(option.value);
                }}
                className={`
                  w-full px-4 py-2.5 text-left text-sm transition-colors
                  flex items-center justify-between
                  ${isSelected 
                    ? `${optionColors.selectedBg} ${optionColors.text} font-semibold` 
                    : 'text-gray-900 hover:bg-gray-50 font-normal'
                  }
                  ${index === 0 ? 'rounded-t-lg' : ''}
                  ${index === options.length - 1 ? 'rounded-b-lg' : ''}
                `}
              >
                <span className={isSelected ? 'font-semibold' : ''}>{option.label}</span>
                {isSelected && (
                  <span className="text-gray-500 font-normal ml-2" style={{ fontSize: '10px' }}>Selecionado</span>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

