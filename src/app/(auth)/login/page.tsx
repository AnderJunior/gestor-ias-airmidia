'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/lib/constants';
import { LoginForm } from './LoginForm';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace(ROUTES.DASHBOARD);
    }
  }, [user, loading, router]);

  // Se estiver carregando ou usuário já logado, mostra loading enquanto redireciona
  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Sistema Gestão IA</h1>
          <p className="mt-2 text-gray-600">Faça login para acessar o sistema</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}







