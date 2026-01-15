/**
 * Utilitários para notificações do navegador
 */

/**
 * Solicita permissão para exibir notificações
 * @returns Promise<NotificationPermission> - 'granted', 'denied' ou 'default'
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  // Verificar se o navegador suporta notificações
  if (!('Notification' in window)) {
    console.warn('Este navegador não suporta notificações');
    return 'denied';
  }

  // Se já tem permissão, retornar
  if (Notification.permission === 'granted') {
    return 'granted';
  }

  // Se foi negada, retornar
  if (Notification.permission === 'denied') {
    return 'denied';
  }

  // Solicitar permissão
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Erro ao solicitar permissão de notificações:', error);
    return 'denied';
  }
}

/**
 * Exibe uma notificação do navegador
 * @param title - Título da notificação
 * @param options - Opções adicionais da notificação
 * @returns Notification | null
 */
export function showNotification(
  title: string,
  options?: NotificationOptions
): Notification | null {
  // Verificar se o navegador suporta notificações
  if (!('Notification' in window)) {
    console.warn('Este navegador não suporta notificações');
    return null;
  }

  // Se não tem permissão, tentar solicitar
  if (Notification.permission !== 'granted') {
    console.warn('Permissão de notificações não concedida');
    return null;
  }

  try {
    const notification = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'atendimento-notification',
      requireInteraction: false,
      ...options,
    });

    // Fechar automaticamente após 5 segundos
    setTimeout(() => {
      notification.close();
    }, 5000);

    // Quando a notificação for clicada, focar na janela
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  } catch (error) {
    console.error('Erro ao exibir notificação:', error);
    return null;
  }
}

/**
 * Exibe notificação de novo atendimento
 * @param clienteNome - Nome do cliente
 * @param atendimentoId - ID do atendimento (opcional, para navegação)
 */
export function showAtendimentoNotification(clienteNome: string, atendimentoId?: string) {
  const title = 'Novo Atendimento';
  const body = clienteNome 
    ? `Novo atendimento de ${clienteNome}`
    : 'Você tem um novo atendimento';

  // Verificar se o navegador suporta notificações
  if (!('Notification' in window)) {
    console.warn('Este navegador não suporta notificações');
    return;
  }

  // Se não tem permissão, não exibir
  if (Notification.permission !== 'granted') {
    console.warn('Permissão de notificações não concedida');
    return;
  }

  try {
    const notification = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'atendimento-notification',
      requireInteraction: false,
      body,
      data: atendimentoId ? { atendimentoId } : undefined,
    });

    // Fechar automaticamente após 5 segundos
    setTimeout(() => {
      notification.close();
    }, 5000);

    // Quando a notificação for clicada, tentar tocar o som novamente
    // (já que o clique é uma interação do usuário que pode desbloquear o áudio)
    notification.onclick = () => {
      window.focus();
      
      // Importar e tocar som quando o usuário interagir com a notificação
      import('@/utils/audio').then(({ playNotificationSound }) => {
        playNotificationSound();
      });

      // Se tiver atendimentoId, pode navegar para o atendimento
      if (atendimentoId) {
        // Disparar evento para abrir o atendimento (se necessário)
        window.dispatchEvent(new CustomEvent('openAtendimento', { 
          detail: { atendimentoId } 
        }));
      }

      notification.close();
    };
  } catch (error) {
    console.error('Erro ao exibir notificação de atendimento:', error);
  }
}

