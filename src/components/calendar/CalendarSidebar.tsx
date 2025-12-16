'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  ptBR
} from '@/lib/utils/dateUtils'

interface CalendarSidebarProps {
  currentDate: Date
  onDateChange: (date: Date) => void
  viewMode?: 'daily' | 'weekly' | 'monthly'
}

export function CalendarSidebar({ currentDate, onDateChange, viewMode = 'monthly' }: CalendarSidebarProps) {
  const [monthView, setMonthView] = useState(currentDate)
  
  // Calcular range da semana se viewMode for 'weekly'
  const weekRange = viewMode === 'weekly' ? {
    start: startOfWeek(currentDate, { weekStartsOn: 1 }),
    end: endOfWeek(currentDate, { weekStartsOn: 1 })
  } : null

  const monthStart = startOfMonth(monthView)
  const monthEnd = endOfMonth(monthView)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Preencher com dias do mês anterior para completar a primeira semana
  const firstDayOfWeek = monthStart.getDay()
  const daysBefore = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1
  const previousMonthDays = Array.from({ length: daysBefore }, (_, i) => {
    const date = new Date(monthStart)
    date.setDate(date.getDate() - daysBefore + i)
    return date
  })

  // Preencher com dias do próximo mês para completar a última semana
  const lastDayOfWeek = monthEnd.getDay()
  const daysAfter = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek
  const nextMonthDays = Array.from({ length: daysAfter }, (_, i) => {
    const date = new Date(monthEnd)
    date.setDate(date.getDate() + i + 1)
    return date
  })

  const allDays = [...previousMonthDays, ...daysInMonth, ...nextMonthDays]

  const handlePrevMonth = () => {
    setMonthView(subMonths(monthView, 1))
  }

  const handleNextMonth = () => {
    setMonthView(addMonths(monthView, 1))
  }

  const handleDayClick = (day: Date) => {
    // Bloquear seleção de dia quando visualização mensal estiver ativa
    if (viewMode === 'monthly') {
      return
    }
    onDateChange(day)
  }

  // Formatar mês e ano em português
  const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const monthYear = `${monthNames[monthView.getMonth()]} ${monthView.getFullYear()}`

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* Calendar */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 capitalize">
            {monthYear}
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevMonth}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Week days */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
            <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {allDays.map((day, index) => {
            const isCurrentMonth = isSameMonth(day, monthView)
            const isSelected = isSameDay(day, currentDate)
            const isToday = isSameDay(day, new Date())
            const isInWeekRange = weekRange && isWithinInterval(day, { start: weekRange.start, end: weekRange.end })
            const isWeekStart = weekRange && isSameDay(day, weekRange.start)
            const isWeekEnd = weekRange && isSameDay(day, weekRange.end)
            const isWeekMiddle = isInWeekRange && !isWeekStart && !isWeekEnd

            // Na visualização semanal, destacar primeiro e último dia com azul escuro
            const isWeekRangeSelected = viewMode === 'weekly' && (isWeekStart || isWeekEnd)
            
            // Quando é mensal, não destacar nada (nem o dia selecionado)
            // Quando é semanal, destacar primeiro e último dia
            // Caso contrário, destacar o dia selecionado
            const shouldHighlight = viewMode === 'monthly' 
              ? false // Não destacar nada em modo mensal, apenas o dia atual terá destaque claro
              : viewMode === 'weekly' 
                ? isWeekRangeSelected 
                : isSelected

            // Determinar classes de borda arredondada para criar efeito de range contínuo
            let roundedClasses = 'rounded-lg'
            if (isInWeekRange) {
              if (isWeekStart) {
                roundedClasses = 'rounded-l-lg rounded-r-none'
              } else if (isWeekEnd) {
                roundedClasses = 'rounded-r-lg rounded-l-none'
              } else if (isWeekMiddle) {
                roundedClasses = 'rounded-none'
              }
            }

            return (
              <button
                key={index}
                onClick={() => handleDayClick(day)}
                disabled={viewMode === 'monthly'}
                className={`
                  aspect-square flex items-center justify-center text-sm transition-colors relative
                  ${roundedClasses}
                  ${viewMode === 'monthly' ? 'cursor-default' : 'cursor-pointer'}
                  ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                  ${shouldHighlight ? 'bg-primary-600 text-white font-semibold z-10' : ''}
                  ${!shouldHighlight && isToday && !isInWeekRange ? 'bg-primary-50 text-primary-600 font-semibold' : ''}
                  ${viewMode === 'monthly' && isToday ? 'bg-primary-50 text-primary-600 font-semibold' : ''}
                  ${isInWeekRange && !isWeekRangeSelected && isCurrentMonth ? 'bg-primary-100 text-primary-700 font-medium' : ''}
                  ${isInWeekRange && !isWeekRangeSelected && !isCurrentMonth ? 'bg-primary-50 text-primary-500' : ''}
                  ${!shouldHighlight && !isToday && !isInWeekRange && isCurrentMonth && viewMode !== 'monthly' ? 'hover:bg-gray-100' : ''}
                  ${viewMode === 'monthly' ? 'opacity-60' : ''}
                `}
              >
                {format(day, 'd')}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
