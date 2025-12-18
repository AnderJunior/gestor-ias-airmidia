'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { WhatsAppInstance } from '@/types/domain';

interface EditarNomeInstanciaModalProps {
  isOpen: boolean;
  onClose: () => void;
  instancia: WhatsAppInstance | null;
  onSuccess: () => void;
}

export function EditarNomeInstanciaModal({
  isOpen,
  onClose,
  instancia,
  onSuccess,
}: EditarNomeInstanciaModalProps) {
  const [nomeInstancia, setNomeInstancia] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (instancia) {
      setNomeInstancia(instancia.instance_name || '');
      setError('');
    }
  }, [instancia, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!nomeInstancia.trim()) {
      setError('O nome da instância é obrigatório');
      return;
    }

    if (!instancia) {
      setError('Instância não encontrada');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await (await import('@/lib/supabaseClient')).supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const response = await fetch('/api/admin/editar-nome-instancia', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          instanciaId: instancia.id,
          nomeInstancia: nomeInstancia.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar nome da instância');
      }

      onSuccess();
      onClose();
      setNomeInstancia('');
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar nome da instância. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setNomeInstancia('');
      setError('');
      onClose();
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose}
      title="Editar Nome da Instância"
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
            label="Nome da Instância"
            type="text"
            value={nomeInstancia}
            onChange={(e) => setNomeInstancia(e.target.value)}
            required
            disabled={loading}
            placeholder="Digite o nome da instância"
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

