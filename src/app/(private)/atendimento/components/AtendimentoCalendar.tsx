'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarSidebar } from '@/components/calendar/CalendarSidebar'
import { CalendarView } from '@/components/calendar/CalendarView'
import { CalendarEvent } from '@/types/calendar'
import { Agendamento } from '@/types/domain'
import { Calendar } from 'lucide-react'

interface AtendimentoCalendarProps {
  agendamentos: Agendamento[]
  loading: boolean
  onSelectAgendamento?: (agendamentoId: string) => void
}

export function AtendimentoCalendar({ agendamentos, loading, onSelectAgendamento }: AtendimentoCalendarProps) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('monthly')
  const [filters, setFilters] = useState({
    agendamentos: true,
  })

  // Converter agendamentos para eventos do calendário
  const events = useMemo<CalendarEvent[]>(() => {
    if (!filters.agendamentos) return []

    return agendamentos.map((agendamento) => {
      // Usar data_e_hora como data do evento
      const eventDate = new Date(agendamento.data_e_hora)
      
      // Cor baseada no status do agendamento
      const statusColors = {
        agendado: '#3B82F6', // blue-500
        confirmado: '#10B981', // green-500
        cancelado: '#EF4444', // red-500
        concluido: '#6B7280', // gray-500
      }
      const color = statusColors[agendamento.status] || '#3B82F6'

      return {
        id: agendamento.id,
        type: 'agendamento' as const,
        title: agendamento.cliente_nome || agendamento.telefone_cliente || 'Agendamento',
        date: eventDate,
        color,
        data: {
          agendamento,
        },
      }
    })
  }, [agendamentos, filters.agendamentos])

  const handleDateChange = (date: Date) => {
    setCurrentDate(date)
  }

  const handleFiltersChange = (newFilters: { atendimentos: boolean }) => {
    setFilters(newFilters)
  }

  const handleEventClick = (event: CalendarEvent) => {
    // Obter o agendamento do evento
    const agendamento = event.data?.agendamento as Agendamento | undefined;
    if (agendamento?.cliente_id) {
      // Navegar para a página de mensagens com o cliente_id
      router.push(`/mensagens?cliente_id=${agendamento.cliente_id}`);
    } else if (onSelectAgendamento) {
      onSelectAgendamento(event.id)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando calendário...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full bg-white">
      <CalendarSidebar
        currentDate={currentDate}
        onDateChange={handleDateChange}
        viewMode={viewMode}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Controles de visualização */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Calendário de Agendamentos</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                viewMode === 'daily'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Dia
            </button>
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                viewMode === 'weekly'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                viewMode === 'monthly'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Mês
            </button>
          </div>
        </div>

        {/* Visualização do calendário */}
        <div className="flex-1 overflow-auto">
          <CalendarView
            currentDate={currentDate}
            viewMode={viewMode}
            events={events}
            onEventClick={handleEventClick}
          />
        </div>
      </div>
    </div>
  )
}

