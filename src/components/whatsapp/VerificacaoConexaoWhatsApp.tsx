'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUsuario } from '@/hooks/useUsuario';
import { verificarConnectionState, gerarNomeInstancia } from '@/lib/api/evolution';
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
  
  // Gerar instanceName se não existir no banco mas houver telefone e nome
  const finalInstanceName = useMemo(() => {
    return instanceName || (telefoneUsuario && usuario?.nome 
      ? gerarNomeInstancia(usuario.nome, telefoneUsuario) 
      : '');
  }, [instanceName, telefoneUsuario, usuario?.nome]);

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
    // Não verificar se for administrador ou se o modal estiver aberto
    if (usuario?.tipo === 'administracao' || mostrarModal || !telefoneUsuario || !user?.id) {
      return;
    }
    
    // Se não houver instanceName final, mostrar notificação para criar instância
    if (!finalInstanceName) {
      setMostrarNotificacao(true);
      return;
    }

    let isMounted = true;
    let lastCheckTime = 0;
    let lastKnownState: string | null = null;
    const CHECK_INTERVAL = 120000; // 2 minutos entre verificações para reduzir requisições

    const verificarStatus = async () => {
      const now = Date.now();
      if (now - lastCheckTime < CHECK_INTERVAL) return;
      lastCheckTime = now;

      try {
        const state = await verificarConnectionState(finalInstanceName);
        if (!isMounted) return;

        const stateChanged = lastKnownState !== state;
        lastKnownState = state;

        if (state !== 'open') {
          let statusSupabase: 'conectado' | 'desconectado' | 'conectando' | 'erro' = 'desconectado';
          if (state === 'connecting') statusSupabase = 'conectando';
          else if (state === 'close' || state === null) statusSupabase = 'desconectado';
          else statusSupabase = 'desconectado';

          if (stateChanged) {
            try {
              await sincronizarStatusInstancia(finalInstanceName, telefoneUsuario, statusSupabase, user.id);
            } catch (syncError) {
              console.error('Erro ao sincronizar status com Supabase:', syncError);
            }
          }
          setMostrarNotificacao(true);
        } else {
          if (stateChanged) {
            try {
              await sincronizarStatusInstancia(finalInstanceName, telefoneUsuario, 'conectado', user.id);
            } catch (syncError) {
              console.error('Erro ao sincronizar status conectado com Supabase:', syncError);
            }
          }
          setMostrarNotificacao(false);
          setMostrarModal(false);
        }
      } catch (error) {
        console.error('Erro ao verificar status na Evolution API:', error);
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
      {(finalInstanceName || telefoneUsuario) && (
        <WhatsAppConnectionModal
          isOpen={mostrarModal}
          onClose={handleFecharModal}
          instanceName={finalInstanceName || ''}
          telefone={telefoneUsuario || undefined}
        />
      )}
    </>
  );
}

