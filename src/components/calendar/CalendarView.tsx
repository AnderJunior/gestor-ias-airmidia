'use client'

import { CalendarEvent } from '@/types/calendar'
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  startOfMonth,
  endOfMonth,
  eachWeekOfInterval,
  startOfDay,
  addHours,
  ptBR
} from '@/lib/utils/dateUtils'

interface CalendarViewProps {
  currentDate: Date
  viewMode: 'daily' | 'weekly' | 'monthly'
  events: CalendarEvent[]
  onEventClick?: (event: CalendarEvent) => void
}

export function CalendarView({ currentDate, viewMode, events, onEventClick }: CalendarViewProps) {
  if (viewMode === 'daily') {
    return <DailyView date={currentDate} events={events} onEventClick={onEventClick} />
  } else if (viewMode === 'weekly') {
    return <WeeklyView date={currentDate} events={events} onEventClick={onEventClick} />
  } else {
    return <MonthlyView date={currentDate} events={events} onEventClick={onEventClick} />
  }
}

function DailyView({ date, events, onEventClick }: { date: Date; events: CalendarEvent[]; onEventClick?: (event: CalendarEvent) => void }) {
  const dayEvents = events.filter((event) => isSameDay(event.date, date))
  const hours = Array.from({ length: 24 }, (_, i) => i)

  // Formatar data em português
  const dayNames = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
  const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const formattedDate = `${dayNames[date.getDay()]}, ${date.getDate()} de ${monthNames[date.getMonth()]} de ${date.getFullYear()}`

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 capitalize">
            {formattedDate}
          </h3>
        </div>
        <div className="divide-y divide-gray-200">
          {hours.map((hour) => {
            const hourStart = addHours(startOfDay(date), hour)
            const hourEvents = dayEvents.filter((event) => {
              // Evento deve aparecer apenas no slot de hora correspondente à sua hora exata
              const eventHour = event.date.getHours()
              return eventHour === hour
            })

            return (
              <div key={hour} className="flex min-h-[80px]">
                <div className="w-24 px-4 py-2 text-sm text-gray-500 border-r border-gray-200">
                  {format(hourStart, 'HH:mm')}
                </div>
                <div className="flex-1 px-4 py-2">
                  {hourEvents.map((event) => {
                    const typeLabels = {
                      tarefa: 'Tarefa',
                      projeto: 'Projeto',
                      cobranca: 'Cobrança',
                      atendimento: 'Atendimento',
                      agendamento: 'Agendamento'
                    }
                    
                    // Determinar o título a ser exibido
                    let displayTitle = event.title
                    if (event.type === 'projeto' && 'clientes' in event.data && event.data.clientes) {
                      displayTitle = event.data.clientes.nome
                    } else if (event.type === 'cobranca' && 'clientes' in event.data && event.data.clientes) {
                      displayTitle = event.data.clientes.nome
                    } else if (event.type === 'atendimento' && 'atendimento' in event.data && event.data.atendimento) {
                      displayTitle = event.data.atendimento.cliente_nome || event.data.atendimento.telefone_cliente || 'Atendimento'
                    } else if (event.type === 'agendamento' && 'agendamento' in event.data && event.data.agendamento) {
                      displayTitle = event.data.agendamento.cliente_nome || event.data.agendamento.telefone_cliente || 'Agendamento'
                    }
                    
                    return (
                      <div
                        key={`${event.type}-${event.id}-${event.date.getTime()}`}
                        onClick={() => onEventClick?.(event)}
                        className={`mb-2 p-3 rounded-lg text-sm ${onEventClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                        style={{
                          backgroundColor: `${event.color}20`,
                          borderLeft: `4px solid ${event.color}`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900">{displayTitle}</div>
                            <div className="text-xs text-gray-600 mt-1">
                              {format(event.date, 'HH:mm')}
                            </div>
                          </div>
                          <span
                            className="px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap"
                            style={{
                              backgroundColor: `${event.color}30`,
                              color: event.color,
                            }}
                          >
                            {typeLabels[event.type]}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function WeeklyView({ date, events, onEventClick }: { date: Date; events: CalendarEvent[]; onEventClick?: (event: CalendarEvent) => void }) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 }) // Segunda-feira
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const isToday = (day: Date) => isSameDay(day, new Date())

  const dayNamesShort = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Header com dias da semana */}
        <div className="grid grid-cols-8 border-b border-gray-200">
          <div className="p-3 border-r border-gray-200">
            <div className="text-xs text-gray-500">Horário</div>
          </div>
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className={`p-3 text-center border-r border-gray-200 last:border-r-0 ${
                isToday(day) ? 'bg-primary-50' : ''
              }`}
            >
              <div className="text-xs text-gray-500 mb-1">
                {dayNamesShort[day.getDay()]}
              </div>
              <div
                className={`text-lg font-semibold ${
                  isToday(day) ? 'text-primary-600' : 'text-gray-900'
                }`}
              >
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>

        {/* Grid de horas */}
        <div className="divide-y divide-gray-200">
          {hours.map((hour) => {
            const hourStart = addHours(startOfDay(weekStart), hour)

            return (
              <div key={hour} className="grid grid-cols-8 min-h-[80px]">
                <div className="p-3 text-sm text-gray-500 border-r border-gray-200">
                  {format(hourStart, 'HH:mm')}
                </div>
                {weekDays.map((day) => {
                  const dayEvents = events.filter((event) => {
                    // Evento deve aparecer apenas no slot de hora correspondente à sua hora exata
                    const eventHour = event.date.getHours()
                    return isSameDay(event.date, day) && eventHour === hour
                  })

                  return (
                    <div
                      key={day.toISOString()}
                      className="p-2 border-r border-gray-200 last:border-r-0 min-h-[80px]"
                    >
                      {dayEvents.map((event) => {
                        const typeLabels = {
                          tarefa: 'Tarefa',
                          projeto: 'Projeto',
                          cobranca: 'Cobrança',
                          atendimento: 'Atendimento',
                          agendamento: 'Agendamento'
                        }
                        
                        // Determinar o título a ser exibido
                        let displayTitle = event.title
                        if (event.type === 'projeto' && 'clientes' in event.data && event.data.clientes) {
                          displayTitle = event.data.clientes.nome
                        } else if (event.type === 'cobranca' && 'clientes' in event.data && event.data.clientes) {
                          displayTitle = event.data.clientes.nome
                        } else if (event.type === 'atendimento' && 'atendimento' in event.data && event.data.atendimento) {
                          displayTitle = event.data.atendimento.cliente_nome || event.data.atendimento.telefone_cliente || 'Atendimento'
                        } else if (event.type === 'agendamento' && 'agendamento' in event.data && event.data.agendamento) {
                          displayTitle = event.data.agendamento.cliente_nome || event.data.agendamento.telefone_cliente || 'Agendamento'
                        }
                        
                        return (
                          <div
                            key={`${event.type}-${event.id}-${event.date.getTime()}`}
                            onClick={() => onEventClick?.(event)}
                            className={`mb-1 p-2 rounded text-xs ${onEventClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                            style={{
                              backgroundColor: `${event.color}25`,
                              borderLeft: `3px solid ${event.color}`,
                            }}
                            title={`${displayTitle} - ${typeLabels[event.type]}`}
                          >
                            <div className="font-medium text-gray-900 truncate">{displayTitle}</div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-gray-600">{format(event.date, 'HH:mm')}</span>
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                style={{
                                  backgroundColor: `${event.color}30`,
                                  color: event.color,
                                }}
                              >
                                {typeLabels[event.type].charAt(0)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MonthlyView({ date, events, onEventClick }: { date: Date; events: CalendarEvent[]; onEventClick?: (event: CalendarEvent) => void }) {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 })

  return (
    <div className="p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Header com dias da semana */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => (
            <div key={day} className="p-3 text-center text-sm font-semibold text-gray-700 border-r border-gray-200 last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {/* Semanas */}
        <div className="divide-y divide-gray-200">
          {weeks.map((weekStart) => {
            const weekDays = eachDayOfInterval({
              start: weekStart,
              end: endOfWeek(weekStart, { weekStartsOn: 1 }),
            })

            return (
              <div key={weekStart.toISOString()} className="grid grid-cols-7 min-h-[120px]">
                {weekDays.map((day) => {
                  const dayEvents = events.filter((event) => isSameDay(event.date, day))
                  const isCurrentMonth = day.getMonth() === date.getMonth()
                  const isToday = isSameDay(day, new Date())

                  return (
                    <div
                      key={day.toISOString()}
                      className={`p-2 border-r border-gray-200 last:border-r-0 min-h-[120px] ${
                        !isCurrentMonth ? 'bg-gray-50' : ''
                      } ${isToday ? 'bg-primary-50' : ''}`}
                    >
                      <div
                        className={`text-sm font-semibold mb-1 ${
                          isToday ? 'text-primary-600' : 'text-gray-900'
                        } ${!isCurrentMonth ? 'text-gray-400' : ''}`}
                      >
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((event) => {
                          const typeLabels = {
                            tarefa: 'T',
                            projeto: 'P',
                            cobranca: 'C',
                            atendimento: 'A',
                            agendamento: 'Ag'
                          }
                          
                          // Determinar o título a ser exibido
                          let displayTitle = event.title
                          if (event.type === 'projeto' && 'clientes' in event.data && event.data.clientes) {
                            displayTitle = event.data.clientes.nome
                          } else if (event.type === 'cobranca' && 'clientes' in event.data && event.data.clientes) {
                            displayTitle = event.data.clientes.nome
                          } else if (event.type === 'atendimento' && 'atendimento' in event.data && event.data.atendimento) {
                            displayTitle = event.data.atendimento.cliente_nome || event.data.atendimento.telefone_cliente || 'Atendimento'
                          } else if (event.type === 'agendamento' && 'agendamento' in event.data && event.data.agendamento) {
                            displayTitle = event.data.agendamento.cliente_nome || event.data.agendamento.telefone_cliente || 'Agendamento'
                          }
                          
                          const typeLabelFull = {
                            tarefa: 'Tarefa',
                            projeto: 'Projeto',
                            cobranca: 'Cobrança',
                            atendimento: 'Atendimento',
                            agendamento: 'Agendamento'
                          }
                          
                          return (
                            <div
                              key={`${event.type}-${event.id}-${event.date.getTime()}`}
                              onClick={() => onEventClick?.(event)}
                              className={`p-1.5 rounded ${onEventClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                              style={{
                                backgroundColor: `${event.color}25`,
                                borderLeft: `3px solid ${event.color}`,
                              }}
                              title={`${displayTitle} - ${typeLabelFull[event.type]}`}
                            >
                              <div className="flex items-center gap-1">
                                <div className="font-medium text-gray-900 truncate flex-1">{displayTitle}</div>
                                <span
                                  className="px-1 rounded text-[10px] font-bold flex-shrink-0"
                                  style={{
                                    backgroundColor: event.color,
                                    color: 'white',
                                  }}
                                >
                                  {typeLabels[event.type]}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-gray-500 px-1.5">
                            +{dayEvents.length - 3} mais
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
