'use client';

import { Card } from '@/components/ui/Card';
import { ChartIcon, UsersIcon, TestTubeIcon, RocketIcon } from '@/components/icons/NavIcons';
import { useEstatisticasClientes } from '@/hooks/useAdminClientes';

export default function AdminDashboardPage() {
  const { estatisticas, loading } = useEstatisticasClientes();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
  );
}

