'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useMensagensPorCliente, useClientesComConversas } from '@/hooks/useMensagensPorCliente';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Check } from 'lucide-react';
import { MensagemConversa } from '@/lib/api/mensagens';
import { getAtendimentoByCliente } from '@/lib/api/atendimentos';
import { getAgendamentoByCliente } from '@/lib/api/agendamentos';
import { useUsuario } from '@/hooks/useUsuario';
import { useAuth } from '@/hooks/useAuth';
import { AtendimentoSidebar } from '@/app/(private)/atendimento/components/AtendimentoSidebar';
import { supabase } from '@/lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface MensagemExibicao {
  id: string;
  conteudo: string;
  isCliente: boolean;
  created_at: string;
}

export default function MensagensPage() {
  const [clienteSelecionado, setClienteSelecionado] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [atendimentoId, setAtendimentoId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hasAtendimento, setHasAtendimento] = useState(false);
  const [hasAgendamento, setHasAgendamento] = useState(false);
  const { clientes, loading: loadingClientes } = useClientesComConversas();
  const { mensagens, loading: loadingMensagens } = useMensagensPorCliente(clienteSelecionado);
  const { usuario } = useUsuario();
  const { user } = useAuth();
  const [clientesComAtendimento, setClientesComAtendimento] = useState<Set<string>>(new Set());
  const [clientesAgendamentoStatus, setClientesAgendamentoStatus] = useState<Map<string, string>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const loadClientesComAtendimentoRef = useRef<(() => Promise<void>) | undefined>(undefined);

  // Converter mensagens para formato de exibição
  const mensagensExibicao: MensagemExibicao[] = useMemo(() => {
    if (!mensagens || mensagens.length === 0) return [];

    const mensagensFormatadas: MensagemExibicao[] = mensagens.map(mensagem => {
      const remetenteRaw = mensagem.remetente?.toLowerCase() || '';
      const isCliente = remetenteRaw.includes('cliente') || remetenteRaw === 'cliente';
      const dataMensagem = mensagem.data_e_hora || mensagem.created_at || '';

      return {
        id: mensagem.id || `${mensagem.cliente_id}-${dataMensagem}`,
        conteudo: mensagem.mensagem,
        isCliente,
        created_at: dataMensagem,
      };
    });

    // Ordenar por data
    return mensagensFormatadas.sort((a, b) => {
      const dataA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dataB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dataA - dataB;
    });
  }, [mensagens]);

  // Filtrar clientes por termo de busca
  const clientesFiltrados = clientes.filter(cliente =>
    cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.telefone.includes(searchTerm)
  );

  // Formatar hora da mensagem (formato 24h: 17:47)
  const formatarHora = (data: string) => {
    try {
      return format(new Date(data), 'HH:mm', { locale: ptBR });
    } catch {
      return '';
    }
  };

  // Formatar data e hora da mensagem
  // Se for do mesmo dia: apenas hora (17:47)
  // Se for de outro dia: data e hora (27/01/2025 17:47)
  const formatarDataHora = (data: string) => {
    try {
      const hoje = new Date();
      const dataMsg = new Date(data);
      
      // Resetar horas para comparar apenas as datas
      const hojeSemHora = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      const dataMsgSemHora = new Date(dataMsg.getFullYear(), dataMsg.getMonth(), dataMsg.getDate());
      
      const diffTime = hojeSemHora.getTime() - dataMsgSemHora.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        // Mesmo dia: apenas hora
        return format(dataMsg, 'HH:mm', { locale: ptBR });
      } else {
        // Outro dia: data e hora
        return format(dataMsg, 'dd/MM/yyyy HH:mm', { locale: ptBR });
      }
    } catch {
      return '';
    }
  };

  // Formatar data da mensagem (para lista de clientes)
  const formatarData = (data: string) => {
    try {
      return format(new Date(data), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return '';
    }
  };

  // Gerar cor consistente baseada no ID do cliente
  const getClienteColor = (clienteId: string): string => {
    // Hash simples do ID para gerar uma cor consistente
    let hash = 0;
    for (let i = 0; i < clienteId.length; i++) {
      hash = clienteId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Cores pré-definidas bonitas e contrastantes
    const colors = [
      '#8B5CF6', // purple-500
      '#EC4899', // pink-500
      '#EF4444', // red-500
      '#F59E0B', // amber-500
      '#10B981', // emerald-500
      '#3B82F6', // blue-500
      '#06B6D4', // cyan-500
      '#6366F1', // indigo-500
      '#F97316', // orange-500
      '#14B8A6', // teal-500
      '#A855F7', // purple-600
      '#D946EF', // fuchsia-500
      '#84CC16', // lime-500
      '#22C55E', // green-500
      '#0EA5E9', // sky-500
    ];
    
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Componente de Avatar reutilizável
  const ClienteAvatar = ({ clienteId, nome, fotoPerfil, tamanho = 'md' }: { 
    clienteId: string; 
    nome: string; 
    fotoPerfil?: string;
    tamanho?: 'sm' | 'md' | 'lg';
  }) => {
    const tamanhos = {
      sm: 'w-8 h-8 text-xs',
      md: 'w-10 h-10 text-sm',
      lg: 'w-12 h-12 text-lg',
    };
    
    const tamanhoClasse = tamanhos[tamanho];
    const cor = getClienteColor(clienteId);
    const inicial = nome.charAt(0).toUpperCase();

    if (fotoPerfil) {
      return (
        <img
          src={fotoPerfil}
          alt={nome}
          className={`${tamanhoClasse} rounded-full object-cover`}
        />
      );
    }

    return (
      <div 
        className={`${tamanhoClasse} rounded-full flex items-center justify-center text-white font-semibold`}
        style={{ backgroundColor: cor }}
      >
        {inicial}
      </div>
    );
  };

  const clienteAtual = clientes.find(c => c.id === clienteSelecionado);

  // Função para carregar clientes com atendimento/agendamento
  const loadClientesComAtendimento = useCallback(async () => {
    if (!user?.id) {
      setClientesComAtendimento(new Set());
      setClientesAgendamentoStatus(new Map());
      return;
    }

    try {
      const clienteIds = new Set<string>();
      const agendamentoStatusMap = new Map<string, string>();
      
      if (usuario?.tipo_marcacao === 'agendamento') {
          const { data: agendamentos, error } = await supabase
            .from('agendamentos')
            .select('cliente_id, status, updated_at')
            .eq('usuario_id', user.id)
            .order('updated_at', { ascending: false });
          
          if (error) {
            console.error('Erro ao buscar agendamentos:', error);
            return;
          }
          
          if (agendamentos && agendamentos.length > 0) {
            // Agrupar por cliente_id e pegar o mais recente de cada um
            const agendamentosPorCliente = new Map<string, any>();
            
            agendamentos.forEach((a: any) => {
              if (a.cliente_id) {
                const existing = agendamentosPorCliente.get(a.cliente_id);
                const currentUpdatedAt = a.updated_at ? new Date(a.updated_at).getTime() : 0;
                const existingUpdatedAt = existing?.updated_at ? new Date(existing.updated_at).getTime() : 0;
                
                if (!existing || currentUpdatedAt > existingUpdatedAt) {
                  agendamentosPorCliente.set(a.cliente_id, a);
                }
              }
            });
            
            agendamentosPorCliente.forEach((a: any, clienteId: string) => {
              clienteIds.add(clienteId);
              // Mapear status: 'agendado' -> 'Agendado', 'confirmado' -> 'Agendado', 'concluido' -> 'Realizado', 'cancelado' -> 'Cancelado'
              let statusDisplay = 'Agendado';
              const statusLower = String(a.status || '').toLowerCase().trim();
              
              if (statusLower === 'concluido' || statusLower === 'realizado') {
                statusDisplay = 'Realizado';
              } else if (statusLower === 'cancelado') {
                statusDisplay = 'Cancelado';
              } else if (statusLower === 'agendado' || statusLower === 'confirmado') {
                statusDisplay = 'Agendado';
              }
              
              agendamentoStatusMap.set(clienteId, statusDisplay);
            });
          }
      } else {
        const { getConnectedInstances } = await import('@/lib/api/whatsapp');
        const connectedInstances = await getConnectedInstances(user.id);
        const instanceIds = connectedInstances.map(inst => inst.id);
        
        if (instanceIds.length > 0) {
          const { data: atendimentos } = await supabase
            .from('atendimentos_solicitado')
            .select('cliente_id')
            .eq('usuario_id', user.id)
            .in('whatsapp_instance_id', instanceIds);
          
          if (atendimentos) {
            atendimentos.forEach((a: any) => {
              if (a.cliente_id) clienteIds.add(a.cliente_id);
            });
          }
        }
      }
      
      setClientesComAtendimento(clienteIds);
      setClientesAgendamentoStatus(agendamentoStatusMap);
    } catch (error) {
      console.error('Erro ao carregar clientes com atendimento:', error);
    }
  }, [user?.id, usuario?.tipo_marcacao]);

  // Atualizar ref quando a função mudar
  useEffect(() => {
    loadClientesComAtendimentoRef.current = loadClientesComAtendimento;
  }, [loadClientesComAtendimento]);

  // Buscar todos os atendimentos/agendamentos para mapear quais clientes têm
  useEffect(() => {
    if (!user?.id || !usuario?.tipo_marcacao) {
      setClientesComAtendimento(new Set());
      setClientesAgendamentoStatus(new Map());
      return;
    }

    let isMounted = true;

    // Limpar subscription anterior se existir
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Carregar dados iniciais
    loadClientesComAtendimento();

    // Configurar subscription realtime para atualizar quando houver mudanças
    // Usar nome estável do canal para evitar múltiplas subscriptions
    const channelName = usuario.tipo_marcacao === 'agendamento' 
      ? `mensagens-agendamentos-status:${user.id}`
      : `mensagens-atendimentos-status:${user.id}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: usuario.tipo_marcacao === 'agendamento' ? 'agendamentos' : 'atendimentos_solicitado',
          filter: `usuario_id=eq.${user.id}`,
        },
        (payload) => {
          if (!isMounted) return;
          // Usar ref para evitar dependência circular
          if (loadClientesComAtendimentoRef.current) {
            loadClientesComAtendimentoRef.current();
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscrito ao realtime de ${usuario.tipo_marcacao === 'agendamento' ? 'agendamentos' : 'atendimentos'} na página de mensagens`);
        }
      });

    channelRef.current = channel;

    return () => {
      isMounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, usuario?.tipo_marcacao]);

  // Verificar se o cliente selecionado tem atendimento ou agendamento
  useEffect(() => {
    async function checkAtendimentoAgendamento() {
      if (!clienteSelecionado || !user?.id) {
        setHasAtendimento(false);
        setHasAgendamento(false);
        setAtendimentoId(null);
        return;
      }

      try {
        if (usuario?.tipo_marcacao === 'agendamento') {
          const agendamento = await getAgendamentoByCliente(clienteSelecionado, user.id);
          setHasAgendamento(!!agendamento);
          setHasAtendimento(false);
          if (agendamento) {
            setAtendimentoId(agendamento.id);
          } else {
            setAtendimentoId(null);
          }
        } else {
          const atendimento = await getAtendimentoByCliente(clienteSelecionado, user.id);
          setHasAtendimento(!!atendimento);
          setHasAgendamento(false);
          if (atendimento) {
            setAtendimentoId(atendimento.id);
          } else {
            setAtendimentoId(null);
          }
        }
      } catch (error) {
        console.error('Erro ao verificar atendimento/agendamento:', error);
        setHasAtendimento(false);
        setHasAgendamento(false);
        setAtendimentoId(null);
      }
    }

    checkAtendimentoAgendamento();
  }, [clienteSelecionado, user?.id, usuario?.tipo_marcacao]);

  const handleOpenDetalhes = () => {
    if (atendimentoId) {
      setIsSidebarOpen(true);
    }
  };

  return (
    <div className="flex h-full w-full bg-[#E8F4F8] overflow-hidden -m-8 min-h-0">
      {/* Lista de Conversas - Esquerda */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col pl-4">
        {/* Barra de Busca */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 h-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent w-full"
            />
            <svg className="absolute left-3 top-3 w-5 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>


        {/* Lista de Clientes */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {loadingClientes ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
              Nenhuma conversa encontrada
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {clientesFiltrados.map((cliente) => {
                const isSelected = clienteSelecionado === cliente.id;
                return (
                  <div
                    key={cliente.id}
                    onClick={() => setClienteSelecionado(cliente.id)}
                    className={`px-4 py-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-gray-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        <ClienteAvatar 
                          clienteId={cliente.id}
                          nome={cliente.nome}
                          fotoPerfil={cliente.foto_perfil}
                          tamanho="lg"
                        />
                      </div>

                      {/* Informações */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">
                            {cliente.nome}
                          </h3>
                          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                            {clientesComAtendimento.has(cliente.id) && (
                              <span className={`px-1.5 py-0.5 text-xs font-medium rounded-md ${
                                usuario?.tipo_marcacao === 'agendamento' 
                                  ? (() => {
                                      const status = clientesAgendamentoStatus.get(cliente.id);
                                      if (status === 'Realizado') {
                                        return 'bg-green-100 text-green-700';
                                      } else if (status === 'Cancelado') {
                                        return 'bg-red-100 text-red-700';
                                      } else {
                                        return 'bg-blue-100 text-blue-700';
                                      }
                                    })()
                                  : 'bg-primary-100 text-primary-700'
                              }`}>
                                {usuario?.tipo_marcacao === 'agendamento' 
                                  ? (clientesAgendamentoStatus.get(cliente.id) || 'Agendado')
                                  : 'Atendimento'}
                              </span>
                            )}
                            {cliente.ultima_mensagem_at && (
                              <span className="text-xs text-gray-500">
                                {formatarHora(cliente.ultima_mensagem_at)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-600 truncate flex-1">
                            {cliente.ultima_mensagem || 'Nenhuma mensagem'}
                          </p>
                          {cliente.remetente_ultima_mensagem === 'usuario' && (
                            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Área de Chat - Direita */}
      <div className="flex-1 flex flex-col bg-white">
        {clienteSelecionado && clienteAtual ? (
          <>
            {/* Header do Chat */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ClienteAvatar 
                  clienteId={clienteAtual.id}
                  nome={clienteAtual.nome}
                  fotoPerfil={clienteAtual.foto_perfil}
                  tamanho="md"
                />
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{clienteAtual.nome}</h3>
                  {clienteAtual.ultima_mensagem_at && (
                    <p className="text-xs text-gray-400">
                      Última mensagem: {formatarHora(clienteAtual.ultima_mensagem_at)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {(hasAtendimento || hasAgendamento) && (
                  <span className={`px-2 py-1 text-xs font-medium rounded-md ${
                    usuario?.tipo_marcacao === 'agendamento' 
                      ? (() => {
                          const status = clientesAgendamentoStatus.get(clienteAtual.id);
                          if (status === 'Realizado') {
                            return 'bg-green-100 text-green-700';
                          } else if (status === 'Cancelado') {
                            return 'bg-red-100 text-red-700';
                          } else {
                            return 'bg-blue-100 text-blue-700';
                          }
                        })()
                      : 'bg-primary-100 text-primary-700'
                  }`}>
                    {usuario?.tipo_marcacao === 'agendamento' 
                      ? (clientesAgendamentoStatus.get(clienteAtual.id) || 'Agendado')
                      : 'Atendimento'}
                  </span>
                )}
                <button 
                  onClick={handleOpenDetalhes}
                  disabled={!atendimentoId}
                  className={`text-gray-600 hover:text-gray-900 ${!atendimentoId ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Área de Mensagens */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scrollbar-hide">
              {loadingMensagens ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : mensagensExibicao.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Nenhuma mensagem ainda
                </div>
              ) : (
                 mensagensExibicao.map((mensagem) => {
                   return (
                     <div
                       key={mensagem.id}
                       className={`flex ${mensagem.isCliente ? 'justify-start' : 'justify-end'}`}
                     >
                       <div className={`max-w-[70%] flex items-end gap-2 ${mensagem.isCliente ? 'flex-row' : 'flex-row-reverse'}`}>
                         <div
                           className={`rounded-2xl px-4 py-2 ${
                             mensagem.isCliente
                               ? 'bg-gray-800 text-white'
                               : 'bg-gray-100 text-gray-900'
                           }`}
                         >
                           <p className="text-sm whitespace-pre-wrap break-words">
                             {mensagem.conteudo}
                           </p>
                         </div>
                         <p className={`text-xs text-gray-500 pb-1 ${mensagem.isCliente ? 'text-left' : 'text-right'}`}>
                           {formatarDataHora(mensagem.created_at)}
                         </p>
                       </div>
                     </div>
                   );
                 })
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-lg font-medium">Selecione uma conversa</p>
              <p className="text-sm mt-2">Escolha um cliente da lista para ver as mensagens</p>
            </div>
          </div>
        )}
      </div>
      <AtendimentoSidebar
        atendimentoId={atendimentoId}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
    </div>
  );
}

