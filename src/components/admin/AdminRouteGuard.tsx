'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUsuario } from '@/hooks/useUsuario';
import { ROUTES } from '@/lib/constants';

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

export function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  const { usuario, loading } = useUsuario();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && usuario) {
      // Verificar se o usuário é administrador
      if (usuario.tipo !== 'administracao') {
        // Redirecionar para dashboard se não for administrador
        router.push(ROUTES.DASHBOARD);
      }
    }
  }, [usuario, loading, router, pathname]);

  // Mostrar loading enquanto verifica
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Se não for administrador, não renderizar nada (o useEffect vai redirecionar)
  if (usuario?.tipo !== 'administracao') {
    return null;
  }

  return <>{children}</>;
}

