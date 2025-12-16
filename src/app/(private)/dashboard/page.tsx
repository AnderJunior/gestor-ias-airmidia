'use client';

import { Card } from '@/components/ui/Card';
import { SimpleBarChart } from '@/components/charts/SimpleBarChart';
import { ChartIcon, UnlockIcon, SettingsIcon } from '@/components/icons/NavIcons';
import { useDashboardStats } from '@/hooks/useDashboardStats';

export default function DashboardPage() {
  const { stats, loading } = useDashboardStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center text-gray-600">
        Erro ao carregar dados do dashboard
      </div>
    );
  }

  const chartData = [
    { name: 'Abertos', value: stats.atendimentosAbertos },
    { name: 'Em Andamento', value: stats.atendimentosEmAndamento },
    { name: 'Encerrados', value: stats.atendimentosEncerrados },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500 mb-2 font-medium">Total de Atendimentos</div>
              <div className="text-3xl font-bold text-gray-900">{stats.totalAtendimentos}</div>
            </div>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F9FAFB' }}>
              <ChartIcon className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500 mb-2 font-medium">Atendimentos Abertos</div>
              <div className="text-3xl font-bold text-yellow-600">{stats.atendimentosAbertos}</div>
            </div>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F9FAFB' }}>
              <UnlockIcon className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500 mb-2 font-medium">Em Andamento</div>
              <div className="text-3xl font-bold text-primary-600">{stats.atendimentosEmAndamento}</div>
            </div>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F9FAFB' }}>
              <SettingsIcon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

      </div>

      <Card title="Status dos Atendimentos">
        <SimpleBarChart data={chartData} />
      </Card>
    </div>
  );
}

