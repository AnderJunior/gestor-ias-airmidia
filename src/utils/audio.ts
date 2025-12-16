/**
 * Toca o som de notificação 2 vezes sequencialmente
 * Espera o primeiro som terminar antes de tocar o segundo
 */
export function playNotificationSound() {
  try {
    const audio = new Audio('/sons/blip-131856.mp3');
    audio.volume = 0.7;
    
    // Configurar o evento onended ANTES de tocar o primeiro som
    audio.onended = () => {
      // Tocar o som pela segunda vez após o primeiro terminar
      const audio2 = new Audio('/sons/blip-131856.mp3');
      audio2.volume = 0.7;
      audio2.play().catch(() => {
        // Ignorar erros silenciosamente
      });
    };
    
    // Tocar o som pela primeira vez
    const playPromise1 = audio.play();
    if (playPromise1 !== undefined) {
      playPromise1.catch(() => {
        // Se o primeiro falhar, tentar tocar o segundo mesmo assim após um delay
        setTimeout(() => {
          const audio2 = new Audio('/sons/blip-131856.mp3');
          audio2.volume = 0.7;
          audio2.play().catch(() => {
            // Ignorar erros silenciosamente
          });
        }, 500);
      });
    }
  } catch (error) {
    // Ignorar erros silenciosamente
  }
}



