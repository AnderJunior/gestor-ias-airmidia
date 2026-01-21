'use client';

import { useState, useEffect } from 'react';
import { AtendimentoList } from './components/AtendimentoList';
import { AtendimentoKanban } from './components/AtendimentoKanban';
import { AtendimentoCalendar } from './components/AtendimentoCalendar';
import { AtendimentoSidebar } from './components/AtendimentoSidebar';
import { useAtendimentos } from '@/hooks/useAtendimentos';
import { useAgendamentos } from '@/hooks/useAgendamentos';
import { useSidebar } from '@/hooks/useSidebar';
import { useUsuario } from '@/hooks/useUsuario';
import { Tabs } from '@/components/ui/Tabs';
import { List, LayoutGrid, Calendar } from 'lucide-react';

type TabType = 'lista' | 'kanban' | 'calendario';

export default function AtendimentoPage() {
  const [activeTab, setActiveTab] = useState<TabType>('lista');
  const { atendimentos, loading, refetch } = useAtendimentos();
  const { agendamentos, loading: loadingAgendamentos, refetch: refetchAgendamentos } = useAgendamentos();
  const { isOpen, selectedAtendimentoId, openSidebar, closeSidebar } = useSidebar();
  const { usuario } = useUsuario();

  // Converter tipo_marcacao para o tipo esperado pelos componentes
  const tipoMarcacao = usuario?.tipo_marcacao === 'atendimento' || usuario?.tipo_marcacao === 'agendamento'
    ? usuario.tipo_marcacao
    : undefined;

  // Listener para abrir atendimento quando navegar via notificação
  useEffect(() => {
    const handleOpenAtendimento = async (event: Event) => {
      const customEvent = event as CustomEvent<{ atendimentoId: string }>;
      const { atendimentoId } = customEvent.detail;
      
      // Tentar abrir imediatamente se o atendimento já estiver na lista
      const atendimentoExiste = atendimentos.some(a => a.id === atendimentoId);
      if (atendimentoExiste) {
        openSidebar(atendimentoId);
        return;
      }

      // Se não estiver na lista, recarregar e tentar novamente
      await refetch();
      
      // Aguardar um pouco para garantir que os dados foram atualizados
      setTimeout(() => {
        // Verificar novamente após o refetch
        // Como não temos acesso direto ao estado atualizado aqui, vamos tentar abrir diretamente
        // O hook useAtendimentos deve ter atualizado o estado
        openSidebar(atendimentoId);
      }, 500);
    };

    window.addEventListener('openAtendimento', handleOpenAtendimento);

    return () => {
      window.removeEventListener('openAtendimento', handleOpenAtendimento);
    };
  }, [atendimentos, openSidebar, refetch]);

  // Filtrar abas baseado no tipo_marcacao do usuário
  const todasAsAbas = [
    {
      id: 'lista',
      label: 'Lista',
      icon: <List className="w-4 h-4" />,
      badge: usuario?.tipo_marcacao === 'agendamento' ? agendamentos.length : atendimentos.length,
    },
    {
      id: 'kanban',
      label: 'Kanban',
      icon: <LayoutGrid className="w-4 h-4" />,
      badge: usuario?.tipo_marcacao === 'agendamento' ? agendamentos.length : atendimentos.length,
    },
    {
      id: 'calendario',
      label: 'Calendário',
      icon: <Calendar className="w-4 h-4" />,
    },
  ];

  // Se tipo_marcacao for "atendimento", ocultar a aba "Calendário"
  const tabs = usuario?.tipo_marcacao === 'atendimento'
    ? todasAsAbas.filter(tab => tab.id !== 'calendario')
    : todasAsAbas;

  // Se a aba ativa for "calendario" e o usuário for "atendimento", mudar para "lista"
  useEffect(() => {
    if (usuario?.tipo_marcacao === 'atendimento' && activeTab === 'calendario') {
      setActiveTab('lista');
    }
  }, [usuario?.tipo_marcacao, activeTab]);

  return (
    <div className="flex flex-col h-full">
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={(tabId) => setActiveTab(tabId as TabType)} />

      <div 
        className={`bg-white border-l border-r border-b border-gray-300 flex-1 ${
          activeTab === 'lista' ? 'overflow-hidden' : 'overflow-auto'
        }`}
        style={{
          borderTop: 'none',
          borderBottomLeftRadius: '12px',
          borderBottomRightRadius: '12px',
          padding: activeTab === 'calendario' ? '0' : '24px',
          minHeight: 0
        }}
      >
        {activeTab === 'lista' ? (
          <AtendimentoList
            atendimentos={usuario?.tipo_marcacao === 'agendamento' ? undefined : atendimentos}
            agendamentos={usuario?.tipo_marcacao === 'agendamento' ? agendamentos : undefined}
            loading={usuario?.tipo_marcacao === 'agendamento' ? loadingAgendamentos : loading}
            onSelectAtendimento={openSidebar}
            onRefresh={usuario?.tipo_marcacao === 'agendamento' ? refetchAgendamentos : refetch}
            tipoMarcacao={tipoMarcacao}
          />
        ) : activeTab === 'kanban' ? (
          <AtendimentoKanban
            atendimentos={usuario?.tipo_marcacao === 'agendamento' ? undefined : atendimentos}
            agendamentos={usuario?.tipo_marcacao === 'agendamento' ? agendamentos : undefined}
            loading={usuario?.tipo_marcacao === 'agendamento' ? loadingAgendamentos : loading}
            onSelectAtendimento={openSidebar}
            onStatusUpdate={usuario?.tipo_marcacao === 'agendamento' ? refetchAgendamentos : refetch}
            tipoMarcacao={tipoMarcacao}
          />
        ) : (
          <AtendimentoCalendar
            agendamentos={agendamentos}
            loading={loadingAgendamentos}
            onSelectAgendamento={openSidebar}
          />
        )}
      </div>

      <AtendimentoSidebar
        atendimentoId={selectedAtendimentoId}
        isOpen={isOpen}
        onClose={closeSidebar}
        onRefresh={usuario?.tipo_marcacao === 'agendamento' ? refetchAgendamentos : refetch}
      />
    </div>
  );
}

