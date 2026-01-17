'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { updatePassword, signOut } from '@/lib/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/lib/constants';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Processar o token de reset de senha da URL
    const processResetToken = async () => {
      try {
        // O Supabase processa automaticamente o token quando há hash na URL (#access_token=...)
        // Verificamos se há uma sessão válida após processar o token
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const type = hashParams.get('type');
        
        // Se não houver token na URL, verificar se já existe uma sessão
        if (!accessToken && type !== 'recovery') {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session) {
            setError('Link inválido ou expirado. Por favor, solicite um novo link de recuperação.');
            setValidatingToken(false);
            return;
          }
        }

        // Se houver token na URL, o Supabase já processou automaticamente
        // Verificar se a sessão foi criada
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          setError('Link inválido ou expirado. Por favor, solicite um novo link de recuperação.');
          setValidatingToken(false);
          return;
        }

        // Limpar o hash da URL para evitar problemas
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname);
        }

        setValidatingToken(false);
      } catch (err) {
        console.error('Erro ao processar token:', err);
        setError('Erro ao validar o link. Por favor, tente novamente.');
        setValidatingToken(false);
      }
    };

    processResetToken();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validações
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await updatePassword(password);
      if (error) {
        setError(error.message || 'Erro ao atualizar senha. Tente novamente.');
      } else {
        setSuccess(true);
        // Fazer logout após atualizar a senha para garantir que o usuário precise fazer login novamente
        await signOut();
        // Redirecionar para login após 2 segundos
        setTimeout(() => {
          router.push(ROUTES.LOGIN);
        }, 2000);
      }
    } catch (err) {
      console.error('Erro ao atualizar senha:', err);
      setError('Erro ao atualizar senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (validatingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Validando link...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <div className="mb-4">
              <svg className="w-16 h-16 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Senha atualizada com sucesso!</h1>
            <p className="text-gray-600 mb-4">Sua senha foi redefinida. Redirecionando para o login...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Redefinir Senha</h1>
          <p className="mt-2 text-gray-600">Digite sua nova senha</p>
        </div>
        
        <form onSubmit={handleSubmit} className="mt-8 space-y-6 bg-white p-8 rounded-lg shadow-md">
          <div className="space-y-4">
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nova Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                  className={`w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    error ? 'border-red-500' : 'border-gray-300'
                  } disabled:bg-gray-100 disabled:cursor-not-allowed`}
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                  className={`w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    error ? 'border-red-500' : 'border-gray-300'
                  } disabled:bg-gray-100 disabled:cursor-not-allowed`}
                  placeholder="Digite a senha novamente"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                  aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? 'Atualizando...' : 'Atualizar Senha'}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => router.push(ROUTES.LOGIN)}
              className="text-sm text-primary-600 hover:text-primary-800 font-medium transition-colors"
              disabled={loading}
            >
              Voltar para o login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
