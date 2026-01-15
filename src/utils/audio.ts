// Cache para o contexto de áudio desbloqueado
let audioContextUnlocked = false;

/**
 * Tenta desbloquear o contexto de áudio se ainda não foi desbloqueado
 */
function unlockAudioContext() {
  if (audioContextUnlocked) return;
  
  try {
    // Tentar desbloquear via AudioContext
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        audioContextUnlocked = true;
        console.log('AudioContext desbloqueado');
      }).catch(() => {
        // Ignorar erro
      });
    } else {
      audioContextUnlocked = true;
    }
  } catch (error) {
    // Ignorar erro
  }
}

/**
 * Toca o som de notificação 2 vezes sequencialmente
 * Espera o primeiro som terminar antes de tocar o segundo
 */
export function playNotificationSound() {
  try {
    console.log('Tentando tocar som de notificação...');
    
    // Tentar desbloquear o contexto de áudio antes de tocar
    unlockAudioContext();
    
    const audio = new Audio('/sons/blip-131856.mp3');
    audio.volume = 0.7;
    audio.preload = 'auto';
    
    // Adicionar tratamento de erro para debug
    audio.onerror = (e) => {
      console.error('Erro ao carregar áudio:', e, audio.error);
    };
    
    // Configurar o evento onended ANTES de tocar o primeiro som
    audio.onended = () => {
      console.log('Primeiro som terminou, tocando segundo...');
      // Tocar o som pela segunda vez após o primeiro terminar
      const audio2 = new Audio('/sons/blip-131856.mp3');
      audio2.volume = 0.7;
      audio2.preload = 'auto';
      audio2.onerror = (e) => {
        console.error('Erro ao carregar segundo áudio:', e, audio2.error);
      };
      audio2.play()
        .then(() => {
          console.log('Segundo som tocado com sucesso');
        })
        .catch((err) => {
          console.error('Erro ao tocar segundo som:', err);
        });
    };
    
    // Tocar o som pela primeira vez
    const playPromise1 = audio.play();
    if (playPromise1 !== undefined) {
      playPromise1
        .then(() => {
          console.log('Primeiro som tocado com sucesso');
        })
        .catch((err) => {
          console.error('Erro ao tocar primeiro som:', err);
          // Tentar desbloquear novamente e tentar mais uma vez
          unlockAudioContext();
          setTimeout(() => {
            console.log('Tentando tocar novamente após erro...');
            audio.play()
              .then(() => {
                console.log('Som tocado com sucesso na segunda tentativa');
              })
              .catch((err2) => {
                console.error('Erro na segunda tentativa:', err2);
                // Se o primeiro falhar, tentar tocar o segundo mesmo assim após um delay
                setTimeout(() => {
                  console.log('Tentando tocar segundo som após erro no primeiro...');
                  const audio2 = new Audio('/sons/blip-131856.mp3');
                  audio2.volume = 0.7;
                  audio2.preload = 'auto';
                  audio2.onerror = (e) => {
                    console.error('Erro ao carregar segundo áudio (fallback):', e);
                  };
                  audio2.play()
                    .then(() => {
                      console.log('Segundo som (fallback) tocado com sucesso');
                    })
                    .catch((err3) => {
                      console.error('Erro ao tocar segundo som (fallback):', err3);
                    });
                }, 500);
              });
          }, 100);
        });
    }
  } catch (error) {
    console.error('Erro geral ao tentar tocar som:', error);
  }
}



