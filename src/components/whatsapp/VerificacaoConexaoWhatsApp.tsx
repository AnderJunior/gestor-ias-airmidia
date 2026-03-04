'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUsuario } from '@/hooks/useUsuario';
import { supabase } from '@/lib/supabaseClient';
import { getInstanceNameByUsuario } from '@/lib/api/whatsapp';
import { ConnectionNotification } from '@/components/notifications/ConnectionNotification';
import { WhatsAppConnectionModal } from './WhatsAppConnectionModal';
import { useNotifications } from '@/contexts/NotificationsContext';

export function VerificacaoConexaoWhatsApp() {
  const { user, loading: authLoading } = useAuth();
  const { usuario, loading: usuarioLoading } = useUsuario();
  const { addNotification } = useNotifications();
  const [mostrarNotificacao, setMostrarNotificacao] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [instanceName, setInstanceName] = useState<string>('');
  const telefoneUsuario = usuario?.telefone_ia || null;
  const [zApiNaoConfigurado, setZApiNaoConfigurado] = useState(false);

  const verificando = authLoading || usuarioLoading;

  useEffect(() => {
    if (usuario?.tipo === 'administracao') return;

    async function loadInstanceName() {
      if (!user?.id) {
        setInstanceName('');
        return;
      }
      try {
        const name = await getInstanceNameByUsuario(user.id);
        setInstanceName(name || '');
      } catch {
        setInstanceName('');
      }
    }
    if (user?.id) loadInstanceName();
  }, [user?.id, usuario?.tipo]);

  // Verificar status via Z-API periodicamente
  useEffect(() => {
    if (usuario?.tipo === 'administracao' || mostrarModal || !telefoneUsuario || !user?.id) return;
    if (!instanceName) {
      setMostrarNotificacao(true);
      setZApiNaoConfigurado(false);
      return;
    }

    let isMounted = true;
    let lastCheckTime = 0;
    let lastKnownState: boolean | null = null;
    const CHECK_INTERVAL = 30000; // 30s para detectar desconexão mais rápido

    const verificarStatus = async () => {
      const now = Date.now();
      if (now - lastCheckTime < CHECK_INTERVAL) return;
      lastCheckTime = now;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const res = await fetch('/api/whatsapp/status', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();

        if (!isMounted) return;

        if (res.status === 400 && data.error?.includes('não configurada')) {
          setZApiNaoConfigurado(true);
          setMostrarNotificacao(true);
          return;
        }

        setZApiNaoConfigurado(false);
        const connected = data.connected === true;
        const stateChanged = lastKnownState !== connected;
        lastKnownState = connected;

        if (stateChanged) {
          const statusSupabase = connected ? 'conectado' : 'desconectado';
          try {
            const res = await fetch('/api/whatsapp/sync-status', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                instanceName,
                telefone: telefoneUsuario,
                status: statusSupabase,
              }),
            });
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              console.error('Erro ao sincronizar status:', errData);
            }
          } catch (e) {
            console.error('Erro ao sincronizar status:', e);
          }
        }

        if (connected) {
          setMostrarNotificacao(false);
          setMostrarModal(false);
        } else {
          setMostrarNotificacao(true);
        }
      } catch (error) {
        console.error('Erro ao verificar status Z-API:', error);
        setMostrarNotificacao(true);
      }
    };

    verificarStatus();
    const interval = setInterval(() => {
      if (!mostrarModal && isMounted) verificarStatus();
    }, CHECK_INTERVAL);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [telefoneUsuario, instanceName, user?.id, mostrarModal, usuario?.tipo]);

  const handleConectarClick = () => {
    setMostrarNotificacao(false);
    setMostrarModal(true);
  };

  const handleFecharNotificacao = () => {
    setMostrarNotificacao(false);
    const agora = new Date();
    const dataFormatada = agora.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const horaFormatada = agora.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    addNotification({
      title: 'WhatsApp Desconectado',
      message: `${dataFormatada}, ${horaFormatada}`,
      type: 'warning',
      action: {
        label: 'Conectar Agora',
        onClick: () => setMostrarModal(true),
      },
    });
  };

  const handleFecharModal = () => setMostrarModal(false);

  if (verificando || !user) return null;
  if (usuario?.tipo === 'administracao') return null;

  return (
    <>
      <ConnectionNotification
        isVisible={mostrarNotificacao}
        onClose={handleFecharNotificacao}
        onConnectClick={handleConectarClick}
        mensagemZApiNaoConfigurado={zApiNaoConfigurado}
      />
      {(instanceName || telefoneUsuario) && (
        <WhatsAppConnectionModal
          isOpen={mostrarModal}
          onClose={handleFecharModal}
          instanceName={instanceName || ''}
          telefone={telefoneUsuario || undefined}
        />
      )}
    </>
  );
}
