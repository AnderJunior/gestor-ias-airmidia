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
  clienteId?: string;
  telefone?: string | null;
  onSuccess: () => void;
}

export function EditarNomeInstanciaModal({
  isOpen,
  onClose,
  instancia,
  clienteId,
  telefone,
  onSuccess,
}: EditarNomeInstanciaModalProps) {
  const [telefoneValue, setTelefoneValue] = useState('');
  const [telefoneFormatado, setTelefoneFormatado] = useState('');
  const [nomeInstancia, setNomeInstancia] = useState('');
  const [zApiInstanceId, setZApiInstanceId] = useState('');
  const [zApiToken, setZApiToken] = useState('');
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
    if (instancia || (clienteId && telefone)) {
      const tel = instancia?.telefone || telefone || '';
      setTelefoneValue(tel);
      setTelefoneFormatado(tel ? formatarTelefone(tel) : '');
      setNomeInstancia(instancia?.instance_name || '');
      setZApiInstanceId(instancia?.z_api_instance_id || '');
      setZApiToken(instancia?.z_api_token || '');
      setError('');
    } else {
      setTelefoneValue('');
      setTelefoneFormatado('');
      setNomeInstancia('');
      setZApiInstanceId('');
      setZApiToken('');
      setError('');
    }
  }, [instancia, isOpen, clienteId, telefone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!nomeInstancia.trim()) {
      setError('O nome da instância é obrigatório');
      return;
    }

    if (!instancia && (!clienteId || !telefoneValue?.trim())) {
      setError('Não é possível criar instância sem cliente e telefone');
      return;
    }

    const telefoneFinal = telefoneValue?.trim() ? removerFormatacao(telefoneValue) : '';
    if (telefoneFinal && telefoneFinal.length < 12) {
      setError('Telefone inválido. Use DDD + número.');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await (await import('@/lib/supabaseClient')).supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const tf = telefoneValue?.trim() ? removerFormatacao(telefoneValue) : '';
      const requestBody: any = {
        nomeInstancia: nomeInstancia.trim(),
        z_api_instance_id: zApiInstanceId.trim() || undefined,
        z_api_token: zApiToken.trim() || undefined,
        telefone: tf || undefined,
      };

      if (instancia) {
        requestBody.instanciaId = instancia.id;
        if (clienteId) requestBody.clienteId = clienteId;
      } else if (clienteId && tf) {
        requestBody.clienteId = clienteId;
        requestBody.telefone = tf;
      }

      const response = await fetch('/api/admin/editar-nome-instancia', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar nome da instância');
      }

      onSuccess();
      onClose();
      setTelefoneValue('');
      setTelefoneFormatado('');
      setNomeInstancia('');
      setZApiInstanceId('');
      setZApiToken('');
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar instância. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setTelefoneValue('');
      setTelefoneFormatado('');
      setNomeInstancia('');
      setZApiInstanceId('');
      setZApiToken('');
      setError('');
      onClose();
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose}
      title="Editar Instância Z-API"
      closeOnClickOutside={!loading}
      size="md"
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {!instancia && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              Este cliente não possui instância WhatsApp cadastrada. Uma nova instância será criada.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Input
            label="Telefone IA"
            type="tel"
            value={telefoneFormatado}
            onChange={(e) => {
              const v = e.target.value;
              const formatado = formatarTelefone(v);
              const raw = removerFormatacao(v);
              setTelefoneFormatado(formatado);
              setTelefoneValue(raw);
            }}
            required={!instancia}
            disabled={loading}
            placeholder="+55 (11) 99999-9999"
          />

          <Input
            label="Nome da Instância"
            type="text"
            value={nomeInstancia}
            onChange={(e) => setNomeInstancia(e.target.value)}
            required
            disabled={loading}
            placeholder="Ex: joao5511999999999"
          />

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2 mt-4">
            <p className="text-sm font-medium text-gray-700">Credenciais Z-API</p>
            <p className="text-xs text-gray-500">
              Instance ID e Token obtidos no painel Z-API. Necessários para verificar conexão e exibir QR code.
            </p>
            <Input
              label="Instance ID"
              type="text"
              value={zApiInstanceId}
              onChange={(e) => setZApiInstanceId(e.target.value)}
              disabled={loading}
              placeholder="ID da instância no Z-API"
            />
            <Input
              label="Token"
              type="password"
              value={zApiToken}
              onChange={(e) => setZApiToken(e.target.value)}
              disabled={loading}
              placeholder="Token da instância"
            />
          </div>

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

