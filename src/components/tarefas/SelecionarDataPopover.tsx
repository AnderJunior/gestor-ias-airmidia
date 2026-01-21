'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SelecionarDataPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (date: Date | null) => void;
  dataAtual?: Date | null;
  buttonRef: React.RefObject<HTMLButtonElement>;
}

export function SelecionarDataPopover({
  isOpen,
  onClose,
  onSelect,
  dataAtual,
  buttonRef,
}: SelecionarDataPopoverProps) {
  const [currentMonth, setCurrentMonth] = useState(dataAtual || new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(dataAtual || null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  // Calcular dias do mês
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Preencher com dias do mês anterior para completar a primeira semana
  const firstDayOfWeek = monthStart.getDay();
  const daysBefore = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const previousMonthDays = Array.from({ length: daysBefore }, (_, i) => {
    const date = new Date(monthStart);
    date.setDate(date.getDate() - daysBefore + i);
    return date;
  });

  // Preencher com dias do próximo mês para completar a última semana
  const lastDayOfWeek = monthEnd.getDay();
  const daysAfter = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
  const nextMonthDays = Array.from({ length: daysAfter }, (_, i) => {
    const date = new Date(monthEnd);
    date.setDate(date.getDate() + i + 1);
    return date;
  });

  const allDays = [...previousMonthDays, ...daysInMonth, ...nextMonthDays];

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleDayClick = (day: Date) => {
    // Só permitir seleção de dias do mês atual
    if (isSameMonth(day, currentMonth)) {
      setSelectedDate(day);
      onSelect(day);
      onClose();
    }
  };

  const handleClear = () => {
    setSelectedDate(null);
    onSelect(null);
    onClose();
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

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
        <h3 className="text-sm font-semibold text-gray-900">Selecionar Data de Vencimento</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Cabeçalho do calendário */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          
          <h3 className="text-sm font-semibold text-gray-900">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h3>
          
          <button
            onClick={handleNextMonth}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Dias da semana */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-semibold text-gray-500 py-1"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Grid de dias */}
        <div className="grid grid-cols-7 gap-1">
          {allDays.map((day, index) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);

            return (
              <button
                key={index}
                onClick={() => handleDayClick(day)}
                disabled={!isCurrentMonth}
                className={`
                  aspect-square flex items-center justify-center text-xs rounded-lg transition-colors
                  ${!isCurrentMonth ? 'text-gray-300 cursor-not-allowed' : 'text-gray-900 hover:bg-gray-100'}
                  ${isSelected ? 'bg-primary-600 text-white hover:bg-primary-700' : ''}
                  ${isTodayDate && !isSelected ? 'bg-primary-50 text-primary-600 font-semibold' : ''}
                `}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>

        {/* Botões de ação */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          <button
            onClick={handleClear}
            className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Limpar
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(popoverContent, document.body);
}
