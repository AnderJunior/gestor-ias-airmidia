'use client';

import { Atendimento } from '@/types/domain';
import { Agendamento } from '@/types/domain';
import { Calendar, Package } from 'lucide-react';
import { format } from 'date-fns';

interface RecentListProps {
  atendimentos?: Atendimento[];
  agendamentos?: Agendamento[];
  tipoMarcacao: 'atendimento' | 'agendamento';
  loading?: boolean;
  onItemClick?: (id: string) => void;
}

export function RecentList({ 
  atendimentos = [], 
  agendamentos = [], 
  tipoMarcacao,
  loading = false,
  onItemClick 
}: RecentListProps) {
  const titulo = tipoMarcacao === 'agendamento' 
    ? 'Agendamentos próximos'
    : 'Solicitações de Atendimento Recentes';

  const formatarData = (data: string) => {
    try {
      return format(new Date(data), 'dd/MM/yyyy');
    } catch {
      return data;
    }
  };

  const calcularDiasAteAgendamento = (dataAgendamento: string) => {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const data = new Date(dataAgendamento);
      data.setHours(0, 0, 0, 0);
      const diffTime = data.getTime() - hoje.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch {
      return 0;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-300 p-6">
        <h2 className="text-left mb-6" style={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>{titulo}</h2>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  const items = tipoMarcacao === 'agendamento' ? agendamentos : atendimentos;

  if (!items || items.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-300 p-6">
        <h2 className="text-left mb-6" style={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>{titulo}</h2>
        <div className="text-center text-gray-500 py-8">
          Nenhum item encontrado
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-300 p-6">
      <h2 className="text-left mb-6" style={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>{titulo}</h2>
      
      <div className="space-y-2">
        {tipoMarcacao === 'agendamento' ? (
          // Renderizar agendamentos
          agendamentos.slice(0, 5).map((agendamento) => {
            const diasAteAgendamento = calcularDiasAteAgendamento(agendamento.data_e_hora);
            const dataFormatada = formatarData(agendamento.data_e_hora);
            const horaFormatada = format(new Date(agendamento.data_e_hora), 'HH:mm');
            
            return (
              <div
                key={agendamento.id}
                onClick={() => onItemClick?.(agendamento.id)}
                className="flex items-center justify-between p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4 text-blue-600" />
                  </div>
                  
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">
                      {agendamento.cliente_nome || 'Cliente sem nome'}
                    </div>
                    <div className="text-sm text-gray-500 whitespace-nowrap">
                      Agendamento
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex items-center gap-1 text-xs text-gray-400 whitespace-nowrap">
                    <Calendar className="w-3 h-3" />
                    <span>{dataFormatada} {horaFormatada}</span>
                  </div>
                  {diasAteAgendamento > 0 && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs whitespace-nowrap">
                      Em {diasAteAgendamento} {diasAteAgendamento === 1 ? 'dia' : 'dias'}
                    </span>
                  )}
                  {diasAteAgendamento === 0 && (
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs whitespace-nowrap">
                      Hoje
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          // Renderizar atendimentos
          atendimentos.slice(0, 5).map((atendimento) => {
            const dataFormatada = formatarData(atendimento.created_at);
            const horaFormatada = format(new Date(atendimento.created_at), 'HH:mm');
            const diasAtras = Math.floor(
              (new Date().getTime() - new Date(atendimento.created_at).getTime()) / (1000 * 60 * 60 * 24)
            );
            
            return (
              <div
                key={atendimento.id}
                onClick={() => onItemClick?.(atendimento.id)}
                className="flex items-center justify-between p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-blue-600" />
                  </div>
                  
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">
                      {atendimento.cliente_nome || 'Cliente sem nome'}
                    </div>
                    <div className="text-sm text-gray-500 whitespace-nowrap">
                      Solicitação de Atendimento
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex items-center gap-1 text-xs text-gray-400 whitespace-nowrap">
                    <Calendar className="w-3 h-3" />
                    <span>{dataFormatada} {horaFormatada}</span>
                  </div>
                  {diasAtras > 0 && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs whitespace-nowrap">
                      Há {diasAtras} {diasAtras === 1 ? 'dia' : 'dias'}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

