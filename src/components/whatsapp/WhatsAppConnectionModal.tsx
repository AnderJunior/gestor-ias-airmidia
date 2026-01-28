'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { obterInformacoesConexao, gerarNovoQRCode, EvolutionConnectionInfo, verificarConnectionState } from '@/lib/api/evolution';
import { sincronizarStatusInstancia } from '@/lib/api/whatsapp';

interface WhatsAppConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceName: string;
  telefone?: string;
}

export function WhatsAppConnectionModal({
  isOpen,
  onClose,
  instanceName,
  telefone,
}: WhatsAppConnectionModalProps) {
  const { user } = useAuth();
  const [connectionInfo, setConnectionInfo] = useState<EvolutionConnectionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    if (isOpen && (instanceName || telefone)) {
      carregarInformacoesConexao();
    }
  }, [isOpen, instanceName, telefone]);

  useEffect(() => {
    if (connectionInfo?.pairingCodeExpiration && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [connectionInfo, timeRemaining]);

  // Verificar status de conexão usando connectionState a cada 5 segundos enquanto o modal estiver aberto
  useEffect(() => {
    if (!isOpen || !instanceName) return;

    const verificarConexao = async () => {
      try {
        const state = await verificarConnectionState(instanceName);
        
        if (state === 'open') {
          console.log('Instância conectada (open)! Sincronizando com Supabase e fechando modal...');
          
          // Sincronizar com Supabase antes de fechar
          if (telefone && user?.id) {
            try {
              await sincronizarStatusInstancia(instanceName, telefone, 'conectado', user.id);
            } catch (syncError) {
              console.error('Erro ao sincronizar status com Supabase:', syncError);
            }
          }
          
          onClose();
        } else if (state === 'connecting') {
          // Sincronizar status "conectando" no Supabase
          if (telefone && user?.id) {
            try {
              await sincronizarStatusInstancia(instanceName, telefone, 'conectando', user.id);
            } catch (syncError) {
              console.error('Erro ao sincronizar status com Supabase:', syncError);
            }
          }
        } else if (state === 'close') {
          // Sincronizar status "desconectado" no Supabase
          if (telefone && user?.id) {
            try {
              await sincronizarStatusInstancia(instanceName, telefone, 'desconectado', user.id);
            } catch (syncError) {
              console.error('Erro ao sincronizar status com Supabase:', syncError);
            }
          }
        }
      } catch (error) {
        console.error('Erro ao verificar connection state:', error);
      }
    };

    // Verificar imediatamente
    verificarConexao();

    // Verificar a cada 5 segundos
    const interval = setInterval(verificarConexao, 5000);

    return () => clearInterval(interval);
  }, [isOpen, instanceName, onClose, telefone, user?.id]);

  const carregarInformacoesConexao = async () => {
    setLoading(true);
    setError('');
    
    try {
      const info = await obterInformacoesConexao(instanceName, telefone);
      console.log('Informações de conexão recebidas:', {
        hasQrcode: !!info.qrcode,
        hasPairingCode: !!info.pairingCode,
        qrcodeType: typeof info.qrcode,
        pairingCode: info.pairingCode,
      });
      setConnectionInfo(info);
      
      if (info.pairingCodeExpiration) {
        const expirationTime = Math.floor(info.pairingCodeExpiration / 1000);
        setTimeRemaining(expirationTime);
      }
    } catch (err: any) {
      console.error('Erro ao carregar informações de conexão:', err);
      setError(err.message || 'Erro ao carregar informações de conexão');
    } finally {
      setLoading(false);
    }
  };

  const handleGerarNovamente = async () => {
    setLoading(true);
    setError('');
    
    try {
      const info = await gerarNovoQRCode(instanceName, telefone);
      setConnectionInfo(info);
      
      if (info.pairingCodeExpiration) {
        const expirationTime = Math.floor(info.pairingCodeExpiration / 1000);
        setTimeRemaining(expirationTime);
      }
    } catch (err: any) {
      console.error('Erro ao gerar novo QR Code:', err);
      setError(err.message || 'Erro ao gerar novo QR Code');
    } finally {
      setLoading(false);
    }
  };

  const formatarTempo = (segundos: number) => {
    const mins = Math.floor(segundos / 60);
    const secs = segundos % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
        {/* Coluna Esquerda: QR Code e Código de Pareamento */}
        <div className="space-y-4">
          {loading && !connectionInfo ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded space-y-3">
              <p className="font-medium">Erro ao carregar informações de conexão</p>
              <p className="text-sm">{error}</p>
              <button
                onClick={carregarInformacoesConexao}
                disabled={loading}
                className="mt-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Tentando...' : 'Tentar Novamente'}
              </button>
            </div>
          ) : (
            <>
              {/* QR Code */}
              {(() => {
                // Processar QR code - pode vir em diferentes formatos
                let qrCodeBase64 = null;
                if (connectionInfo?.qrcode) {
                  if (typeof connectionInfo.qrcode === 'object' && connectionInfo.qrcode.base64) {
                    qrCodeBase64 = connectionInfo.qrcode.base64;
                  } else if (typeof connectionInfo.qrcode === 'string') {
                    qrCodeBase64 = connectionInfo.qrcode;
                  }
                }
                
                // Limpar o base64 removendo prefixos duplicados
                if (qrCodeBase64) {
                  qrCodeBase64 = qrCodeBase64.replace(/^data:image\/[^;]+;base64,/, '');
                }
                
                return qrCodeBase64 ? (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="bg-white p-4 rounded-lg border-2 border-gray-200 w-fit">
                      <img
                        src={`data:image/png;base64,${qrCodeBase64}`}
                        alt="QR Code"
                        className="w-80 h-80"
                        onError={(e) => {
                          console.error('Erro ao carregar QR code:', e);
                          console.error('Base64 que causou erro:', qrCodeBase64?.substring(0, 100));
                        }}
                      />
                    </div>

                  {/* Botão Gerar Novamente */}
                  <button
                    onClick={handleGerarNovamente}
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
                    <span className="text-sm font-medium">Gerar Novamente</span>
                  </button>

                  {/* Timer de Expiração */}
                  {timeRemaining > 0 && (
                    <div className="w-full">
                      <div className="flex items-center justify-center gap-2 text-sm text-green-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Expira em {formatarTempo(timeRemaining)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1 mt-2">
                        <div
                          className="bg-green-600 h-1 rounded-full transition-all duration-1000"
                          style={{
                            width: `${(timeRemaining / 60) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                ) : (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="text-center py-8 text-gray-500">
                      Carregando QR Code...
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>

        {/* Coluna Direita: Instruções */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Como conectar</h3>
          
          <div className="space-y-4">
            {/* Passo 1 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                  1
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">Abra o WhatsApp no seu celular</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Certifique-se de que você está usando a versão mais recente do aplicativo.
                </p>
              </div>
            </div>

            {/* Passo 2 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                  2
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">Acesse as configurações</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Toque em Configurações → Dispositivos conectados
                </p>
              </div>
            </div>

            {/* Passo 3 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                  3
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">Escolha um método de conexão</h4>
                <div className="text-sm text-gray-600 mt-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    <span>Toque em Conectar um dispositivo e escaneie o QR Code</span>
                  </div>
                  <div className="text-center font-medium">OU</div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span>Toque em Conectar um dispositivo e digite o código de pareamento</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Passo 4 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                  4
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">Aguarde a Conexão</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Após escanear o QR Code ou inserir o código, aguarde a confirmação da conexão.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

