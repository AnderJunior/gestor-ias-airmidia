'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, resetPassword } from '@/lib/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ROUTES } from '@/lib/constants';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Previne propagação do evento
    
    // Validação básica
    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        // Traduz mensagens de erro do Supabase
        if (error.message.includes('Invalid login credentials') || error.message.includes('Email not confirmed')) {
          setError('Credenciais inválidas. Verifique seu e-mail e senha e tente novamente.');
        } else if (error.message.includes('missing email or phone')) {
          setError('Por favor, preencha o campo de e-mail.');
        } else {
          setError(error.message || 'Erro ao fazer login');
        }
      } else {
        router.push(ROUTES.DASHBOARD);
        router.refresh();
      }
    } catch (err) {
      setError('Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess(false);
    
    // Validação do email
    if (!resetEmail || !resetEmail.trim()) {
      setResetError('Por favor, digite um e-mail válido.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(resetEmail.trim())) {
      setResetError('Por favor, digite um e-mail válido.');
      return;
    }

    setResetLoading(true);

    try {
      const { error } = await resetPassword(resetEmail.trim());
      if (error) {
        // Traduz mensagens de erro comuns do Supabase
        if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
          setResetError('Muitas tentativas. Por favor, aguarde alguns minutos antes de tentar novamente.');
        } else if (error.message.includes('email') || error.message.includes('user not found')) {
          setResetError('E-mail não encontrado no sistema. Verifique se o e-mail está correto.');
        } else if (error.message.includes('For security purposes')) {
          setResetError('Por segurança, aguarde alguns minutos antes de solicitar um novo link.');
        } else {
          setResetError(error.message || 'Erro ao enviar email de recuperação. Tente novamente.');
        }
        console.error('Erro ao resetar senha:', error);
      } else {
        // Supabase sempre retorna sucesso, mesmo se o email não existir (por segurança)
        // Mas vamos mostrar a mensagem de sucesso
        setResetSuccess(true);
      }
    } catch (err) {
      console.error('Erro ao resetar senha:', err);
      setResetError('Erro ao enviar email de recuperação. Verifique sua conexão e tente novamente.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleOpenResetModal = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setError(''); // Limpa erro do login
    setShowResetModal(true);
    setResetEmail(email); // Preenche com o email do login se já tiver sido digitado
    setResetError('');
    setResetSuccess(false);
  };

  const handleCloseResetModal = () => {
    setError(''); // Limpa erro do login ao fechar o modal
    setShowResetModal(false);
    setResetEmail('');
    setResetError('');
    setResetSuccess(false);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6 bg-white p-8 rounded-lg shadow-md">
      <div className="space-y-4">
        <Input
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
        <div className="w-full">
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-gray-700">
              Senha
            </label>
            <button
              type="button"
              onClick={handleOpenResetModal}
              className="text-sm text-primary-600 hover:text-primary-800 font-medium transition-colors"
              disabled={loading}
            >
              Esqueci minha senha
            </button>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className={`w-full px-4 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                error ? 'border-red-500' : 'border-gray-300'
              } disabled:bg-gray-100 disabled:cursor-not-allowed`}
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
        {loading ? 'Entrando...' : 'Entrar'}
      </Button>

      <Modal
        isOpen={showResetModal}
        onClose={handleCloseResetModal}
        title="Recuperar Senha"
        closeOnClickOutside={!resetLoading}
        size="md"
      >
        {resetSuccess ? (
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
              <h3 className="text-xl font-bold text-black mb-2">
                Email enviado com sucesso!
              </h3>
              <p className="text-sm text-gray-500">
                Enviamos um link de recuperação de senha para <strong className="text-gray-700">{resetEmail}</strong>. Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
              </p>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleCloseResetModal}
                variant="primary"
              >
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <p className="text-gray-600 text-sm">
              Digite seu e-mail cadastrado e enviaremos um link para redefinir sua senha.
            </p>
            
            <Input
              label="E-mail"
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
              disabled={resetLoading}
              placeholder="seu@email.com"
            />

            {resetError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                {resetError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleCloseResetModal}
                disabled={resetLoading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={resetLoading}
              >
                {resetLoading ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </form>
  );
}







