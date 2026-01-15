'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUsuario } from '@/hooks/useUsuario';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { WhatsAppConnectionModal } from '@/components/whatsapp/WhatsAppConnectionModal';
import { verificarStatusConexaoSupabase, sincronizarStatusInstancia, getWhatsAppInstanceByInstanceName, getInstanceNameByUsuario } from '@/lib/api/whatsapp';
import { fazerLogoutInstancia } from '@/lib/api/evolution';
import { atualizarNomeUsuario } from '@/lib/api/usuarios';
import { CalendarIcon, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const { usuario, refetch } = useUsuario();
  const [nome, setNome] = useState('');
  const [isEditingNome, setIsEditingNome] = useState(false);
  const [loadingNome, setLoadingNome] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<'conectado' | 'desconectado' | 'conectando' | 'erro'>('desconectado');
  const [telefoneConectado, setTelefoneConectado] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [mostrarModalWhatsApp, setMostrarModalWhatsApp] = useState(false);
  const [mostrarModalDesconectar, setMostrarModalDesconectar] = useState(false);
  const [desconectando, setDesconectando] = useState(false);

  // Inicializar nome quando usuario carregar
  useEffect(() => {
    if (usuario?.nome) {
      setNome(usuario.nome);
    }
  }, [usuario?.nome]);

  // Buscar instanceName da tabela whatsapp_instances
  const [instanceName, setInstanceName] = useState<string>('');
  const telefoneUsuario = usuario?.telefone_ia || null;

  useEffect(() => {
    async function loadInstanceName() {
      if (!user?.id) {
        setInstanceName('');
        return;
      }

      try {
        const instanceNameFromDb = await getInstanceNameByUsuario(user.id);
        setInstanceName(instanceNameFromDb || '');
      } catch (error) {
        console.error('Erro ao buscar instance_name:', error);
        setInstanceName('');
      }
    }

    loadInstanceName();
  }, [user?.id]);

  // Verificar status WhatsApp
  useEffect(() => {
    if (!instanceName || !telefoneUsuario) {
      setLoadingStatus(false);
      setWhatsappStatus('desconectado');
      setTelefoneConectado(null);
      return;
    }

    const verificarStatus = async () => {
      try {
        setLoadingStatus(true);
        const instance = await getWhatsAppInstanceByInstanceName(instanceName);
        
        if (instance) {
          setWhatsappStatus(instance.status);
          // Só definir telefone conectado se o status for "conectado"
          if (instance.status === 'conectado') {
            setTelefoneConectado(instance.telefone);
          } else {
            setTelefoneConectado(null);
          }
        } else {
          setWhatsappStatus('desconectado');
          setTelefoneConectado(null);
        }
      } catch (error) {
        console.error('Erro ao verificar status WhatsApp:', error);
        setWhatsappStatus('erro');
        setTelefoneConectado(null);
      } finally {
        setLoadingStatus(false);
      }
    };

    verificarStatus();

    // Verificar a cada 30 segundos
    const interval = setInterval(verificarStatus, 30000);
    return () => clearInterval(interval);
  }, [instanceName, telefoneUsuario]);

  const handleSalvarNome = async () => {
    if (!nome.trim() || nome.trim() === usuario?.nome) {
      setIsEditingNome(false);
      return;
    }

    setLoadingNome(true);
    try {
      await atualizarNomeUsuario(nome.trim());
      await refetch();
      setIsEditingNome(false);
    } catch (error) {
      console.error('Erro ao atualizar nome:', error);
      alert('Erro ao atualizar nome. Tente novamente.');
    } finally {
      setLoadingNome(false);
    }
  };

  const handleCancelarEdicaoNome = () => {
    setNome(usuario?.nome || '');
    setIsEditingNome(false);
  };

  const getUserInitials = () => {
    if (usuario?.nome) {
      const nomes = usuario.nome.trim().split(/\s+/);
      const primeiraLetra = nomes[0].charAt(0).toUpperCase();
      return primeiraLetra;
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  const formatarTelefoneExibicao = (telefone: string | null) => {
    if (!telefone) {
      return null;
    }

    // Remove tudo que não é número
    const numeros = telefone.replace(/\D/g, '');
    
    // Formata como (99) 99999-9999
    if (numeros.length === 11) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
    } else if (numeros.length === 10) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
    }
    
    return telefone;
  };

  const getStatusWhatsAppLabel = () => {
    switch (whatsappStatus) {
      case 'conectado':
        return 'Conectado';
      case 'conectando':
        return 'Conectando...';
      case 'desconectado':
        return 'Desconectado';
      case 'erro':
        return 'Erro';
      default:
        return 'Desconectado';
    }
  };

  const getStatusWhatsAppColor = () => {
    switch (whatsappStatus) {
      case 'conectado':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'conectando':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'desconectado':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'erro':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const handleDesconectar = async () => {
    if (!instanceName || !telefoneUsuario || !user?.id) {
      return;
    }

    setDesconectando(true);
    try {
      // Fazer logout na Evolution API
      const logoutSuccess = await fazerLogoutInstancia(instanceName);
      
      if (logoutSuccess) {
        // Atualizar status no Supabase
        await sincronizarStatusInstancia(instanceName, telefoneUsuario, 'desconectado', user.id);
        
        // Atualizar status local - recarregar do Supabase para garantir consistência
        setTimeout(async () => {
          if (instanceName) {
            try {
              const instance = await getWhatsAppInstanceByInstanceName(instanceName);
              if (instance) {
                setWhatsappStatus(instance.status);
                if (instance.status === 'conectado') {
                  setTelefoneConectado(instance.telefone);
                } else {
                  setTelefoneConectado(null);
                }
              } else {
                setWhatsappStatus('desconectado');
                setTelefoneConectado(null);
              }
            } catch (error) {
              console.error('Erro ao recarregar status após desconexão:', error);
              setWhatsappStatus('desconectado');
              setTelefoneConectado(null);
            }
          }
        }, 1000);
        setMostrarModalDesconectar(false);
      } else {
        alert('Erro ao desconectar. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      alert('Erro ao desconectar. Tente novamente.');
    } finally {
      setDesconectando(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-600 mt-2">Gerencie suas informações pessoais e conexões</p>
      </div>

      {/* Perfil */}
      <Card title="Perfil" className="w-full">
        <div className="space-y-6">
          {/* Foto e Nome */}
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              <div className="w-24 h-24 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold text-3xl shadow-md">
                {getUserInitials()}
              </div>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                {isEditingNome ? (
                  <div className="space-y-2">
                    <Input
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Digite seu nome"
                      disabled={loadingNome}
                      className="max-w-lg"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSalvarNome}
                        disabled={loadingNome || !nome.trim()}
                        size="sm"
                      >
                        {loadingNome ? 'Salvando...' : 'Salvar'}
                      </Button>
                      <Button
                        onClick={handleCancelarEdicaoNome}
                        disabled={loadingNome}
                        variant="secondary"
                        size="sm"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <p className="text-gray-900 font-semibold text-xl">{usuario?.nome || 'Não informado'}</p>
                      <Button
                        onClick={() => setIsEditingNome(true)}
                        variant="ghost"
                        size="sm"
                      >
                        Editar
                      </Button>
                    </div>
                    {usuario?.telefone_ia && (
                      <p className="text-base text-gray-600">
                        {formatarTelefoneExibicao(usuario.telefone_ia)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* E-mail */}
          <div>
            <p className="text-gray-900">{user?.email || 'Não informado'}</p>
            <p className="text-xs text-gray-500 mt-1">O e-mail não pode ser alterado</p>
          </div>
        </div>
      </Card>

      {/* Integrações */}
      <Card title="Integrações" className="w-full">
        <div className="space-y-6">
          {/* Conexão WhatsApp */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">WhatsApp</p>
                  {whatsappStatus === 'conectado' && telefoneConectado && (
                    <p className="text-xs text-gray-600 mt-1">
                      Telefone conectado: {formatarTelefoneExibicao(telefoneConectado)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {loadingStatus ? (
                  <p className="text-xs text-gray-500">Verificando...</p>
                ) : (
                  <div className="flex items-center gap-2">
                    {whatsappStatus === 'conectado' && (
                      <button
                        onClick={() => setMostrarModalDesconectar(true)}
                        className="text-red-600 hover:text-red-700 transition-colors p-1 rounded-md hover:bg-red-50"
                        title="Desconectar número"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border ${getStatusWhatsAppColor()}`}>
                      {getStatusWhatsAppLabel()}
                    </span>
                  </div>
                )}
                {!loadingStatus && whatsappStatus !== 'conectado' && instanceName && (
                  <Button
                    onClick={() => setMostrarModalWhatsApp(true)}
                    variant="primary"
                    size="sm"
                  >
                    Conectar
                  </Button>
                )}
              </div>
            </div>
            {!telefoneUsuario && (
              <p className="text-sm text-gray-500">
                Configure seu telefone nas configurações iniciais para conectar o WhatsApp.
              </p>
            )}
          </div>

          {/* Divisor */}
          <div className="border-t border-gray-200"></div>

          {/* Conexão Google Calendar */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                  <CalendarIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Google Calendar</p>
                  <p className="text-xs text-gray-500">Sincronização de Agendamentos</p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled
              >
                Conectar Google
              </Button>
            </div>
            <p className="text-sm text-gray-500 italic">
              Funcionalidade em desenvolvimento
            </p>
          </div>
        </div>
      </Card>

      {/* Modal WhatsApp */}
      {instanceName && telefoneUsuario && (
        <WhatsAppConnectionModal
          isOpen={mostrarModalWhatsApp}
          onClose={() => {
            setMostrarModalWhatsApp(false);
            // Recarregar status após fechar o modal
            setTimeout(async () => {
              if (instanceName) {
                try {
                  const instance = await getWhatsAppInstanceByInstanceName(instanceName);
                  if (instance) {
                    setWhatsappStatus(instance.status);
                    if (instance.status === 'conectado') {
                      setTelefoneConectado(instance.telefone);
                    } else {
                      setTelefoneConectado(null);
                    }
                  } else {
                    setWhatsappStatus('desconectado');
                    setTelefoneConectado(null);
                  }
                } catch (error) {
                  console.error('Erro ao recarregar status:', error);
                }
              }
            }, 2000);
          }}
          instanceName={instanceName}
          telefone={telefoneUsuario}
        />
      )}

      {/* Modal de Confirmação de Desconexão */}
      <Modal
        isOpen={mostrarModalDesconectar}
        onClose={() => !desconectando && setMostrarModalDesconectar(false)}
        title="Desconectar WhatsApp"
        closeOnClickOutside={!desconectando}
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Tem certeza que deseja desconectar o número do WhatsApp?
          </p>
          <p className="text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            Após a desconexão, o sistema ficará impossibilitado de receber seus atendimentos.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              onClick={() => setMostrarModalDesconectar(false)}
              variant="secondary"
              disabled={desconectando}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDesconectar}
              variant="danger"
              disabled={desconectando}
            >
              {desconectando ? 'Desconectando...' : 'Sim, Desconectar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

