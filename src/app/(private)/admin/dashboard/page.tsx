'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import {
  UsersIcon,
  TestTubeIcon,
  RocketIcon,
  BotIcon,
  ClockIcon,
  UserCircleIcon,
} from '@/components/icons/NavIcons';
import { ChevronDown } from 'lucide-react';
import { useEstatisticasClientes, useEstatisticasAtendimentosMensagens, useAdminClientes } from '@/hooks/useAdminClientes';

function formatarMinutos(minutos: number): string {
  if (minutos === 0) return '0 min';
  if (minutos < 1) return `${Math.round(minutos * 60)} seg`;
  if (minutos >= 60) {
    const h = Math.floor(minutos / 60);
    const m = Math.round(minutos % 60);
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  return `${Math.round(minutos)} min`;
}

export default function AdminDashboardPage() {
  const { estatisticas, loading } = useEstatisticasClientes();
  const { clientes } = useAdminClientes();
  const [clienteFiltro, setClienteFiltro] = useState<string>('');
  const { estatisticas: statsMsg, loading: loadingMsg } = useEstatisticasAtendimentosMensagens(clienteFiltro || null);

  const loadingGeral = loading || loadingMsg;

  if (loadingGeral) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Clientes</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500 mb-2 font-medium">Clientes Ativos</div>
                <div className="text-3xl font-bold text-gray-900">{estatisticas.totalAtivos}</div>
              </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-blue-50">
                <UsersIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500 mb-2 font-medium">Clientes em Teste</div>
                <div className="text-3xl font-bold text-yellow-600">{estatisticas.totalTeste}</div>
              </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-yellow-50">
                <TestTubeIcon className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500 mb-2 font-medium">Clientes em Produção</div>
                <div className="text-3xl font-bold text-green-600">{estatisticas.totalProducao}</div>
              </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-green-50">
                <RocketIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Atendimento (últimos 12 meses)</h2>
          <div className="relative">
            <select
              value={clienteFiltro}
              onChange={(e) => setClienteFiltro(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-w-[200px] hover:border-gray-400 transition-colors cursor-pointer"
            >
              <option value="">Todos os clientes</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome || `Cliente ${c.id.slice(0, 8)}...`}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500 mb-2 font-medium">
                  Média de mensagens enviadas por IA
                </div>
                <div className="text-3xl font-bold text-purple-600">
                  {statsMsg.mediaMensagensPorIA}
                </div>
              </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-purple-50">
                <BotIcon className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500 mb-2 font-medium">
                  Tempo médio atendimento humano
                </div>
                <div className="text-3xl font-bold text-blue-600">
                  {formatarMinutos(statsMsg.tempoMedioAtendimentoHumanoMinutos)}
                </div>
              </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-blue-50">
                <UserCircleIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500 mb-2 font-medium">
                  Tempo médio atendimento por IA
                </div>
                <div className="text-3xl font-bold text-indigo-600">
                  {formatarMinutos(statsMsg.tempoMedioAtendimentoIAMinutos)}
                </div>
              </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-indigo-50">
                <ClockIcon className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

