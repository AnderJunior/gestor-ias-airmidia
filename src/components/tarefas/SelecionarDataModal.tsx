'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Modal } from '@/components/ui/Modal';

interface SelecionarDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (date: Date | null) => void;
  dataAtual?: Date | null;
}

export function SelecionarDataModal({
  isOpen,
  onClose,
  onSelect,
  dataAtual,
}: SelecionarDataModalProps) {
  const [currentMonth, setCurrentMonth] = useState(dataAtual || new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(dataAtual || null);

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
    }
  };

  const handleConfirm = () => {
    onSelect(selectedDate);
    onClose();
  };

  const handleClear = () => {
    setSelectedDate(null);
    onSelect(null);
    onClose();
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Selecionar Data de Vencimento">
      <div className="space-y-4">
        {/* Cabeçalho do calendário */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          
          <h3 className="text-lg font-semibold text-gray-900">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h3>
          
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Dias da semana */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-semibold text-gray-500 py-2"
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
                  aspect-square flex items-center justify-center text-sm rounded-lg transition-colors
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

        {/* Data selecionada */}
        {selectedDate && (
          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Data selecionada:{' '}
              <span className="font-semibold text-gray-900">
                {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            </p>
          </div>
        )}

        {/* Botões de ação */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Limpar
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
