'use client';

import { useEffect, useRef } from 'react';

/**
 * Hook para desbloquear o áudio do navegador na primeira interação do usuário
 * Isso resolve o problema de autoplay bloqueado pelos navegadores
 */
export function useAudioUnlock() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const isUnlockedRef = useRef(false);

  useEffect(() => {
    // Função para desbloquear o áudio
    const unlockAudio = () => {
      if (isUnlockedRef.current) return;

      try {
        // Criar um contexto de áudio silencioso para desbloquear
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;

        // Criar um buffer vazio e tocar para desbloquear
        const buffer = audioContext.createBuffer(1, 1, 22050);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);

        // Também tentar desbloquear via HTMLAudioElement
        const audio = new Audio();
        audio.volume = 0.01;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              audio.pause();
              audio.currentTime = 0;
              isUnlockedRef.current = true;
            })
            .catch(() => {
              // Ignorar erro, tentaremos novamente na próxima interação
            });
        }
      } catch (error) {
        // Ignorar erros silenciosamente
      }
    };

    // Lista de eventos que podem desbloquear o áudio
    const events = ['click', 'touchstart', 'keydown', 'mousedown'];

    // Adicionar listeners para desbloquear na primeira interação
    events.forEach((event) => {
      document.addEventListener(event, unlockAudio, { once: true, passive: true });
    });

    // Cleanup
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, unlockAudio);
      });
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  return isUnlockedRef.current;
}

