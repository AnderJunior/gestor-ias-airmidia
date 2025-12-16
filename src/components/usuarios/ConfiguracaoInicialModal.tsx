'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { upsertUsuario } from '@/lib/api/usuarios';

interface ConfiguracaoInicialModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function ConfiguracaoInicialModal({ isOpen, onComplete }: ConfiguracaoInicialModalProps) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Função para formatar telefone com máscara (99) 99999-9999
  const formatarTelefone = (valor: string) => {
    // Remove tudo que não é número
    const numeros = valor.replace(/\D/g, '');
    
    // Limita a 11 dígitos (DDD + 9 dígitos)
    const numerosLimitados = numeros.slice(0, 11);
    
    // Aplica a máscara
    if (numerosLimitados.length <= 2) {
      return numerosLimitados.length > 0 ? `(${numerosLimitados}` : '';
    } else if (numerosLimitados.length <= 7) {
      return `(${numerosLimitados.slice(0, 2)}) ${numerosLimitados.slice(2)}`;
    } else {
      return `(${numerosLimitados.slice(0, 2)}) ${numerosLimitados.slice(2, 7)}-${numerosLimitados.slice(7)}`;
    }
  };

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valorFormatado = formatarTelefone(e.target.value);
    setTelefone(valorFormatado);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validação básica
    if (!nome.trim()) {
      setError('Por favor, preencha o nome');
      setLoading(false);
      return;
    }

    if (!telefone.trim()) {
      setError('Por favor, preencha o telefone');
      setLoading(false);
      return;
    }

    // Validação de formato de telefone (apenas números)
    const telefoneLimpo = telefone.replace(/\D/g, '');
    if (telefoneLimpo.length < 10 || telefoneLimpo.length > 11) {
      setError('Por favor, insira um telefone válido com DDD (10 ou 11 dígitos)');
      setLoading(false);
      return;
    }

    try {
      await upsertUsuario(nome.trim(), telefoneLimpo);
      onComplete();
    } catch (err) {
      console.error('Erro ao salvar dados:', err);
      setError('Erro ao salvar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}} // Não permite fechar sem preencher
      title="Configuração Inicial"
      closeOnClickOutside={false}
    >
      <div className="space-y-4">
        <p className="text-gray-600">
          Para continuar, precisamos de algumas informações básicas:
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Digite seu nome completo"
            required
            disabled={loading}
          />

          <Input
            label="Telefone para atendimento da IA"
            type="tel"
            value={telefone}
            onChange={handleTelefoneChange}
            placeholder="(99) 99999-9999"
            required
            disabled={loading}
            maxLength={15}
          />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? 'Salvando...' : 'Salvar e Continuar'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

