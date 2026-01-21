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

  // Verificar se o usuário é cliente (não administrador)
  const isCliente = useMemo(() => {
    // Se não tem tipo definido, assume que é cliente (comportamento padrão)
    // Se tem tipo e é 'cliente', retorna true
    // Se tem tipo e é 'administracao', retorna false
    return usuario?.tipo !== 'administracao';
  }, [usuario?.tipo]);

  const verificando = authLoading || usuarioLoading;

  useEffect(() => {
    // Só mostrar modal se:
    // 1. Não estiver carregando
    // 2. Os dados não estiverem completos
    // 3. O usuário for cliente (não administrador)
    // 4. O usuário existir
    if (!verificando && !dadosCompletos && usuario !== null && isCliente) {
      setMostrarModal(true);
    } else if (dadosCompletos || !isCliente) {
      setMostrarModal(false);
    }
  }, [verificando, dadosCompletos, usuario, isCliente]);

  const handleComplete = () => {
    setMostrarModal(false);
    // Recarrega a página para garantir que tudo está atualizado
    window.location.reload();
  };

  // Não renderiza nada enquanto está verificando ou se não há usuário
  // Também não renderiza se o usuário for administrador
  if (verificando || !user || !isCliente) {
    return null;
  }

  return (
    <ConfiguracaoInicialModal
      isOpen={mostrarModal}
      onComplete={handleComplete}
    />
  );
}

