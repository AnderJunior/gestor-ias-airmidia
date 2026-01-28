'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAudioUnlock } from '@/hooks/useAudioUnlock';
import { useAtendimentosNotifications } from '@/hooks/useAtendimentosNotifications';
import { useAgendamentosNotifications } from '@/hooks/useAgendamentosNotifications';
import { Sidebar } from '@/components/navigation/Sidebar';
import { Topbar } from '@/components/navigation/Topbar';
import { PresentationBar } from '@/components/navigation/PresentationBar';
import { VerificacaoDadosIniciais } from '@/components/usuarios/VerificacaoDadosIniciais';
import { VerificacaoConexaoWhatsApp } from '@/components/whatsapp/VerificacaoConexaoWhatsApp';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { ROUTES } from '@/lib/constants';

export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  // Desbloquear áudio na primeira interação do usuário
  useAudioUnlock();
  // Escutar novos atendimentos e tocar som de notificação em todas as telas
  useAtendimentosNotifications();
  // Escutar novos agendamentos e tocar som de notificação em todas as telas
  useAgendamentosNotifications();

  useEffect(() => {
    if (!loading && !user) {
      router.push(ROUTES.LOGIN);
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <NotificationsProvider>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <PresentationBar />
          <Topbar />
          <main className="flex-1 p-8 bg-gray-50 overflow-auto">{children}</main>
        </div>
        <VerificacaoDadosIniciais />
        <VerificacaoConexaoWhatsApp />
      </div>
    </NotificationsProvider>
  );
}

