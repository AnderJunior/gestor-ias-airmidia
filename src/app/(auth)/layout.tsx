'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/lib/constants';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Não redirecionar se estiver na página de reset de senha
    // pois o Supabase cria uma sessão temporária para processar o token
    if (pathname === '/reset-password') {
      return;
    }

    // Para outras páginas de auth, redirecionar se já estiver logado
    if (!loading && user && pathname !== '/reset-password') {
      router.replace(ROUTES.DASHBOARD);
    }
  }, [user, loading, router, pathname]);

  // Não mostrar loading na página de reset de senha
  if (loading && pathname !== '/reset-password') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return <>{children}</>;
}
