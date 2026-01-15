'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabaseClient';

interface CriarClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CriarClienteModal({ isOpen, onClose, onSuccess }: CriarClienteModalProps) {
  const [nome, setNome] = useState('');
  const [telefoneAtendimento, setTelefoneAtendimento] = useState('');
  const [telefoneFormatado, setTelefoneFormatado] = useState('');
  const [tipoCliente, setTipoCliente] = useState<'atendimento' | 'agendamento'>('atendimento');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Função para formatar telefone: +55 (99) 99999-9999
  const formatarTelefone = (valor: string) => {
    // Remove tudo que não é número
    let numeros = valor.replace(/\D/g, '');
    
    // Se começar com 55, remove para formatar depois (mantém apenas DDD + número)
    // Isso permite que o usuário digite com ou sem o 55 inicial
    if (numeros.startsWith('55')) {
      numeros = numeros.substring(2);
    }
    
    // Aceita até 11 dígitos (DDD + 9 dígitos do celular)
    // Não limita antes para permitir digitação completa
    const numerosLimitados = numeros.slice(0, 11);
    
    // Se não tem números, retorna vazio
    if (numerosLimitados.length === 0) {
      return '';
    }
    
    // Formata: +55 (99) 99999-9999
    const ddd = numerosLimitados.slice(0, 2);
    const primeiraParte = numerosLimitados.slice(2, 7);
    const segundaParte = numerosLimitados.slice(7, 11);
    
    if (numerosLimitados.length <= 2) {
      return `+55 (${ddd}`;
    } else if (numerosLimitados.length <= 7) {
      return `+55 (${ddd}) ${primeiraParte}`;
    } else {
      return `+55 (${ddd}) ${primeiraParte}-${segundaParte}`;
    }
  };

  // Função para remover formatação e garantir que tenha 55 no início
  const removerFormatacao = (valor: string): string => {
    const numeros = valor.replace(/\D/g, '');
    // Se já começar com 55, retorna como está (até 13 dígitos: 55 + DDD + 9)
    if (numeros.startsWith('55')) {
      return numeros.slice(0, 13);
    }
    // Senão, adiciona 55 no início (até 11 dígitos para adicionar 55 = 13 total)
    const numerosLimitados = numeros.slice(0, 11);
    return `55${numerosLimitados}`;
  };

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    
    // Formatar o valor digitado
    const formatado = formatarTelefone(valor);
    setTelefoneFormatado(formatado);
    
    // Salvar apenas números com +55 para o backend
    const telefoneLimpo = removerFormatacao(valor);
    // Garantir que tenha no máximo 13 dígitos (55 + DDD + 9 dígitos)
    const telefoneFinal = telefoneLimpo.slice(0, 13);
    setTelefoneAtendimento(telefoneFinal);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const response = await fetch('/api/admin/criar-cliente', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          nome,
          telefone_ia: telefoneAtendimento,
          tipo_marcacao: tipoCliente,
          email,
          senha,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar cliente');
      }

      // Limpar formulário
      setNome('');
      setTelefoneAtendimento('');
      setTelefoneFormatado('');
      setTipoCliente('atendimento');
      setEmail('');
      setSenha('');
      
      // Fechar modal e atualizar lista
      onClose();
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar cliente. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setNome('');
      setTelefoneAtendimento('');
      setTelefoneFormatado('');
      setTipoCliente('atendimento');
      setEmail('');
      setSenha('');
      setError('');
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Adicionar Novo Cliente"
      closeOnClickOutside={!loading}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nome"
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          disabled={loading}
          placeholder="Nome completo do cliente"
        />

        <Input
          label="Telefone Atendimento"
          type="tel"
          value={telefoneFormatado}
          onChange={handleTelefoneChange}
          required
          disabled={loading}
          placeholder="+55 (11) 99999-9999"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo Cliente
          </label>
          <select
            value={tipoCliente}
            onChange={(e) => setTipoCliente(e.target.value as 'atendimento' | 'agendamento')}
            disabled={loading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            required
          >
            <option value="atendimento">Atendimento</option>
            <option value="agendamento">Agendamento</option>
          </select>
        </div>

        <Input
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          placeholder="email@exemplo.com"
        />

        <Input
          label="Senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          disabled={loading}
          placeholder="Mínimo 6 caracteres"
          minLength={6}
        />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
          >
            {loading ? 'Criando...' : 'Criar Cliente'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

