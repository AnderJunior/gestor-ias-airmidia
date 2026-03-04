'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Usuario } from '@/lib/api/usuarios';

interface EditarClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: Usuario | null;
  onSuccess: () => void;
}

export function EditarClienteModal({
  isOpen,
  onClose,
  cliente,
  onSuccess,
}: EditarClienteModalProps) {
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [telefoneFormatado, setTelefoneFormatado] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatarTelefone = (valor: string) => {
    let numeros = valor.replace(/\D/g, '');
    if (numeros.startsWith('55')) numeros = numeros.substring(2);
    const limitados = numeros.slice(0, 11);
    if (limitados.length === 0) return '';
    const ddd = limitados.slice(0, 2);
    const primeira = limitados.slice(2, 7);
    const segunda = limitados.slice(7, 11);
    if (limitados.length <= 2) return `+55 (${ddd}`;
    if (limitados.length <= 7) return `+55 (${ddd}) ${primeira}`;
    return `+55 (${ddd}) ${primeira}-${segunda}`;
  };
  const removerFormatacao = (valor: string) => {
    const n = valor.replace(/\D/g, '');
    return n.startsWith('55') ? n.slice(0, 13) : `55${n.slice(0, 11)}`;
  };

  useEffect(() => {
    if (cliente) {
      loadClienteEmail();
      setTelefone(cliente.telefone_ia || '');
      setTelefoneFormatado(cliente.telefone_ia ? formatarTelefone(cliente.telefone_ia) : '');
      setError('');
    }
  }, [cliente, isOpen]);

  const loadClienteEmail = async () => {
    if (!cliente) return;

    try {
      const { data: { session } } = await (await import('@/lib/supabaseClient')).supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(`/api/admin/buscar-email-cliente?id=${cliente.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (response.ok && data.email) {
        setEmail(data.email);
      }
    } catch (err) {
      console.error('Erro ao buscar email:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email?.trim() && !telefone?.trim()) {
      setError('Informe e-mail e/ou telefone');
      return;
    }
    if (email?.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError('E-mail inválido');
        return;
      }
    }
    if (!cliente) {
      setError('Cliente não encontrado');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await (await import('@/lib/supabaseClient')).supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const response = await fetch('/api/admin/editar-email-cliente', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          clienteId: cliente.id,
          email: email?.trim() || undefined,
          telefone_ia: telefone?.trim() ? removerFormatacao(telefone) : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar e-mail do cliente');
      }

      onSuccess();
      onClose();
      setEmail('');
      setTelefone('');
      setTelefoneFormatado('');
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar e-mail do cliente. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setEmail('');
      setTelefone('');
      setTelefoneFormatado('');
      setError('');
      onClose();
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose}
      title="Editar Informações do Cliente"
      closeOnClickOutside={!loading}
      size="md"
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Input
            label="E-mail de Acesso"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            placeholder="Digite o novo e-mail"
          />

          <Input
            label="Telefone IA"
            type="tel"
            value={telefoneFormatado}
            onChange={(e) => {
              const v = e.target.value;
              const formatado = formatarTelefone(v);
              const raw = removerFormatacao(v);
              setTelefoneFormatado(formatado);
              setTelefone(raw);
            }}
            disabled={loading}
            placeholder="+55 (11) 99999-9999"
          />

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
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

