'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { SimpleBarChart } from '@/components/charts/SimpleBarChart';
import { SplineAreaChart } from '@/components/charts/SplineAreaChart';
import { ChartIcon, UnlockIcon, SettingsIcon, CalendarIcon } from '@/components/icons/NavIcons';
import { RecentList } from '@/components/dashboard/RecentList';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useDadosPorMes } from '@/hooks/useDadosPorMes';
import { useRecentItems } from '@/hooks/useRecentItems';
import { useUsuario } from '@/hooks/useUsuario';
import { useRouter } from 'next/navigation';
import { useAgendamentos } from '@/hooks/useAgendamentos';
import { useAtendimentos } from '@/hooks/useAtendimentos';
import { getTotalClientes } from '@/lib/api/clientes';
import { ROUTES } from '@/lib/constants';

export default function DashboardPage() {
  const router = useRouter();
  const { stats, loading } = useDashboardStats();
  const { usuario, loading: loadingUsuario } = useUsuario();

  // Redirecionar administradores para o dashboard de administração
  useEffect(() => {
    if (!loadingUsuario && usuario?.tipo === 'administracao') {
      router.push(ROUTES.ADMIN_DASHBOARD);
    }
  }, [usuario, loadingUsuario, router]);
  // Só usar tipoMarcacao quando usuario estiver carregado, senão undefined para evitar busca prematura
  const tipoMarcacao = loadingUsuario ? undefined : (usuario?.tipo_marcacao || 'atendimento');
  const { dados: dadosPorMes, loading: loadingDadosPorMes } = useDadosPorMes(tipoMarcacao, 6);
  const { atendimentos, agendamentos, loading: loadingRecentItems } = useRecentItems(tipoMarcacao);
  const { atendimentos: todosAtendimentos } = useAtendimentos();
  const { agendamentos: todosAgendamentos } = useAgendamentos();
  const [totalClientes, setTotalClientes] = useState<number>(0);

  // Buscar total de clientes cadastrados
  useEffect(() => {
    if (usuario?.id) {
      getTotalClientes(usuario.id)
        .then(setTotalClientes)
        .catch(() => setTotalClientes(0));
    }
  }, [usuario?.id]);

  // Calcular estatísticas baseadas no tipo de usuário
  // Card 1: Total de Atendimentos (quantidade de clientes cadastrados)
  const totalAtendimentos = totalClientes;

  // Card 2: Atendimentos em Andamento (quantidade de atendimentos com status em_andamento)
  // Para agendamento: Agendamentos cancelados
  const atendimentosEmAndamento = tipoMarcacao === 'agendamento'
    ? todosAgendamentos.filter(a => a.status === 'cancelado').length
    : stats?.atendimentosEmAndamento || 0;

  // Card 3: Depende do tipo de usuário
  const terceiroCard = tipoMarcacao === 'agendamento'
    ? todosAgendamentos.filter(a => a.status === 'agendado' || a.status === 'confirmado').length // Total de Agendamentos (marcados)
    : stats?.totalAtendimentos || 0; // Total de solicitações de atendimento

  const handleItemClick = (id: string) => {
    // Navegar para a página de atendimento
    router.push('/atendimento');
    
    // Usar um pequeno delay para garantir que a página carregou antes de tentar abrir o item
    setTimeout(() => {
      // Disparar um evento customizado para abrir o atendimento/agendamento
      window.dispatchEvent(new CustomEvent('openAtendimento', { detail: { atendimentoId: id } }));
    }, 100);
  };

  // Não renderizar nada se for administrador (será redirecionado)
  if (usuario?.tipo === 'administracao') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (loading && tipoMarcacao === 'atendimento') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!stats && tipoMarcacao === 'atendimento') {
    return (
      <div className="text-center text-gray-600">
        Erro ao carregar dados do dashboard
      </div>
    );
  }

  // chartData não está sendo usado, mas mantido caso seja necessário no futuro
  const chartData = stats ? [
    { name: 'Abertos', value: stats.atendimentosAbertos },
    { name: 'Em Andamento', value: stats.atendimentosEmAndamento },
    { name: 'Encerrados', value: stats.atendimentosEncerrados },
  ] : [];

  // Título dinâmico baseado no tipo de usuário
  const tituloGrafico = tipoMarcacao === 'agendamento' 
    ? 'Quantidade de Agendamento por mês'
    : 'Quantidade de atendimento por mês';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500 mb-2 font-medium">Total de clientes atendidos</div>
              <div className="text-3xl font-bold text-gray-900">{totalAtendimentos}</div>
            </div>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F9FAFB' }}>
              <ChartIcon className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500 mb-2 font-medium">
                {tipoMarcacao === 'agendamento' ? 'Agendamentos cancelados' : 'Atendimentos em Andamento'}
              </div>
              <div className={`text-3xl font-bold ${tipoMarcacao === 'agendamento' ? 'text-red-600' : 'text-primary-600'}`}>
                {atendimentosEmAndamento}
              </div>
            </div>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F9FAFB' }}>
              <SettingsIcon className={`w-6 h-6 ${tipoMarcacao === 'agendamento' ? 'text-red-600' : 'text-blue-600'}`} />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500 mb-2 font-medium">
                {tipoMarcacao === 'agendamento' ? 'Total de Agendamentos' : 'Total de solicitações de atendimento'}
              </div>
              <div className="text-3xl font-bold text-yellow-600">{terceiroCard}</div>
            </div>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F9FAFB' }}>
              {tipoMarcacao === 'agendamento' ? (
                <CalendarIcon className="w-6 h-6 text-yellow-600" />
              ) : (
                <UnlockIcon className="w-6 h-6 text-yellow-600" />
              )}
            </div>
          </div>
        </Card>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          {loadingDadosPorMes ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <SplineAreaChart 
              data={dadosPorMes} 
              title={tituloGrafico}
              color="#22c55e"
              tipoMarcacao={tipoMarcacao}
            />
          )}
        </Card>

        <RecentList
          atendimentos={atendimentos}
          agendamentos={agendamentos}
          tipoMarcacao={tipoMarcacao || 'atendimento'}
          loading={loadingRecentItems}
          onItemClick={handleItemClick}
        />
      </div>
    </div>
  );
}

