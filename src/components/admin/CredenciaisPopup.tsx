'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';

interface CredenciaisPopupProps {
  email: string;
  senha: string;
  tipoCliente: 'atendimento' | 'agendamento' | 'administracao';
  onClose: () => void;
}

export function CredenciaisPopup({ email, senha, tipoCliente, onClose }: CredenciaisPopupProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Prevenir scroll do body quando o popup estiver aberto
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const tipoClienteTexto = 
    tipoCliente === 'atendimento' ? 'Atendimento' : 
    tipoCliente === 'agendamento' ? 'Agendamento' : 
    'Administração';

  const mensagemCredenciais = `Suas credenciais para acessar a conta são:
- E-mail: ${email}
- Senha: ${senha}`;

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(mensagemCredenciais);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  };

  if (!mounted) return null;

  const popupContent = (
    <div 
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Usuário
            </label>
            <div className="flex items-center gap-2">
              <span className="flex-1 text-gray-600 text-sm">{email}</span>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(email);
                  } catch (err) {
                    console.error('Erro ao copiar email:', err);
                  }
                }}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 text-sm flex items-center gap-1.5 transition-colors"
                title="Copiar email"
              >
                <Copy className="w-4 h-4" />
                <span>Copiar</span>
              </button>
            </div>
          </div>

          {/* Senha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <div className="flex items-center gap-2">
              <span className="flex-1 text-gray-600 text-sm font-mono">
                {showPassword ? senha : '********'}
              </span>
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 text-sm flex items-center gap-1.5 transition-colors"
                title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                <span>{showPassword ? 'Ocultar' : 'Mostrar'}</span>
              </button>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(senha);
                  } catch (err) {
                    console.error('Erro ao copiar senha:', err);
                  }
                }}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 text-sm flex items-center gap-1.5 transition-colors"
                title="Copiar senha"
              >
                <Copy className="w-4 h-4" />
                <span>Copiar</span>
              </button>
            </div>
          </div>

          {/* Tipo de Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de cliente
            </label>
            <span className="text-gray-600 text-sm">{tipoClienteTexto}</span>
          </div>

          {/* Botão Copiar Credenciais */}
          <button
            onClick={handleCopiar}
            className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copiar usuário e senha</span>
              </>
            )}
          </button>

          {/* Botão Fechar */}
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 text-sm transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(popupContent, document.body);
}

