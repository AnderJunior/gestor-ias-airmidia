'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUsuario } from '@/hooks/useUsuario';
import { verificarConnectionState } from '@/lib/api/evolution';
import { sincronizarStatusInstancia, getInstanceNameByUsuario } from '@/lib/api/whatsapp';
import { ConnectionNotification } from '@/components/notifications/ConnectionNotification';
import { WhatsAppConnectionModal } from './WhatsAppConnectionModal';
import { useNotifications } from '@/contexts/NotificationsContext';

export function VerificacaoConexaoWhatsApp() {
  const { user, loading: authLoading } = useAuth();
  const { usuario, loading: usuarioLoading } = useUsuario();
  const { addNotification } = useNotifications();
  const [mostrarNotificacao, setMostrarNotificacao] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);

  // Buscar instanceName da tabela whatsapp_instances
  const [instanceName, setInstanceName] = useState<string>('');
  const telefoneUsuario = usuario?.telefone_ia || null;

  const verificando = authLoading || usuarioLoading;

  // Se o usuário for administrador, não verificar conexão WhatsApp
  // Verificar após o carregamento para evitar problemas com hooks
  useEffect(() => {
    if (!verificando && usuario?.tipo === 'administracao') {
      // Não fazer nada se for administrador
      return;
    }
  }, [verificando, usuario?.tipo]);

  useEffect(() => {
    // Não executar se for administrador
    if (usuario?.tipo === 'administracao') {
      return;
    }

    async function loadInstanceName() {
      if (!user?.id) {
        setInstanceName('');
        return;
      }

      try {
        const instanceNameFromDb = await getInstanceNameByUsuario(user.id);
        setInstanceName(instanceNameFromDb || '');
      } catch (error) {
        console.error('Erro ao buscar instance_name:', error);
        setInstanceName('');
      }
    }

    if (user?.id) {
      loadInstanceName();
    }
  }, [user?.id, usuario?.tipo]);

  // Verificar status na Evolution API periodicamente (consolidado - única verificação)
  useEffect(() => {
    // Não verificar se for administrador, se o modal estiver aberto ou se não tiver dados do usuário
    if (usuario?.tipo === 'administracao' || mostrarModal || !telefoneUsuario || !instanceName || !user?.id) {
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

  // Se o usuário for administrador, não verificar conexão WhatsApp
  if (usuario?.tipo === 'administracao') {
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

