'use client';

import { useEffect, useState, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';

interface WhatsAppConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceName: string;
  telefone?: string;
}

const QR_POLL_INTERVAL = 15000; // Z-API QR expira em ~20s, renovar a cada 15s
const STATUS_POLL_INTERVAL = 5000;

export function WhatsAppConnectionModal({
  isOpen,
  onClose,
  instanceName,
  telefone,
}: WhatsAppConnectionModalProps) {
  const { user } = useAuth();
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    return { Authorization: `Bearer ${session.access_token}` };
  }, []);

  const fetchQRCode = useCallback(async () => {
    const headers = await getAuthHeaders();
    if (!headers) return null;
    const res = await fetch('/api/whatsapp/qr-code', { headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao obter QR code');
    return data.base64 as string;
  }, [getAuthHeaders]);

  const checkStatus = useCallback(async () => {
    const headers = await getAuthHeaders();
    if (!headers) return false;
    const res = await fetch('/api/whatsapp/status', { headers });
    const data = await res.json();
    if (!res.ok) return false;
    return data.connected === true;
  }, [getAuthHeaders]);

  // Carregar QR code ao abrir e renovar a cada 15s (Z-API expira em ~20s)
  useEffect(() => {
    if (!isOpen) return;

    const loadQR = async () => {
      setLoading(true);
      setError('');
      try {
        const base64 = await fetchQRCode();
        if (base64) {
          setQrCodeBase64(base64.replace(/^data:image\/[^;]+;base64,/, ''));
        } else {
          setError('Instância Z-API não configurada. Configure nas configurações ou ao editar o cliente.');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar QR code');
        setQrCodeBase64(null);
      } finally {
        setLoading(false);
      }
    };

    loadQR();
    const interval = setInterval(loadQR, QR_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [isOpen, fetchQRCode]);

  // Verificar status a cada 5s; quando conectado, sincronizar via API e fechar
  useEffect(() => {
    if (!isOpen || !telefone || !user?.id) return;

    const verify = async () => {
      try {
        const connected = await checkStatus();
        if (connected) {
          const headers = await getAuthHeaders();
          if (headers) {
            await fetch('/api/whatsapp/sync-status', {
              method: 'POST',
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                instanceName,
                telefone,
                status: 'conectado',
              }),
            });
          }
          onClose();
        }
      } catch {
        // Ignorar erros de verificação
      }
    };

    verify();
    const interval = setInterval(verify, STATUS_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [isOpen, instanceName, telefone, user?.id, onClose, checkStatus, getAuthHeaders]);

  const handleAtualizarQR = async () => {
    setLoading(true);
    setError('');
    try {
      const base64 = await fetchQRCode();
      if (base64) {
        setQrCodeBase64(base64.replace(/^data:image\/[^;]+;base64,/, ''));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar QR code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Escaneie o QR Code"
      closeOnClickOutside={true}
      width={900}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          {loading && !qrCodeBase64 ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded space-y-3">
              <p className="font-medium">Erro ao carregar informações de conexão</p>
              <p className="text-sm">{error}</p>
              <button
                onClick={handleAtualizarQR}
                disabled={loading}
                className="mt-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Tentando...' : 'Tentar Novamente'}
              </button>
            </div>
          ) : qrCodeBase64 ? (
            <div className="flex flex-col items-center space-y-4">
              <div className="bg-white p-4 rounded-lg border-2 border-gray-200 w-fit">
                <img
                  src={`data:image/png;base64,${qrCodeBase64}`}
                  alt="QR Code"
                  className="w-80 h-80"
                />
              </div>
              <button
                onClick={handleAtualizarQR}
                disabled={loading}
                className="w-[352px] flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                <span className="text-sm font-medium">Atualizar QR</span>
              </button>
              <p className="text-xs text-gray-500 text-center">
                O QR code expira em cerca de 20 segundos. Clique em &quot;Atualizar QR&quot; se necessário.
              </p>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">Carregando QR Code...</div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Como conectar</h3>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">1</div>
              <div>
                <h4 className="font-medium text-gray-900">Abra o WhatsApp no seu celular</h4>
                <p className="text-sm text-gray-600 mt-1">Certifique-se de que está usando a versão mais recente.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">2</div>
              <div>
                <h4 className="font-medium text-gray-900">Acesse as configurações</h4>
                <p className="text-sm text-gray-600 mt-1">Toque em Configurações → Dispositivos conectados</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">3</div>
              <div>
                <h4 className="font-medium text-gray-900">Escaneie o QR Code</h4>
                <p className="text-sm text-gray-600 mt-1">Toque em Conectar um dispositivo e escaneie o QR Code acima.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">4</div>
              <div>
                <h4 className="font-medium text-gray-900">Aguarde a Conexão</h4>
                <p className="text-sm text-gray-600 mt-1">Após escanear, aguarde a confirmação da conexão.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
