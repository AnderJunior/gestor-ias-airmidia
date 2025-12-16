'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUsuario } from '@/hooks/useUsuario';
import { verificarConnectionState } from '@/lib/api/evolution';
import { sincronizarStatusInstancia } from '@/lib/api/whatsapp';
import { ConnectionNotification } from '@/components/notifications/ConnectionNotification';
import { WhatsAppConnectionModal } from './WhatsAppConnectionModal';
import { useNotifications } from '@/contexts/NotificationsContext';

export function VerificacaoConexaoWhatsApp() {
  const { user, loading: authLoading } = useAuth();
  const { usuario, loading: usuarioLoading } = useUsuario();
  const { addNotification } = useNotifications();
  const [mostrarNotificacao, setMostrarNotificacao] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);

  // Calcular telefone e instanceName uma única vez baseado no usuario
  const { telefoneUsuario, instanceName } = useMemo(() => {
    if (!usuario || !usuario.telefone_ia) {
      return { telefoneUsuario: null, instanceName: '' };
    }

    const primeiroNome = usuario.nome ? usuario.nome.trim().split(/\s+/)[0] : 'usuario';
    const telefoneLimpo = usuario.telefone_ia.replace(/\D/g, '');
    const instanceNameGerado = `${primeiroNome}${telefoneLimpo}`.toLowerCase();

    return {
      telefoneUsuario: usuario.telefone_ia,
      instanceName: instanceNameGerado,
    };
  }, [usuario]);

  const verificando = authLoading || usuarioLoading;

  // Verificar status na Evolution API periodicamente (consolidado - única verificação)
  useEffect(() => {
    // Não verificar se o modal estiver aberto ou se não tiver dados do usuário
    if (mostrarModal || !telefoneUsuario || !instanceName || !user?.id) {
      return;
    }

    let isMounted = true;
    let lastCheckTime = 0;
    const CHECK_INTERVAL = 60000; // 1 minuto entre verificações

    const verificarStatus = async () => {
      // Evitar múltiplas verificações simultâneas
      const now = Date.now();
      if (now - lastCheckTime < CHECK_INTERVAL) {
        return;
      }
      lastCheckTime = now;

      try {
        // Verificar status na Evolution API usando connectionState
        const state = await verificarConnectionState(instanceName);
        
        if (!isMounted) return;

        // Se o status não for "open", atualizar Supabase
        if (state !== 'open') {
          let statusSupabase: 'conectado' | 'desconectado' | 'conectando' | 'erro' = 'desconectado';
          
          if (state === 'connecting') {
            statusSupabase = 'conectando';
          } else if (state === 'close') {
            statusSupabase = 'desconectado';
          } else {
            statusSupabase = 'desconectado';
          }

          // Atualizar Supabase
          try {
            await sincronizarStatusInstancia(instanceName, telefoneUsuario, statusSupabase, user.id);
            console.log(`Status atualizado no Supabase: ${statusSupabase} (Evolution retornou: ${state})`);
          } catch (syncError) {
            console.error('Erro ao sincronizar status com Supabase:', syncError);
          }

          // Mostrar notificação se não estiver conectado
          setMostrarNotificacao(true);
        } else {
          // Se estiver "open", atualizar Supabase como conectado e esconder notificação
          try {
            await sincronizarStatusInstancia(instanceName, telefoneUsuario, 'conectado', user.id);
            setMostrarNotificacao(false);
            setMostrarModal(false);
          } catch (syncError) {
            console.error('Erro ao sincronizar status conectado com Supabase:', syncError);
          }
        }
      } catch (error) {
        console.error('Erro ao verificar status na Evolution API:', error);
      }
    };

    // Verificar imediatamente ao carregar
    verificarStatus();

    // Verificar a cada 1 minuto (consolidado de 30s e 5min para evitar duplicações)
    const interval = setInterval(() => {
      if (!mostrarModal && isMounted) {
        verificarStatus();
      }
    }, CHECK_INTERVAL);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [telefoneUsuario, instanceName, user?.id, mostrarModal]);

  const handleConectarClick = () => {
    setMostrarNotificacao(false);
    setMostrarModal(true);
  };

  const handleFecharNotificacao = () => {
    setMostrarNotificacao(false);
    // Adicionar notificação ao sistema quando o usuário fechar o alerta
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
        onClick: () => {
          setMostrarModal(true);
        },
      },
    });
  };

  const handleFecharModal = () => {
    setMostrarModal(false);
    // A verificação periódica no useEffect já vai verificar automaticamente
    // Não é necessário fazer uma verificação adicional aqui
  };

  // Não renderiza nada enquanto está verificando ou se não há usuário
  if (verificando || !user) {
    return null;
  }

  return (
    <>
      <ConnectionNotification
        isVisible={mostrarNotificacao}
        onClose={handleFecharNotificacao}
        onConnectClick={handleConectarClick}
      />
      {instanceName && (
        <WhatsAppConnectionModal
          isOpen={mostrarModal}
          onClose={handleFecharModal}
          instanceName={instanceName}
          telefone={telefoneUsuario || undefined}
        />
      )}
    </>
  );
}

