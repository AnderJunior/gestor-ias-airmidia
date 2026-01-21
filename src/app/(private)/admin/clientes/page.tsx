'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminClientes } from '@/hooks/useAdminClientes';
import { getWhatsAppInstances } from '@/lib/api/whatsapp';
import { Usuario } from '@/lib/api/usuarios';
import { WhatsAppInstance } from '@/types/domain';
import { Pagination } from '@/components/ui/Pagination';
import { CriarClienteModal } from '@/components/admin/CriarClienteModal';
import { CredenciaisPopup } from '@/components/admin/CredenciaisPopup';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Plus, Trash2, List, LayoutGrid, X, Check } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import {
  fetchKanbanColunas,
  createKanbanColuna,
  updateKanbanColuna,
  deleteKanbanColuna,
} from '@/lib/api/kanbanColunas';
import { ClienteActionsMenu } from '@/components/admin/ClienteActionsMenu';
import { ColunaActionsMenu } from '@/components/admin/ColunaActionsMenu';
import { EditarNomeInstanciaModal } from '@/components/admin/EditarNomeInstanciaModal';
import { EditarClienteModal } from '@/components/admin/EditarClienteModal';
import { getContagemTarefasPendentesPorClientes } from '@/lib/api/tarefas';

interface ClienteComStatus extends Usuario {
  statusEvolution?: 'conectado' | 'desconectado' | 'conectando' | 'erro';
  instancias?: WhatsAppInstance[];
}

const ITEMS_PER_PAGE = 6;

export default function AdminClientesPage() {
  const router = useRouter();
  const { clientes, loading, refetch } = useAdminClientes();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [clientesComStatus, setClientesComStatus] = useState<ClienteComStatus[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [showAtivarModal, setShowAtivarModal] = useState(false);
  const [clienteParaExcluir, setClienteParaExcluir] = useState<ClienteComStatus | null>(null);
  const [nomeConfirmacao, setNomeConfirmacao] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [activating, setActivating] = useState(false);
  const [showEditInstanceModal, setShowEditInstanceModal] = useState(false);
  const [showEditClienteModal, setShowEditClienteModal] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteComStatus | null>(null);
  const [instanciaSelecionada, setInstanciaSelecionada] = useState<WhatsAppInstance | null>(null);
  const [showCredenciaisPopup, setShowCredenciaisPopup] = useState(false);
  const [credenciaisData, setCredenciaisData] = useState<{
    email: string;
    senha: string;
    tipoCliente: 'atendimento' | 'agendamento';
  } | null>(null);
  const [viewMode, setViewMode] = useState<'lista' | 'kanban'>('lista');
  const [kanbanColumns, setKanbanColumns] = useState<
    Array<{ id: string; name: string; color?: string; ordem?: number }>
  >([]);
  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnColor, setNewColumnColor] = useState('#6b7280');
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);
  const [faseParaNovoCliente, setFaseParaNovoCliente] = useState<string | undefined>(undefined);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editColumnName, setEditColumnName] = useState('');
  const [editColumnColor, setEditColumnColor] = useState('#6b7280');
  const kanbanScrollRef = useRef<HTMLDivElement>(null);
  const scrollAnimationRef = useRef<number | null>(null);
  const lastScrollTimeRef = useRef<number>(0);
  const scrollDirectionRef = useRef<'left' | 'right' | null>(null);
  const [tarefasPendentesPorCliente, setTarefasPendentesPorCliente] = useState<Record<string, number>>({});

  // Carregar colunas do Kanban do Supabase
  useEffect(() => {
    let cancelled = false;
    fetchKanbanColunas()
      .then((colunas) => {
        if (!cancelled) setKanbanColumns(colunas);
      })
      .catch((err) => {
        if (!cancelled) console.error('Erro ao carregar colunas do Kanban:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Buscar status de conexão para cada cliente
  useEffect(() => {
    async function loadStatus() {
      if (!clientes.length) {
        setClientesComStatus([]);
        setLoadingStatus(false);
        return;
      }

      setLoadingStatus(true);
      const clientesComStatusData: ClienteComStatus[] = await Promise.all(
        clientes.map(async (cliente) => {
          try {
            const instancias = await getWhatsAppInstances(cliente.id);
            const statusEvolution = instancias.length > 0 
              ? instancias[0].status 
              : 'desconectado';
            
            return {
              ...cliente,
              statusEvolution,
              instancias,
            };
          } catch (error) {
            console.error(`Erro ao buscar status para cliente ${cliente.id}:`, error);
            return {
              ...cliente,
              statusEvolution: 'desconectado' as const,
              instancias: [],
            };
          }
        })
      );

      setClientesComStatus(clientesComStatusData);
      setLoadingStatus(false);

      // Buscar contagens de tarefas pendentes
      try {
        const clienteIds = clientesComStatusData.map((c) => c.id);
        const contagens = await getContagemTarefasPendentesPorClientes(clienteIds);
        setTarefasPendentesPorCliente(contagens);
      } catch (error) {
        console.error('Erro ao buscar contagens de tarefas pendentes:', error);
        setTarefasPendentesPorCliente({});
      }
    }

    if (!loading) {
      loadStatus();
    }
  }, [clientes, loading]);

  // Filtrar clientes por termo de busca
  const clientesFiltrados = useMemo(() => {
    if (!searchTerm) return clientesComStatus;
    
    const termo = searchTerm.toLowerCase();
    return clientesComStatus.filter(cliente =>
      cliente.nome?.toLowerCase().includes(termo) ||
      cliente.telefone_ia?.includes(termo)
    );
  }, [clientesComStatus, searchTerm]);

  // Calcular paginação
  const totalPages = Math.ceil(clientesFiltrados.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentItems = clientesFiltrados.slice(startIndex, endIndex);

  // Resetar página quando o termo de busca mudar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Formatar telefone para exibição
  const formatarTelefone = (telefone: string | null) => {
    if (!telefone) return '-';
    const numeros = telefone.replace(/\D/g, '');
    if (numeros.length === 11) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
    } else if (numeros.length === 10) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
    }
    return telefone;
  };

  // Formatar status de conexão
  const formatarStatusConexao = (status?: string) => {
    switch (status) {
      case 'conectado':
        return { texto: 'Conectado', cor: 'text-green-600 bg-green-50' };
      case 'conectando':
        return { texto: 'Conectando', cor: 'text-yellow-600 bg-yellow-50' };
      case 'erro':
        return { texto: 'Erro', cor: 'text-red-600 bg-red-50' };
      default:
        return { texto: 'Desconectado', cor: 'text-gray-600 bg-gray-50' };
    }
  };

  // Formatar tipo de marcação
  const formatarTipoMarcacao = (tipo?: string) => {
    switch (tipo) {
      case 'atendimento':
        return 'Atendimento';
      case 'agendamento':
        return 'Agendamento';
      default:
        return 'Não definido';
    }
  };

  // Função auxiliar para converter cor hex em rgba com opacidade
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Formatar fase - busca o nome da coluna do Kanban se existir
  const formatarFase = (fase?: string) => {
    if (!fase) {
      return { texto: 'Não definido', cor: 'text-gray-600 bg-gray-50', corHex: null };
    }

    // Casos legados de compatibilidade
    switch (fase) {
      case 'teste':
        return { texto: 'Teste', cor: 'text-yellow-600 bg-yellow-50', corHex: null };
      case 'producao':
        return { texto: 'Publicado', cor: 'text-green-600 bg-green-50', corHex: null };
    }

    // Buscar nome da coluna do Kanban
    const coluna = kanbanColumns.find((col) => col.id === fase);
    if (coluna) {
      return { 
        texto: coluna.name, 
        cor: '', // Não usar classes Tailwind quando temos cor customizada
        corHex: coluna.color || '#6b7280' 
      };
    }

    // Se não encontrou, retorna "Não definido"
    return { texto: 'Não definido', cor: 'text-gray-600 bg-gray-50', corHex: null };
  };

  // Formatar status (ativo/inativo)
  const formatarStatus = (ativo?: boolean) => {
    if (ativo === true || ativo === undefined) {
      return { texto: 'Ativo', cor: 'text-green-600 bg-green-50' };
    } else {
      return { texto: 'Inativo', cor: 'text-red-600 bg-red-50' };
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getAvatarColor = (name?: string | null) => {
    if (!name) return 'bg-gray-400';
    const colors = [
      'bg-red-400',
      'bg-blue-400',
      'bg-green-400',
      'bg-yellow-400',
      'bg-purple-400',
      'bg-pink-400',
      'bg-indigo-400',
      'bg-orange-400',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const handleDeleteClick = (e: React.MouseEvent, cliente: ClienteComStatus) => {
    e.stopPropagation();
    setClienteParaExcluir(cliente);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    // Abrir modal de confirmação com nome
    setShowDeleteModal(false);
    setShowConfirmDeleteModal(true);
    setNomeConfirmacao('');
  };

  const handleFinalDelete = async () => {
    if (!clienteParaExcluir) return;

    // Verificar se o nome está correto
    if (nomeConfirmacao.trim() !== clienteParaExcluir.nome?.trim()) {
      return;
    }

    setDeleting(true);
    try {
      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(`/api/admin/excluir-cliente?id=${clienteParaExcluir.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao excluir cliente');
      }

      // Fechar modais e atualizar lista
      setShowConfirmDeleteModal(false);
      setShowDeleteModal(false);
      setClienteParaExcluir(null);
      setNomeConfirmacao('');
      refetch();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir cliente. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelConfirmDelete = () => {
    setShowConfirmDeleteModal(false);
    setNomeConfirmacao('');
    // Voltar para o modal anterior
    setShowDeleteModal(true);
  };

  const handleDesativar = async () => {
    if (!clienteParaExcluir) return;

    setDeactivating(true);
    try {
      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const response = await fetch('/api/admin/desativar-cliente', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          clienteId: clienteParaExcluir.id,
          ativo: false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao desativar cliente');
      }

      // Fechar modal e atualizar lista
      setShowDeleteModal(false);
      setClienteParaExcluir(null);
      refetch();
    } catch (err: any) {
      alert(err.message || 'Erro ao desativar cliente. Tente novamente.');
    } finally {
      setDeactivating(false);
    }
  };

  const handleAtivar = async () => {
    if (!clienteParaExcluir) return;

    setActivating(true);
    try {
      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const response = await fetch('/api/admin/desativar-cliente', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          clienteId: clienteParaExcluir.id,
          ativo: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao ativar cliente');
      }

      // Fechar modal e atualizar lista
      setShowAtivarModal(false);
      setClienteParaExcluir(null);
      refetch();
    } catch (err: any) {
      alert(err.message || 'Erro ao ativar cliente. Tente novamente.');
    } finally {
      setActivating(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setShowConfirmDeleteModal(false);
    setClienteParaExcluir(null);
    setNomeConfirmacao('');
  };

  const handleEditInstance = (cliente: ClienteComStatus) => {
    const instancia = cliente.instancias && cliente.instancias.length > 0 
      ? cliente.instancias[0] 
      : null;
    
    if (!instancia) {
      alert('Este cliente não possui instância WhatsApp cadastrada.');
      return;
    }

    setInstanciaSelecionada(instancia);
    setShowEditInstanceModal(true);
  };

  const handleEditCliente = (cliente: ClienteComStatus) => {
    setClienteSelecionado(cliente);
    setShowEditClienteModal(true);
  };

  const handleDesativarCliente = (cliente: ClienteComStatus) => {
    // Se o cliente estiver inativo, mostrar modal de ativação
    if (cliente.ativo === false) {
      setClienteParaExcluir(cliente);
      setShowAtivarModal(true);
    } else {
      // Se estiver ativo, mostrar modal de desativar/excluir
      setClienteParaExcluir(cliente);
      setShowDeleteModal(true);
    }
  };


  const handleSuccessEdit = () => {
    refetch();
  };

  // Funções do Kanban
  const handleAddColumn = async () => {
    if (!newColumnName.trim()) return;

    const newColumnId = newColumnName.toLowerCase().replace(/\s+/g, '_');
    const name = newColumnName.trim();
    const color = newColumnColor;

    try {
      const nova = await createKanbanColuna(newColumnId, name, color);
      setKanbanColumns((prev) => [...prev, nova]);
      setNewColumnName('');
      setNewColumnColor('#6b7280');
      setIsAddingColumn(false);
    } catch (err: any) {
      alert(err?.message || 'Erro ao criar coluna. Tente novamente.');
    }
  };

  const handleCancelAddColumn = () => {
    setIsAddingColumn(false);
    setNewColumnName('');
    setNewColumnColor('#6b7280');
  };

  const handleSaveEditColumn = async () => {
    if (!editingColumnId || !editColumnName.trim()) return;

    const name = editColumnName.trim();
    const color = editColumnColor;

    try {
      await updateKanbanColuna(editingColumnId, name, color);
    } catch (err: any) {
      alert(err?.message || 'Erro ao atualizar coluna. Tente novamente.');
      return;
    }

    setKanbanColumns((prev) =>
      prev.map((c) =>
        c.id === editingColumnId ? { ...c, name, color } : c
      )
    );
    setEditingColumnId(null);
    setEditColumnName('');
    setEditColumnColor('#6b7280');
  };

  const handleCancelEditColumn = () => {
    setEditingColumnId(null);
    setEditColumnName('');
    setEditColumnColor('#6b7280');
  };

  const handleDeleteColumn = async (columnId: string) => {
    const clientesNaColuna = clientesFiltrados.filter((c) => c.fase === columnId);
    const restantes = kanbanColumns
      .filter((c) => c.id !== columnId)
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    const colunaDestino = restantes[0];

    // Não permite excluir a última coluna se ela tiver clientes
    if (clientesNaColuna.length > 0 && !colunaDestino) {
      alert(
        'Não é possível excluir a última coluna pois ela contém clientes. Crie outra coluna e mova os clientes primeiro.'
      );
      return;
    }

    if (clientesNaColuna.length > 0) {
      const confirmar = confirm(
        `Esta coluna contém ${clientesNaColuna.length} cliente(s). Eles serão movidos para a coluna "${colunaDestino.name}". Deseja continuar?`
      );
      if (!confirmar) return;

      setUpdatingFase(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Não autenticado');

        await Promise.all(
          clientesNaColuna.map(async (cliente) => {
            const res = await fetch('/api/admin/atualizar-fase-cliente', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ clienteId: cliente.id, fase: colunaDestino.id }),
            });
            if (!res.ok) {
              const d = await res.json();
              throw new Error(d.error || 'Erro ao mover cliente');
            }
          })
        );

        await deleteKanbanColuna(columnId);
        setKanbanColumns((prev) => prev.filter((col) => col.id !== columnId));
        refetch();
      } catch (err: any) {
        alert(err?.message || 'Erro ao deletar coluna. Tente novamente.');
        refetch();
      } finally {
        setUpdatingFase(false);
      }
    } else {
      try {
        await deleteKanbanColuna(columnId);
        setKanbanColumns((prev) => prev.filter((col) => col.id !== columnId));
      } catch (err: any) {
        alert(err?.message || 'Erro ao excluir coluna. Tente novamente.');
      }
    }
  };

  // Função para fazer auto-scroll durante o drag (otimizada)
  const handleAutoScroll = (e: React.DragEvent) => {
    if (!kanbanScrollRef.current || !draggedCard) {
      // Parar scroll se não há container ou card arrastado
      scrollDirectionRef.current = null;
      if (scrollAnimationRef.current !== null) {
        cancelAnimationFrame(scrollAnimationRef.current);
        scrollAnimationRef.current = null;
      }
      return;
    }

    // Throttle: só processar a cada ~16ms (60fps)
    const now = Date.now();
    if (now - lastScrollTimeRef.current < 16) {
      return;
    }
    lastScrollTimeRef.current = now;

    const container = kanbanScrollRef.current;
    const containerRect = container.getBoundingClientRect();
    const scrollThreshold = 150; // Distância das bordas para ativar scroll (em pixels)

    // Calcular direção do scroll baseado na posição do mouse
    let newDirection: 'left' | 'right' | null = null;
    
    if (e.clientX < containerRect.left + scrollThreshold && container.scrollLeft > 0) {
      newDirection = 'left';
    } else if (
      e.clientX > containerRect.right - scrollThreshold &&
      container.scrollLeft < container.scrollWidth - container.clientWidth
    ) {
      newDirection = 'right';
    }

    // Atualizar direção do scroll
    scrollDirectionRef.current = newDirection;

    // Iniciar animação se não estiver rodando e houver direção
    if (scrollAnimationRef.current === null && newDirection) {
      const scrollSpeed = 15; // Velocidade do scroll
      
      const animateScroll = () => {
        if (!kanbanScrollRef.current || !draggedCard || !scrollDirectionRef.current) {
          scrollAnimationRef.current = null;
          scrollDirectionRef.current = null;
          return;
        }

        const cont = kanbanScrollRef.current;
        const direction = scrollDirectionRef.current;

        if (direction === 'left') {
          if (cont.scrollLeft > 0) {
            cont.scrollLeft = Math.max(0, cont.scrollLeft - scrollSpeed);
            scrollAnimationRef.current = requestAnimationFrame(animateScroll);
          } else {
            scrollAnimationRef.current = null;
            scrollDirectionRef.current = null;
          }
        } else if (direction === 'right') {
          const maxScroll = cont.scrollWidth - cont.clientWidth;
          if (cont.scrollLeft < maxScroll) {
            cont.scrollLeft = Math.min(maxScroll, cont.scrollLeft + scrollSpeed);
            scrollAnimationRef.current = requestAnimationFrame(animateScroll);
          } else {
            scrollAnimationRef.current = null;
            scrollDirectionRef.current = null;
          }
        }
      };
      
      scrollAnimationRef.current = requestAnimationFrame(animateScroll);
    } else if (scrollAnimationRef.current !== null && !newDirection) {
      // Parar scroll se não está mais na zona de scroll
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
      scrollDirectionRef.current = null;
    }
  };

  const handleDragStart = (e: React.DragEvent, clienteId: string) => {
    setDraggedCard(clienteId);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDraggedOverColumn(columnId);
    
    // Ativar auto-scroll se estiver arrastando
    handleAutoScroll(e);
  };

  const handleDragLeave = () => {
    setDraggedOverColumn(null);
    // Parar auto-scroll quando sair da área
    if (scrollAnimationRef.current !== null) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }
  };

  // Limpar animação quando parar de arrastar
  useEffect(() => {
    if (!draggedCard && scrollAnimationRef.current !== null) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }
    
    // Cleanup ao desmontar
    return () => {
      if (scrollAnimationRef.current !== null) {
        cancelAnimationFrame(scrollAnimationRef.current);
        scrollAnimationRef.current = null;
      }
    };
  }, [draggedCard]);

  const handleDrop = async (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDraggedOverColumn(null);
    setIsDragging(false);
    
    // Parar auto-scroll quando soltar
    if (scrollAnimationRef.current !== null) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }
    
    if (!draggedCard) return;
    
    const cliente = clientesComStatus.find(c => c.id === draggedCard);
    if (!cliente || cliente.fase === columnId) {
      setDraggedCard(null);
      return;
    }

    // Atualização otimista - atualizar UI imediatamente
    const faseAnterior = cliente.fase;
    // Usar columnId diretamente como fase (pode ser 'teste', 'producao' ou qualquer ID de coluna)
    setClientesComStatus(prev => 
      prev.map(c => 
        c.id === draggedCard 
          ? { ...c, fase: columnId as any }
          : c
      )
    );
    setDraggedCard(null);

    // Fazer a chamada da API em background
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const response = await fetch('/api/admin/atualizar-fase-cliente', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          clienteId: draggedCard,
          fase: columnId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar fase');
      }

      // Atualizar dados do servidor em background (sem bloquear UI)
      // A atualização otimista já foi aplicada, então o cliente já está na coluna correta
      refetch();
    } catch (err: any) {
      // Reverter a mudança se a API falhar
      setClientesComStatus(prev => 
        prev.map(c => 
          c.id === draggedCard 
            ? { ...c, fase: faseAnterior }
            : c
        )
      );
      alert(err.message || 'Erro ao mover cliente. Tente novamente.');
    }
  };

  // Agrupar clientes por fase
  const clientesPorFase = useMemo(() => {
    const grupos: Record<string, ClienteComStatus[]> = {};
    const primeiraColunaId = kanbanColumns[0]?.id;

    kanbanColumns.forEach((col) => {
      grupos[col.id] = [];
    });

    clientesFiltrados.forEach((cliente) => {
      const fase = cliente.fase;
      if (fase && grupos[fase]) {
        grupos[fase].push(cliente);
      } else if (primeiraColunaId && grupos[primeiraColunaId]) {
        // Sem fase ou fase inexistente: colocar na primeira coluna
        grupos[primeiraColunaId].push(cliente);
      }
    });

    return grupos;
  }, [clientesFiltrados, kanbanColumns]);

  if (loading || loadingStatus) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (clientesFiltrados.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">Nenhum cliente encontrado</p>
      </div>
    );
  }

  return (
    <>
      <CriarClienteModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setFaseParaNovoCliente(undefined);
        }}
        faseInicial={faseParaNovoCliente}
        onSuccess={(credenciais) => {
          refetch();
          setIsModalOpen(false);
          setFaseParaNovoCliente(undefined);
          // Se houver credenciais, mostrar o popup
          if (credenciais) {
            setCredenciaisData(credenciais);
            // Usar setTimeout para garantir que o modal seja fechado antes do popup aparecer
            setTimeout(() => {
              setShowCredenciaisPopup(true);
            }, 100);
          }
        }}
      />

      <Modal
        isOpen={showDeleteModal}
        onClose={handleCancelDelete}
        title="Desativar ou Excluir Cliente"
        closeOnClickOutside={!deleting && !deactivating}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Você não acha melhor desativar? Se excluir, todos os dados desse cliente serão excluídos permanentemente.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              disabled={deleting || deactivating}
            >
              Excluir
            </Button>
            <Button
              variant="primary"
              onClick={handleDesativar}
              disabled={deleting || deactivating}
            >
              {deactivating ? 'Desativando...' : 'Desativar'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showAtivarModal}
        onClose={handleCancelDelete}
        title="Ativar Cliente"
        closeOnClickOutside={!activating}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Tem certeza que deseja ativar o cliente <strong>{clienteParaExcluir?.nome || 'Cliente'}</strong>?
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={handleCancelDelete}
              disabled={activating}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleAtivar}
              disabled={activating}
            >
              {activating ? 'Ativando...' : 'Confirmar Ativação'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showConfirmDeleteModal}
        onClose={handleCancelConfirmDelete}
        title="Confirmar Exclusão"
        closeOnClickOutside={!deleting}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Para que a exclusão seja feita, digite o nome do cliente corretamente abaixo <strong>{clienteParaExcluir?.nome || 'Cliente'}</strong>.
          </p>
          <Input
            label="Nome do Cliente"
            type="text"
            value={nomeConfirmacao}
            onChange={(e) => setNomeConfirmacao(e.target.value)}
            placeholder="Digite o nome do cliente"
            disabled={deleting}
            autoFocus
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={handleCancelConfirmDelete}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleFinalDelete}
              disabled={deleting || nomeConfirmacao.trim() !== clienteParaExcluir?.nome?.trim()}
            >
              {deleting ? 'Excluindo...' : 'Confirmar Exclusão'}
            </Button>
          </div>
        </div>
      </Modal>

      <div className="w-full">
        {/* Barra de busca e botão adicionar */}
        <div className="mb-6 flex items-center gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {/* Controle de visualização */}
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden h-10">
            <button
              onClick={() => setViewMode('lista')}
              className={`h-full px-3 flex items-center justify-center transition-colors ${
                viewMode === 'lista'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              title="Visualização em lista"
            >
              <List className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`h-full px-3 flex items-center justify-center transition-colors border-l border-gray-200 ${
                viewMode === 'kanban'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              title="Visualização em kanban"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          </div>
          {viewMode === 'lista' && (
            <Button
              onClick={() => setIsModalOpen(true)}
              variant="primary"
              className="flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-5 h-5" />
              Adicionar Cliente
            </Button>
          )}
        </div>

      {/* Visualização de clientes */}
      {viewMode === 'lista' ? (
        <div className="bg-white overflow-hidden rounded-t-xl">
          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-sm font-bold text-gray-700 bg-gray-50 rounded-tl-xl">Nome do Cliente</th>
                <th className="px-6 py-3 text-left text-sm font-bold text-gray-700 bg-gray-50">Telefone IA</th>
                <th className="px-6 py-3 text-left text-sm font-bold text-gray-700 bg-gray-50">WhatsApp</th>
                <th className="px-6 py-3 text-left text-sm font-bold text-gray-700 bg-gray-50">Tipo Marcação</th>
                <th className="px-6 py-3 text-left text-sm font-bold text-gray-700 bg-gray-50">Fase</th>
                <th className="px-6 py-3 text-left text-sm font-bold text-gray-700 bg-gray-50">Status</th>
                <th className="px-6 py-3 text-right text-sm font-bold text-gray-700 bg-gray-50 rounded-tr-xl">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {currentItems.map((cliente) => {
                const statusConexao = formatarStatusConexao(cliente.statusEvolution);
                const fase = formatarFase(cliente.fase);
                const status = formatarStatus(cliente.ativo);

                return (
                  <tr
                    key={cliente.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/admin/clientes/${cliente.id}`)}
                  >
                    <td className="px-6 py-4 text-sm text-gray-900 font-bold">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 border border-gray-200 ${getAvatarColor(
                            cliente.nome
                          )}`}
                        >
                          {getInitials(cliente.nome)}
                        </div>
                        <span className="relative inline-flex items-center gap-2">
                          {cliente.nome || `Cliente ${cliente.id.substring(0, 8)}`}
                          {tarefasPendentesPorCliente[cliente.id] > 0 && (
                            <span className="min-w-[20px] h-5 bg-primary-600 text-white text-xs font-semibold rounded-full flex items-center justify-center px-1.5">
                              {tarefasPendentesPorCliente[cliente.id] > 9 ? '9+' : tarefasPendentesPorCliente[cliente.id]}
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatarTelefone(cliente.telefone_ia)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusConexao.cor}`}>
                        {statusConexao.texto}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatarTipoMarcacao(cliente.tipo_marcacao)}</td>
                    <td className="px-6 py-4">
                      <span 
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${fase.cor || ''}`}
                        style={
                          fase.corHex 
                            ? {
                                color: fase.corHex,
                                backgroundColor: hexToRgba(fase.corHex, 0.1),
                                borderColor: hexToRgba(fase.corHex, 0.3),
                                borderWidth: '1px',
                                borderStyle: 'solid'
                              }
                            : undefined
                        }
                      >
                        {fase.texto}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${status.cor}`}>
                        {status.texto}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleDeleteClick(e, cliente)}
                          disabled={deleting}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Excluir cliente"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                        <ClienteActionsMenu
                          fase={cliente.fase}
                          ativo={cliente.ativo}
                          onEditInstance={() => handleEditInstance(cliente)}
                          onEditCliente={() => handleEditCliente(cliente)}
                          onDesativar={() => handleDesativarCliente(cliente)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div 
          ref={kanbanScrollRef}
          className="w-full overflow-x-auto pb-4 scrollbar-hide"
          onDragOver={handleAutoScroll}
          style={{
            scrollbarWidth: 'none', /* Firefox */
            msOverflowStyle: 'none', /* IE e Edge */
          }}
        >
          <div className="flex gap-3 min-w-max items-start">
            {kanbanColumns.map((column) => {
              const clientesNaColuna = clientesPorFase[column.id] || [];
              const isDraggedOver = draggedOverColumn === column.id;
              
              return (
                <div
                  key={column.id}
                  className={`flex-shrink-0 w-64 bg-gray-50 rounded-lg border-2 transition-colors ${
                    isDraggedOver ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                  }`}
                  onDragOver={(e) => handleDragOver(e, column.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, column.id)}
                >
                  {/* Cabeçalho da coluna */}
                  <div className="p-2 border-b border-gray-200 bg-white rounded-t-lg">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {editingColumnId === column.id ? (
                          <div className="relative w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-gray-300">
                            <div
                              className="absolute inset-0 w-full h-full"
                              style={{ backgroundColor: editColumnColor }}
                            />
                            <input
                              type="color"
                              value={editColumnColor}
                              onChange={(e) => setEditColumnColor(e.target.value)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              title="Cor da coluna"
                            />
                          </div>
                        ) : (
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: column.color || '#6b7280' }}
                          />
                        )}
                        {editingColumnId === column.id ? (
                          <>
                            <input
                              type="text"
                              value={editColumnName}
                              onChange={(e) => setEditColumnName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEditColumn();
                                if (e.key === 'Escape') handleCancelEditColumn();
                              }}
                              className="flex-1 min-w-0 px-2 py-1 text-sm font-semibold text-gray-900 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              autoFocus
                            />
                            <button
                              onClick={handleSaveEditColumn}
                              disabled={!editColumnName.trim()}
                              className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                              title="Salvar"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancelEditColumn}
                              className="p-1 text-gray-400 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                              title="Cancelar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <h3 className="text-sm font-semibold text-gray-900 truncate">{column.name}</h3>
                        )}
                        <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                          {clientesNaColuna.length}
                        </span>
                      </div>
                      {editingColumnId !== column.id && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <ColunaActionsMenu
                            onEditarNome={() => {
                              setEditingColumnId(column.id);
                              setEditColumnName(column.name);
                              setEditColumnColor(column.color || '#6b7280');
                            }}
                            onExcluir={() => handleDeleteColumn(column.id)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Cards da coluna */}
                  <div className="p-2 space-y-2">
                    {/* Botão para adicionar cliente nesta coluna */}
                    <button
                      onClick={() => {
                        setFaseParaNovoCliente(column.id);
                        setIsModalOpen(true);
                      }}
                      className="w-full text-left text-xs text-gray-600 hover:text-primary-600 hover:bg-gray-100 px-2 py-1.5 rounded transition-colors"
                    >
                      + Adicionar novo cliente
                    </button>
                    
                    {clientesNaColuna.map((cliente) => {
                      const statusConexao = formatarStatusConexao(cliente.statusEvolution);
                      const status = formatarStatus(cliente.ativo);
                      const isDragging = draggedCard === cliente.id;
                      
                      return (
                        <div
                          key={cliente.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, cliente.id)}
                          onDragEnd={() => {
                            setDraggedCard(null);
                            setIsDragging(false);
                            // Parar auto-scroll quando o drag terminar
                            if (scrollAnimationRef.current !== null) {
                              cancelAnimationFrame(scrollAnimationRef.current);
                              scrollAnimationRef.current = null;
                            }
                          }}
                          onMouseDown={(e) => {
                            // Não iniciar drag se estiver clicando em botões ou menus
                            if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('[role="menu"]')) {
                              e.stopPropagation();
                              return;
                            }
                          }}
                          onClick={(e) => {
                            // Não navegar se estiver arrastando ou clicando em botões/menus
                            if (isDragging || (e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('[role="menu"]')) {
                              return;
                            }
                            router.push(`/admin/clientes/${cliente.id}`);
                          }}
                          className={`bg-white rounded border border-gray-200 p-2.5 hover:shadow-md transition-all ${
                            isDragging ? 'opacity-50 cursor-move' : 'cursor-pointer'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-semibold text-[10px] flex-shrink-0 border border-gray-200 ${getAvatarColor(
                                  cliente.nome
                                )}`}
                              >
                                {getInitials(cliente.nome)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-semibold text-gray-900 truncate flex items-center gap-1.5">
                                  <span className="truncate">
                                    {cliente.nome || `Cliente ${cliente.id.substring(0, 8)}`}
                                  </span>
                                  {tarefasPendentesPorCliente[cliente.id] > 0 && (
                                    <span className="min-w-[16px] h-4 bg-primary-600 text-white text-[10px] font-semibold rounded-full flex items-center justify-center px-1 flex-shrink-0">
                                      {tarefasPendentesPorCliente[cliente.id] > 9 ? '9+' : tarefasPendentesPorCliente[cliente.id]}
                                    </span>
                                  )}
                                </h4>
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClick(e, cliente);
                                }}
                                disabled={deleting}
                                className="p-0.5 text-gray-400 hover:text-red-600 rounded transition-colors disabled:opacity-50"
                                title="Excluir cliente"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <ClienteActionsMenu
                                fase={cliente.fase}
                                ativo={cliente.ativo}
                                onEditInstance={() => handleEditInstance(cliente)}
                                onEditCliente={() => handleEditCliente(cliente)}
                                onDesativar={() => handleDesativarCliente(cliente)}
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-1 text-[11px]">
                            <div>
                              <p className="text-gray-500 mb-0">Telefone IA: {formatarTelefone(cliente.telefone_ia)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Tipo: {formatarTipoMarcacao(cliente.tipo_marcacao)}</p>
                            </div>
                            <div className="flex justify-end gap-1">
                              <span className={`px-1.5 py-0.5 inline-flex text-[10px] leading-3 font-semibold rounded-full ${statusConexao.cor}`}>
                                {statusConexao.texto}
                              </span>
                              <span className={`px-1.5 py-0.5 inline-flex text-[10px] leading-3 font-semibold rounded-full ${status.cor}`}>
                                {status.texto}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {clientesNaColuna.length === 0 && (
                      <div className="text-center text-gray-400 text-xs py-4 min-h-[60px] flex items-center justify-center">
                        Nenhum cliente nesta fase
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            {/* Botão/Formulário para adicionar nova coluna */}
            <div className="flex-shrink-0 w-64">
              {isAddingColumn ? (
                <div className="bg-white rounded-lg border-2 border-gray-200 p-2">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="relative w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-gray-300">
                      <div
                        className="absolute inset-0 w-full h-full"
                        style={{ backgroundColor: newColumnColor }}
                      />
                      <input
                        type="color"
                        value={newColumnColor}
                        onChange={(e) => setNewColumnColor(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        title="Cor da coluna"
                      />
                    </div>
                    <input
                      type="text"
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                      placeholder="Digite o nome da coluna..."
                      className="flex-1 min-w-0 px-2 py-1.5 bg-white border border-gray-200 rounded text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-xs"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddColumn();
                        } else if (e.key === 'Escape') {
                          handleCancelAddColumn();
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleAddColumn}
                      disabled={!newColumnName.trim()}
                      className="flex-1 bg-primary-600 text-white px-3 py-1.5 rounded hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs"
                    >
                      Adicionar Coluna
                    </button>
                    <button
                      onClick={handleCancelAddColumn}
                      className="text-gray-500 hover:text-gray-700 transition-colors p-1"
                      title="Cancelar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingColumn(true)}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 hover:border-gray-400 transition-colors flex items-center justify-center text-gray-600 font-medium text-sm py-5"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Adicionar outra coluna
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}

      <EditarNomeInstanciaModal
        isOpen={showEditInstanceModal}
        onClose={() => {
          setShowEditInstanceModal(false);
          setInstanciaSelecionada(null);
        }}
        instancia={instanciaSelecionada}
        onSuccess={handleSuccessEdit}
      />

      <EditarClienteModal
        isOpen={showEditClienteModal}
        onClose={() => {
          setShowEditClienteModal(false);
          setClienteSelecionado(null);
        }}
        cliente={clienteSelecionado}
        onSuccess={handleSuccessEdit}
      />


      {showCredenciaisPopup && credenciaisData && (
        <CredenciaisPopup
          email={credenciaisData.email}
          senha={credenciaisData.senha}
          tipoCliente={credenciaisData.tipoCliente}
          onClose={() => {
            setShowCredenciaisPopup(false);
            setCredenciaisData(null);
          }}
        />
      )}

      </div>
    </>
  );
}
