'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUsuario } from '@/hooks/useUsuario';
import { ConfiguracaoInicialModal } from './ConfiguracaoInicialModal';

export function VerificacaoDadosIniciais() {
  const { user, loading: authLoading } = useAuth();
  const { usuario, loading: usuarioLoading } = useUsuario();
  const [mostrarModal, setMostrarModal] = useState(false);

  // Verificar se os dados estão completos baseado no usuario carregado
  const dadosCompletos = useMemo(() => {
    return !!(usuario?.nome && usuario?.telefone_ia);
  }, [usuario]);

  const verificando = authLoading || usuarioLoading;

  useEffect(() => {
    if (!verificando && !dadosCompletos && usuario !== null) {
      // Só mostrar modal se não estiver carregando e os dados não estiverem completos
      setMostrarModal(true);
    } else if (dadosCompletos) {
      setMostrarModal(false);
    }
  }, [verificando, dadosCompletos, usuario]);

  const handleComplete = () => {
    setMostrarModal(false);
    // Recarrega a página para garantir que tudo está atualizado
    window.location.reload();
  };

  // Não renderiza nada enquanto está verificando ou se não há usuário
  if (verificando || !user) {
    return null;
  }

  return (
    <ConfiguracaoInicialModal
      isOpen={mostrarModal}
      onComplete={handleComplete}
    />
  );
}

