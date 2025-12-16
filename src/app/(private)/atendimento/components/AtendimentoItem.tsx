'use client';

import { Atendimento } from '@/types/domain';
import { formatDate, formatDateTime } from '@/lib/utils/dates';
import { formatStatus, getStatusColor, truncateText } from '@/lib/utils/formatters';

interface AtendimentoItemProps {
  atendimento: Atendimento;
  onClick: () => void;
}

export function AtendimentoItem({ atendimento, onClick }: AtendimentoItemProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow border border-gray-200"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {atendimento.cliente_nome || `Cliente ${atendimento.cliente_id.substring(0, 8)}`}
            </h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(atendimento.status)}`}>
              {formatStatus(atendimento.status)}
            </span>
          </div>
          
          {atendimento.ultima_mensagem && (
            <p className="text-gray-600 mb-2">
              {truncateText(atendimento.ultima_mensagem, 150)}
            </p>
          )}

          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>📱 {atendimento.telefone_cliente}</span>
            <span>Criado: {formatDateTime(atendimento.created_at)}</span>
            {atendimento.ultima_mensagem_at && (
              <span>Última mensagem: {formatDate(atendimento.ultima_mensagem_at)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

