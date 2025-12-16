// Interface compartilhada para eventos do calendário
export interface CalendarEvent {
  id: string
  type: 'tarefa' | 'projeto' | 'cobranca' | 'atendimento' | 'agendamento'
  title: string
  date: Date
  color: string
  data: any // Pode conter diferentes estruturas dependendo do tipo
}

