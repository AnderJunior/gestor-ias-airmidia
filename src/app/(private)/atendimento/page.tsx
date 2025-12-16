'use client';

import { useState, useEffect } from 'react';
import { AtendimentoList } from './components/AtendimentoList';
import { AtendimentoKanban } from './components/AtendimentoKanban';
import { AtendimentoCalendar } from './components/AtendimentoCalendar';
import { AtendimentoSidebar } from './components/AtendimentoSidebar';
import { useAtendimentos } from '@/hooks/useAtendimentos';
import { useAgendamentos } from '@/hooks/useAgendamentos';
import { useSidebar } from '@/hooks/useSidebar';
import { Tabs } from '@/components/ui/Tabs';
import { List, LayoutGrid, Calendar } from 'lucide-react';

type TabType = 'lista' | 'kanban' | 'calendario';

export default function AtendimentoPage() {
  const [activeTab, setActiveTab] = useState<TabType>('lista');
  const { atendimentos, loading, refetch } = useAtendimentos();
  const { agendamentos, loading: loadingAgendamentos } = useAgendamentos();
  const { isOpen, selectedAtendimentoId, openSidebar, closeSidebar } = useSidebar();

  // Listener para abrir atendimento quando navegar via notificação
  useEffect(() => {
    const handleOpenAtendimento = async (event: CustomEvent<{ atendimentoId: string }>) => {
      const { atendimentoId } = event.detail;
      
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

    window.addEventListener('openAtendimento', handleOpenAtendimento as EventListener);

    return () => {
      window.removeEventListener('openAtendimento', handleOpenAtendimento as EventListener);
    };
  }, [atendimentos, openSidebar, refetch]);

  const tabs = [
    {
      id: 'lista',
      label: 'Lista',
      icon: <List className="w-4 h-4" />,
      badge: atendimentos.length,
    },
    {
      id: 'kanban',
      label: 'Kanban',
      icon: <LayoutGrid className="w-4 h-4" />,
      badge: atendimentos.length,
    },
    {
      id: 'calendario',
      label: 'Calendário',
      icon: <Calendar className="w-4 h-4" />,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={(tabId) => setActiveTab(tabId as TabType)} />

      <div 
        className="bg-white border-l border-r border-b border-gray-300 flex-1 overflow-auto"
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
            atendimentos={atendimentos}
            loading={loading}
            onSelectAtendimento={openSidebar}
          />
        ) : activeTab === 'kanban' ? (
          <AtendimentoKanban
            atendimentos={atendimentos}
            loading={loading}
            onSelectAtendimento={openSidebar}
            onStatusUpdate={refetch}
          />
        ) : (
          <AtendimentoCalendar
            agendamentos={agendamentos}
            loading={loadingAgendamentos}
            onSelectAgendamento={(agendamentoId) => {
              // Por enquanto, apenas logar. Você pode criar um sidebar específico para agendamentos depois
              console.log('Agendamento selecionado:', agendamentoId);
            }}
          />
        )}
      </div>

      <AtendimentoSidebar
        atendimentoId={selectedAtendimentoId}
        isOpen={isOpen}
        onClose={closeSidebar}
      />
    </div>
  );
}

