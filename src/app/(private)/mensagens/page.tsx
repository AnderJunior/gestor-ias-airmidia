'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMensagensPorCliente, useClientesComConversas } from '@/hooks/useMensagensPorCliente';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Check, Play, Pause, Mic, ZoomIn, ZoomOut, Download, X, File, Image as ImageIcon } from 'lucide-react';
import { MensagemConversa } from '@/lib/api/mensagens';
import { getAtendimentoByCliente, getAllAtendimentosByCliente } from '@/lib/api/atendimentos';
import { getAgendamentoByCliente, getAllAgendamentosByCliente } from '@/lib/api/agendamentos';
import { Modal } from '@/components/ui/Modal';
import { getConnectedInstances } from '@/lib/api/whatsapp';
import { useUsuario } from '@/hooks/useUsuario';
import { useAuth } from '@/hooks/useAuth';
import { AtendimentoSidebar } from '@/app/(private)/atendimento/components/AtendimentoSidebar';
import { supabase } from '@/lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { filterWhatsAppUrl } from '@/lib/utils/images';

interface MensagemExibicao {
  id: string;
  conteudo: string;
  isCliente: boolean;
  created_at: string;
  base64_audio?: string | null;
  base64_imagem?: string | null;
  base64_documento?: string | null;
}

// Componente de Player de Áudio estilo WhatsApp
function AudioPlayerWhatsApp({ 
  audioSrc, 
  clienteId, 
  clienteNome, 
  clienteFotoPerfil,
  getClienteColor
}: { 
  audioSrc: string;
  clienteId: string;
  clienteNome: string;
  clienteFotoPerfil?: string;
  getClienteColor: (clienteId: string) => string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  
  // Gerar waveform simples - valores mais variados para melhor visualização
  useEffect(() => {
    const bars = Array.from({ length: 50 }, () => {
      // Gerar valores entre 0.3 e 1.0 para garantir barras visíveis
      return Math.random() * 0.7 + 0.3;
    });
    setWaveform(bars);
  }, []);
  
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);
  
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  };
  
  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const activeBarIndex = Math.floor((progress / 100) * waveform.length);
  const cor = getClienteColor(clienteId);
  const inicial = clienteNome.charAt(0).toUpperCase();
  const fotoValida = filterWhatsAppUrl(clienteFotoPerfil);
  
  return (
    <div className="flex items-center gap-2 pt-1">
      {/* Áudio oculto para controle */}
      <audio
        ref={audioRef}
        preload="metadata"
        onError={(e) => {
          console.error('Erro ao carregar áudio:', e);
        }}
      >
        <source src={audioSrc} type="audio/ogg; codecs=opus" />
        <source src={audioSrc} type="audio/ogg" />
        <source src={audioSrc} type="audio/mpeg" />
        <source src={audioSrc} type="audio/mp3" />
        <source src={audioSrc} type="audio/wav" />
        <source src={audioSrc} type="audio/webm" />
      </audio>
      
      {/* Avatar com ícone de microfone */}
      <div className="relative flex-shrink-0">
        {fotoValida ? (
          <img
            src={fotoValida}
            alt={clienteNome}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
            style={{ backgroundColor: cor }}
          >
            {inicial}
          </div>
        )}
        <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-0.5">
          <Mic className="w-3 h-3 text-white" />
        </div>
      </div>
      
      {/* Botão Play/Pause */}
      <button
        onClick={togglePlay}
        className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 text-white ml-0.5" />
        ) : (
          <Play className="w-4 h-4 text-white ml-0.5" />
        )}
      </button>
      
      {/* Waveform e tempo */}
      <div className="flex-1 min-w-0">
        {/* Waveform - clicável para navegar no áudio */}
        <div 
          className="flex items-end gap-0.5 cursor-pointer relative"
          style={{ 
            height: '24px',
            minHeight: '24px',
            maxHeight: '24px',
            width: '100%'
          }}
          onClick={(e) => {
            const audio = audioRef.current;
            if (!audio || !duration || duration <= 0) return;
            
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percentage = Math.max(0, Math.min(1, clickX / rect.width));
            const newTime = percentage * duration;
            
            audio.currentTime = newTime;
            setCurrentTime(newTime);
          }}
          onMouseMove={(e) => {
            // Mudar cursor para indicar que é clicável
            e.currentTarget.style.cursor = 'pointer';
          }}
        >
          {waveform.length > 0 ? waveform.map((height, index) => {
            const isActive = index <= activeBarIndex;
            // Altura mínima maior para garantir visibilidade
            const minBarHeight = 6; // altura mínima em pixels
            const maxBarHeight = 20; // altura máxima em pixels
            const barHeight = Math.max(minBarHeight, height * maxBarHeight);
            const inactiveHeight = Math.max(4, height * maxBarHeight * 0.5);
            const finalHeight = isActive ? barHeight : inactiveHeight;
            
            return (
              <div
                key={index}
                className="rounded-sm transition-all duration-100 pointer-events-none"
                style={{
                  width: '3px',
                  height: `${finalHeight}px`,
                  minHeight: `${finalHeight}px`,
                  backgroundColor: isActive ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.6)',
                  flexShrink: 0,
                  display: 'block',
                }}
              />
            );
          }) : (
            // Fallback: mostrar barras mesmo se waveform não estiver carregado
            Array.from({ length: 50 }).map((_, index) => (
              <div
                key={index}
                className="rounded-sm pointer-events-none"
                style={{
                  width: '3px',
                  height: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.5)',
                  flexShrink: 0,
                }}
              />
            ))
          )}
        </div>
        
        {/* Tempo */}
        <div className="flex items-center justify-between text-xs text-white/90">
          <span>{formatTime(currentTime)}</span>
          {duration > 0 && (
            <span className="text-white/60">{formatTime(duration)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Componente de Documento estilo WhatsApp
function DocumentoMessage({ 
  base64Documento, 
  isCliente 
}: { 
  base64Documento: string;
  isCliente: boolean;
}) {
  // Função para detectar tipo de arquivo pelo base64
  const detectarTipoArquivo = (base64: string): { tipo: string; extensao: string; mimeType: string } => {
    try {
      // Pegar os primeiros bytes do base64
      const header = base64.substring(0, 50);
      const binaryString = atob(header);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // PDF - começa com %PDF
      if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
        return { tipo: 'PDF', extensao: 'pdf', mimeType: 'application/pdf' };
      }

      // DOCX - ZIP header (DOCX é um ZIP)
      if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
        // Verificar se contém word/_rels/document.xml.rels no base64
        const base64Lower = base64.toLowerCase();
        if (base64Lower.includes('word/_rels/document.xml.rels') || 
            base64Lower.includes('word/document.xml')) {
          return { tipo: 'DOCX', extensao: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
        }
        // XLSX também é ZIP
        if (base64Lower.includes('xl/_rels/workbook.xml.rels') || 
            base64Lower.includes('xl/workbook.xml')) {
          return { tipo: 'XLSX', extensao: 'xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
        }
        // PPTX também é ZIP
        if (base64Lower.includes('ppt/_rels/presentation.xml.rels') || 
            base64Lower.includes('ppt/presentation.xml')) {
          return { tipo: 'PPTX', extensao: 'pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
        }
      }

      // DOC/XLS antigo - ambos começam com D0 CF 11 E0 (formato OLE2)
      // Diferenciar pelo conteúdo interno (mais complexo, então vamos usar genérico)
      if (bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0) {
        // Tentar detectar pelo nome do arquivo ou conteúdo
        const base64Lower = base64.toLowerCase();
        if (base64Lower.includes('worddocument') || base64Lower.includes('msword')) {
          return { tipo: 'DOC', extensao: 'doc', mimeType: 'application/msword' };
        } else if (base64Lower.includes('workbook') || base64Lower.includes('excel')) {
          return { tipo: 'XLS', extensao: 'xls', mimeType: 'application/vnd.ms-excel' };
        }
        // Por padrão, assumir DOC (mais comum)
        return { tipo: 'DOC', extensao: 'doc', mimeType: 'application/msword' };
      }

      // TXT - texto simples (sem header específico)
      // Por padrão, se não conseguir detectar, retornar genérico
      return { tipo: 'ARQUIVO', extensao: 'bin', mimeType: 'application/octet-stream' };
    } catch (e) {
      console.warn('Erro ao detectar tipo de arquivo:', e);
      return { tipo: 'ARQUIVO', extensao: 'bin', mimeType: 'application/octet-stream' };
    }
  };

  // Calcular tamanho do arquivo
  const calcularTamanho = (base64: string): string => {
    // Tamanho aproximado: base64 é ~33% maior que o binário original
    const tamanhoBytes = (base64.length * 3) / 4;
    
    if (tamanhoBytes < 1024) {
      return `${Math.round(tamanhoBytes)} B`;
    } else if (tamanhoBytes < 1024 * 1024) {
      return `${(tamanhoBytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(tamanhoBytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  };

  const infoArquivo = detectarTipoArquivo(base64Documento);
  const tamanho = calcularTamanho(base64Documento);
  const nomeArquivo = `documento.${infoArquivo.extensao}`;

  // Função para fazer download
  const handleDownload = () => {
    try {
      const dataUri = `data:${infoArquivo.mimeType};base64,${base64Documento}`;
      const link = document.createElement('a');
      link.href = dataUri;
      link.download = nomeArquivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Erro ao fazer download do documento:', error);
    }
  };

  return (
    <div className="flex items-center gap-3 mt-[3px]">
      {/* Ícone do arquivo estilo limpo (similar à imagem de referência) */}
      <div className="relative flex-shrink-0">
        <div className="w-12 h-14 bg-gray-500/80 rounded-md flex flex-col items-center justify-center relative">
          {/* Ícone de documento no topo */}
          <File className="w-5 h-5 text-white/90 mb-1" />
          {/* Texto do tipo centralizado embaixo */}
          <span className="text-[10px] font-bold text-white">
            {infoArquivo.tipo}
          </span>
        </div>
      </div>

      {/* Informações do arquivo */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {nomeArquivo}
        </p>
        <p className="text-xs text-white/70">
          {infoArquivo.tipo} • {tamanho}
        </p>
      </div>

      {/* Ícone de download */}
      <button
        onClick={handleDownload}
        className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        title="Baixar arquivo"
      >
        <Download className="w-4 h-4 text-white/80" />
      </button>
    </div>
  );
}

// Função helper para formatar a última mensagem na lista de conversas
function formatarUltimaMensagem(cliente: any, duracaoAudio?: number): { icon: React.ReactNode; text: string } | null {
  if (!cliente.ultima_mensagem_tipo) {
    return null;
  }

  switch (cliente.ultima_mensagem_tipo) {
    case 'audio':
      // Formatar duração do áudio se disponível
      const duracao = duracaoAudio || cliente.ultima_mensagem_duracao_audio;
      let duracaoTexto = '';
      if (duracao && !isNaN(duracao) && duracao > 0) {
        const mins = Math.floor(duracao / 60);
        const secs = Math.floor(duracao % 60);
        duracaoTexto = `${mins}:${secs.toString().padStart(2, '0')}`;
      }
      return {
        icon: <Mic className="w-4 h-4 text-gray-600 flex-shrink-0" />,
        text: duracaoTexto || 'Áudio'
      };
    case 'imagem':
      return {
        icon: <ImageIcon className="w-4 h-4 text-gray-600 flex-shrink-0" />,
        text: 'Foto'
      };
    case 'documento':
      return {
        icon: <File className="w-4 h-4 text-gray-600 flex-shrink-0" />,
        text: 'Documento'
      };
    default:
      return null;
  }
}

export default function MensagensPage() {
  const searchParams = useSearchParams();
  const [clienteSelecionado, setClienteSelecionado] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [atendimentoId, setAtendimentoId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hasAtendimento, setHasAtendimento] = useState(false);
  const [hasAgendamento, setHasAgendamento] = useState(false);
  const { clientes, loading: loadingClientes, refetch: refetchClientes } = useClientesComConversas();
  const [duracaoAudios, setDuracaoAudios] = useState<Map<string, number>>(new Map());
  const { mensagens, loading: loadingMensagens } = useMensagensPorCliente(clienteSelecionado);
  const { usuario } = useUsuario();
  const { user } = useAuth();
  const [clientesComAtendimento, setClientesComAtendimento] = useState<Set<string>>(new Set());
  const [clientesAgendamentoStatus, setClientesAgendamentoStatus] = useState<Map<string, string>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Estado para logs de atendimentos e agendamentos (estilo Kommo)
  interface LogItem {
    id: string;
    tipo: 'atendimento' | 'agendamento';
    texto: string;
    data: string; // created_at
    status?: string;
    resumo_conversa?: string;
  }
  const [logs, setLogs] = useState<LogItem[]>([]);
  const logsChannelRef = useRef<RealtimeChannel | null>(null);
  
  // Estado para modal de visualização de imagem
  const [imagemModal, setImagemModal] = useState<{
    src: string;
    remetente: string;
    dataHora: string;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Estado para modal de lista de atendimentos/agendamentos
  const [listaModal, setListaModal] = useState<{
    isOpen: boolean;
    items: Array<{
      id: string;
      tipo: 'atendimento' | 'agendamento';
      data: string;
      status: string;
      resumo_conversa?: string;
    }>;
  }>({
    isOpen: false,
    items: [],
  });
  const loadClientesComAtendimentoRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const loadClientesComAtendimentoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clientesComAtendimentoCacheRef = useRef<{ timestamp: number; data: { clientes: Set<string>; status: Map<string, string> } } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mensagensContainerRef = useRef<HTMLDivElement>(null);

  // Prevenir scroll automático e suprimir avisos do Next.js Router
  useEffect(() => {
    // Suprimir o aviso específico do Next.js sobre position: fixed
    const originalWarn = console.warn;
    console.warn = (...args: any[]) => {
      const message = args[0]?.toString() || '';
      if (message.includes('Skipping auto-scroll behavior due to `position: sticky` or `position: fixed`')) {
        return; // Não exibir este aviso específico
      }
      originalWarn.apply(console, args);
    };
    
    if (containerRef.current) {
      // Prevenir scroll automático
      containerRef.current.scrollIntoView = () => {};
    }
    
    return () => {
      console.warn = originalWarn;
    };
  }, []);

  // Ler parâmetro de query cliente_id e abrir conversa automaticamente
  useEffect(() => {
    const clienteIdFromQuery = searchParams.get('cliente_id');
    if (clienteIdFromQuery && !loadingClientes && clientes.length > 0) {
      // Verificar se o cliente existe na lista
      const clienteExiste = clientes.some(c => c.id === clienteIdFromQuery);
      if (clienteExiste && clienteSelecionado !== clienteIdFromQuery) {
        setClienteSelecionado(clienteIdFromQuery);
        // Limpar o parâmetro da URL após abrir a conversa
        const url = new URL(window.location.href);
        url.searchParams.delete('cliente_id');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [searchParams, loadingClientes, clientes, clienteSelecionado]);

  // Scroll automático para o final quando uma conversa é aberta ou mensagens são carregadas
  // Este useEffect será movido para depois da definição de timelineItems

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
        base64_audio: mensagem.base64_audio,
        base64_imagem: mensagem.base64_imagem,
        base64_documento: mensagem.base64_documento,
      };
    });

    // Ordenar por data
    return mensagensFormatadas.sort((a, b) => {
      const dataA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dataB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dataA - dataB;
    });
  }, [mensagens]);

  // Combinar mensagens e logs em uma timeline única ordenada cronologicamente
  interface TimelineItem {
    id: string;
    tipo: 'mensagem' | 'log';
    data: string;
    mensagem?: MensagemExibicao;
    log?: LogItem;
  }

  const timelineItems: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [];

    // Adicionar mensagens
    mensagensExibicao.forEach(mensagem => {
      items.push({
        id: `msg-${mensagem.id}`,
        tipo: 'mensagem',
        data: mensagem.created_at,
        mensagem,
      });
    });

    // Adicionar logs
    logs.forEach(log => {
      items.push({
        id: `log-${log.id}`,
        tipo: 'log',
        data: log.data,
        log,
      });
    });

    // Ordenar por data (mais antigo primeiro)
    return items.sort((a, b) => {
      const dataA = new Date(a.data).getTime();
      const dataB = new Date(b.data).getTime();
      return dataA - dataB;
    });
  }, [mensagensExibicao, logs]);

  // Scroll automático para o final quando uma conversa é aberta ou mensagens são carregadas
  useEffect(() => {
    if (mensagensContainerRef.current && !loadingMensagens && timelineItems.length > 0) {
      // Usar setTimeout para garantir que o DOM foi atualizado
      const timeoutId = setTimeout(() => {
        if (mensagensContainerRef.current) {
          mensagensContainerRef.current.scrollTop = mensagensContainerRef.current.scrollHeight;
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [clienteSelecionado, loadingMensagens, timelineItems.length]);

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
    
    // Filtrar URLs do WhatsApp - evita tentar carregar imagens que retornariam 403
    const fotoValida = filterWhatsAppUrl(fotoPerfil);

    if (fotoValida) {
      return (
        <img
          src={fotoValida}
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

  // Função para carregar clientes com atendimento/agendamento com cache e debounce
  const loadClientesComAtendimento = useCallback(async () => {
    if (!user?.id) {
      setClientesComAtendimento(new Set());
      setClientesAgendamentoStatus(new Map());
      return;
    }

    // Verificar cache (válido por 30 segundos)
    const cacheKey = `${user.id}:${usuario?.tipo_marcacao}`;
    const cached = clientesComAtendimentoCacheRef.current;
    if (cached && Date.now() - cached.timestamp < 30000) {
      setClientesComAtendimento(cached.data.clientes);
      setClientesAgendamentoStatus(cached.data.status);
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
      
      // Atualizar cache
      clientesComAtendimentoCacheRef.current = {
        timestamp: Date.now(),
        data: {
          clientes: clienteIds,
          status: agendamentoStatusMap,
        },
      };
    } catch (error) {
      console.error('Erro ao carregar clientes com atendimento:', error);
    }
  }, [user?.id, usuario?.tipo_marcacao]);

  // Atualizar ref quando a função mudar
  useEffect(() => {
    loadClientesComAtendimentoRef.current = loadClientesComAtendimento;
  }, [loadClientesComAtendimento]);

  // Buscar duração dos áudios de forma assíncrona
  useEffect(() => {
    if (!user?.id || clientes.length === 0) return;

    const buscarDuracaoAudios = async () => {
      const novasDuracaoAudios = new Map<string, number>();

      // Buscar duração apenas para clientes com última mensagem de áudio
      const clientesComAudio = clientes.filter(
        c => c.ultima_mensagem_tipo === 'audio' && !duracaoAudios.has(c.id)
      );

      for (const cliente of clientesComAudio) {
        try {
          // Buscar última mensagem do cliente
          const { data: mensagens, error } = await supabase
            .from('mensagens')
            .select('base64_audio')
            .eq('cliente_id', cliente.id)
            .eq('usuario_id', user.id)
            .order('data_e_hora', { ascending: false })
            .limit(1)
            .single();

          if (error && error.code !== 'PGRST116') {
            // PGRST116 = nenhum resultado encontrado, ignorar
            continue;
          }

          if (mensagens?.base64_audio) {
            // Criar elemento de áudio temporário para obter duração
            const audio = new Audio();
            const base64Audio = mensagens.base64_audio.trim();
            if (base64Audio && base64Audio.toUpperCase() !== 'EMPTY') {
              // Detectar formato do áudio
              let mimeType = 'audio/ogg; codecs=opus';
              try {
                const header = atob(base64Audio.substring(0, 20));
                const bytes = new Uint8Array(header.length);
                for (let i = 0; i < header.length; i++) {
                  bytes[i] = header.charCodeAt(i);
                }
                if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
                  mimeType = 'audio/ogg; codecs=opus';
                } else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
                  mimeType = 'audio/wav';
                } else if ((bytes[0] === 0xFF && (bytes[1] === 0xFB || bytes[1] === 0xF3)) ||
                          (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)) {
                  mimeType = 'audio/mpeg';
                }
              } catch (e) {
                // Usar formato padrão
              }

              const dataUri = `data:${mimeType};base64,${base64Audio}`;
              audio.src = dataUri;
              audio.preload = 'metadata';

              await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                  reject(new Error('Timeout'));
                }, 5000);

                audio.addEventListener('loadedmetadata', () => {
                  clearTimeout(timeout);
                  if (!isNaN(audio.duration) && audio.duration > 0) {
                    novasDuracaoAudios.set(cliente.id, audio.duration);
                  }
                  resolve();
                });

                audio.addEventListener('error', () => {
                  clearTimeout(timeout);
                  resolve(); // Resolver mesmo com erro para não bloquear
                });

                audio.load();
              });
            }
          }
        } catch (error) {
          // Ignorar erros silenciosamente
          console.debug('Erro ao buscar duração do áudio:', error);
        }
      }

      if (novasDuracaoAudios.size > 0) {
        setDuracaoAudios(prev => {
          const updated = new Map(prev);
          novasDuracaoAudios.forEach((value, key) => {
            updated.set(key, value);
          });
          return updated;
        });
      }
    };

    buscarDuracaoAudios();
  }, [clientes, user?.id, duracaoAudios]);

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
          
          // Invalidar cache quando houver mudanças
          clientesComAtendimentoCacheRef.current = null;
          
          // Debounce para evitar múltiplas chamadas rápidas
          if (loadClientesComAtendimentoTimeoutRef.current) {
            clearTimeout(loadClientesComAtendimentoTimeoutRef.current);
          }
          
          loadClientesComAtendimentoTimeoutRef.current = setTimeout(() => {
            // Usar ref para evitar dependência circular
            if (loadClientesComAtendimentoRef.current) {
              loadClientesComAtendimentoRef.current();
            }
          }, 500);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      isMounted = false;
      if (loadClientesComAtendimentoTimeoutRef.current) {
        clearTimeout(loadClientesComAtendimentoTimeoutRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, usuario?.tipo_marcacao]);

  // Função para buscar e atualizar logs de atendimentos e agendamentos
  const atualizarLogs = useCallback(async (clienteId: string, userId: string) => {
    try {
      const logsArray: LogItem[] = [];

      // Buscar todos os atendimentos do cliente
      const connectedInstances = await getConnectedInstances(userId);
      const instanceIds = connectedInstances.map(inst => inst.id);
      
      if (instanceIds.length > 0) {
        const { data: atendimentos } = await supabase
          .from('atendimentos_solicitado')
          .select('*')
          .eq('cliente_id', clienteId)
          .eq('usuario_id', userId)
          .in('whatsapp_instance_id', instanceIds)
          .order('created_at', { ascending: false });

        if (atendimentos) {
          atendimentos.forEach((atendimento: any) => {
            logsArray.push({
              id: atendimento.id,
              tipo: 'atendimento',
              texto: 'Atendimento humano solicitado',
              data: atendimento.created_at,
              status: atendimento.status,
              resumo_conversa: atendimento.resumo_conversa || undefined,
            });
          });
        }
      }

      // Buscar todos os agendamentos do cliente
      const { data: agendamentos } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('usuario_id', userId)
        .order('created_at', { ascending: false });

      if (agendamentos) {
        agendamentos.forEach((agendamento: any) => {
          logsArray.push({
            id: agendamento.id,
            tipo: 'agendamento',
            texto: 'Agendamento criado',
            data: agendamento.created_at,
            status: agendamento.status,
            resumo_conversa: agendamento.resumo_conversa || undefined,
          });
        });
      }

      // Ordenar por data (mais recente primeiro)
      logsArray.sort((a, b) => {
        const dataA = new Date(a.data).getTime();
        const dataB = new Date(b.data).getTime();
        return dataB - dataA; // Mais recente primeiro
      });

      setLogs(logsArray);
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
      setLogs([]);
    }
  }, []);

  // Buscar e atualizar logs quando cliente for selecionado
  useEffect(() => {
    if (!clienteSelecionado || !user?.id) {
      setLogs([]);
      setHasAtendimento(false);
      setHasAgendamento(false);
      setAtendimentoId(null);
      
      // Limpar subscription se existir
      if (logsChannelRef.current) {
        supabase.removeChannel(logsChannelRef.current);
        logsChannelRef.current = null;
      }
      return;
    }

    // Buscar logs iniciais
    atualizarLogs(clienteSelecionado, user.id);

    // Verificar se tem atendimento/agendamento no cache
    const temAtendimentoNoCache = clientesComAtendimento.has(clienteSelecionado);
    if (temAtendimentoNoCache) {
      if (usuario?.tipo_marcacao === 'agendamento') {
        setHasAgendamento(true);
        setHasAtendimento(false);
      } else {
        setHasAtendimento(true);
        setHasAgendamento(false);
      }
    } else {
      setHasAtendimento(false);
      setHasAgendamento(false);
    }

    // Limpar subscription anterior se existir
    if (logsChannelRef.current) {
      supabase.removeChannel(logsChannelRef.current);
      logsChannelRef.current = null;
    }

    // Configurar realtime para atualizar logs quando houver mudanças
    const channel = supabase
      .channel(`logs-mensagens:${clienteSelecionado}:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'atendimentos_solicitado',
          filter: `cliente_id=eq.${clienteSelecionado} AND usuario_id=eq.${user.id}`,
        },
        async () => {
          await atualizarLogs(clienteSelecionado, user.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agendamentos',
          filter: `cliente_id=eq.${clienteSelecionado} AND usuario_id=eq.${user.id}`,
        },
        async () => {
          await atualizarLogs(clienteSelecionado, user.id);
        }
      )
      .subscribe();

    logsChannelRef.current = channel;

    // Cleanup: remover subscription quando mudar cliente ou desmontar
    return () => {
      if (logsChannelRef.current) {
        supabase.removeChannel(logsChannelRef.current);
        logsChannelRef.current = null;
      }
    };
  }, [clienteSelecionado, user?.id, atualizarLogs, clientesComAtendimento, usuario?.tipo_marcacao]);

  const handleOpenDetalhes = async () => {
    if (!clienteSelecionado || !user?.id) return;
    
    try {
      if (usuario?.tipo_marcacao === 'agendamento') {
        const agendamentos = await getAllAgendamentosByCliente(clienteSelecionado, user.id);
        
        if (agendamentos.length === 0) {
          return;
        }
        
        // Se houver apenas 1, abrir diretamente
        if (agendamentos.length === 1) {
          setAtendimentoId(agendamentos[0].id);
          setIsSidebarOpen(true);
          return;
        }
        
        // Se houver mais de 1, mostrar lista
        const items = agendamentos.map(ag => ({
          id: ag.id,
          tipo: 'agendamento' as const,
          data: ag.created_at || ag.updated_at || '',
          status: ag.status || 'agendado',
          resumo_conversa: ag.resumo_conversa,
        }));
        
        setListaModal({ isOpen: true, items });
      } else {
        const atendimentos = await getAllAtendimentosByCliente(clienteSelecionado, user.id);
        
        if (atendimentos.length === 0) {
          return;
        }
        
        // Se houver apenas 1, abrir diretamente
        if (atendimentos.length === 1) {
          setAtendimentoId(atendimentos[0].id);
          setIsSidebarOpen(true);
          return;
        }
        
        // Se houver mais de 1, mostrar lista
        const items = atendimentos.map(at => ({
          id: at.id,
          tipo: 'atendimento' as const,
          data: at.created_at || at.updated_at || '',
          status: at.status || 'aberto',
          resumo_conversa: at.resumo_conversa,
        }));
        
        setListaModal({ isOpen: true, items });
      }
    } catch (error) {
      console.error('Erro ao buscar atendimento/agendamento:', error);
    }
  };

  // Função para abrir sidebar ao clicar no log
  const handleLogClick = (logId: string, tipo: 'atendimento' | 'agendamento') => {
    setAtendimentoId(logId);
    setIsSidebarOpen(true);
  };

  // Função para formatar data do modal de lista
  const formatarDataLista = (data: string) => {
    try {
      const hoje = new Date();
      const dataItem = new Date(data);
      
      const hojeSemHora = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      const dataItemSemHora = new Date(dataItem.getFullYear(), dataItem.getMonth(), dataItem.getDate());
      
      const diffTime = hojeSemHora.getTime() - dataItemSemHora.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return `Hoje ${format(dataItem, 'HH:mm', { locale: ptBR })}`;
      } else {
        return format(dataItem, 'dd/MM/yyyy HH:mm', { locale: ptBR });
      }
    } catch {
      return '';
    }
  };

  // Função para formatar status
  const formatarStatusLista = (status: string, tipo: 'atendimento' | 'agendamento') => {
    if (tipo === 'agendamento') {
      const statusLower = status.toLowerCase();
      if (statusLower === 'agendado' || statusLower === 'confirmado') {
        return { texto: 'Agendado', cor: 'bg-yellow-100 text-yellow-700' };
      } else if (statusLower === 'concluido' || statusLower === 'realizado') {
        return { texto: 'Realizado', cor: 'bg-green-100 text-green-700' };
      } else if (statusLower === 'cancelado') {
        return { texto: 'Cancelado', cor: 'bg-red-100 text-red-700' };
      }
      return { texto: 'Agendado', cor: 'bg-yellow-100 text-yellow-700' };
    } else {
      const statusLower = status.toLowerCase();
      if (statusLower === 'encerrado') {
        return { texto: 'Encerrado', cor: 'bg-gray-100 text-gray-700' };
      } else if (statusLower === 'em_andamento') {
        return { texto: 'Em Andamento', cor: 'bg-blue-100 text-blue-700' };
      }
      return { texto: 'Aberto', cor: 'bg-purple-100 text-purple-700' };
    }
  };

  // Handler para clicar em um item da lista
  const handleItemListaClick = (itemId: string) => {
    setAtendimentoId(itemId);
    setIsSidebarOpen(true);
    setListaModal({ isOpen: false, items: [] });
  };

  return (
    <div 
      ref={containerRef}
      className="flex h-[calc(100vh-5rem)] w-[calc(100%-18rem)] fixed top-20 left-72 right-0 bottom-0 bg-[#E8F4F8] overflow-hidden"
    >
      {/* Lista de Conversas - Esquerda */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col h-full">
        {/* Barra de Busca */}
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
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
        <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0">
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
                          {(() => {
                            const duracaoAudio = duracaoAudios.get(cliente.id);
                            const ultimaMensagemFormatada = formatarUltimaMensagem(cliente, duracaoAudio);
                            if (ultimaMensagemFormatada) {
                              return (
                                <div className="flex items-center gap-1.5 truncate flex-1">
                                  {ultimaMensagemFormatada.icon}
                                  <p className="text-sm text-gray-600 truncate">
                                    {ultimaMensagemFormatada.text}
                                  </p>
                                </div>
                              );
                            }
                            return (
                              <p className="text-sm text-gray-600 truncate flex-1">
                                {cliente.ultima_mensagem || 'Nenhuma mensagem'}
                              </p>
                            );
                          })()}
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
      <div className="flex-1 flex flex-col bg-white min-w-0 h-full">
        {clienteSelecionado && clienteAtual ? (
          <>
            {/* Header do Chat */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
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
                {(hasAtendimento || hasAgendamento) && (
                  <button 
                    onClick={handleOpenDetalhes}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Área de Mensagens */}
            <div className="flex-1 flex flex-col min-h-0 relative">
              {/* Container de scroll para mensagens */}
              <div 
                ref={mensagensContainerRef}
                className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scrollbar-hide"
              >
                {loadingMensagens ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  </div>
                ) : timelineItems.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Nenhuma mensagem ainda
                  </div>
                ) : (
                  <>
                    {/* Timeline: Mensagens e Logs intercalados */}
                    {timelineItems.map((item) => {
                      // Se for um log, renderizar componente de log
                      if (item.tipo === 'log' && item.log) {
                        const log = item.log;
                        
                        // Formatar data: "Hoje 17:44" ou "27/01/2025 17:44"
                        const formatarDataLog = (data: string) => {
                          try {
                            const hoje = new Date();
                            const dataLog = new Date(data);
                            
                            const hojeSemHora = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
                            const dataLogSemHora = new Date(dataLog.getFullYear(), dataLog.getMonth(), dataLog.getDate());
                            
                            const diffTime = hojeSemHora.getTime() - dataLogSemHora.getTime();
                            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                            if (diffDays === 0) {
                              // Mesmo dia: "Hoje 17:44"
                              return `Hoje ${format(dataLog, 'HH:mm', { locale: ptBR })}`;
                            } else {
                              // Outro dia: "27/01/2025 17:44"
                              return format(dataLog, 'dd/MM/yyyy HH:mm', { locale: ptBR });
                            }
                          } catch {
                            return '';
                          }
                        };

                        // Badge de status
                        const getStatusBadge = () => {
                          if (log.tipo === 'agendamento') {
                            const statusLower = (log.status || '').toLowerCase();
                            if (statusLower === 'agendado' || statusLower === 'confirmado') {
                              return { texto: 'Agendado', cor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' };
                            } else if (statusLower === 'concluido' || statusLower === 'realizado') {
                              return { texto: 'Realizado', cor: 'bg-green-500/20 text-green-300 border-green-500/30' };
                            } else if (statusLower === 'cancelado') {
                              return { texto: 'Cancelado', cor: 'bg-red-500/20 text-red-300 border-red-500/30' };
                            }
                          }
                          // Para atendimentos
                          const statusLower = (log.status || '').toLowerCase();
                          if (statusLower === 'encerrado') {
                            return { texto: 'Encerrado', cor: 'bg-gray-500/20 text-gray-300 border-gray-500/30' };
                          } else if (statusLower === 'em_andamento') {
                            return { texto: 'Em Andamento', cor: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
                          }
                          return { texto: 'Aberto', cor: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
                        };

                        const statusBadge = getStatusBadge();

                        return (
                          <div key={item.id} className="flex justify-center my-4">
                            <div 
                              onClick={() => handleLogClick(log.id, log.tipo)}
                              className="flex items-center justify-between gap-4 text-sm px-4 py-2 bg-[#1e293b] rounded-lg w-full max-w-4xl cursor-pointer hover:bg-[#334155] transition-colors"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-[#94a3b8] font-medium whitespace-nowrap">
                                  {formatarDataLog(log.data)}
                                </span>
                                <span className="text-[#cbd5e1] whitespace-nowrap">
                                  {log.texto}
                                </span>
                              </div>
                              {statusBadge && (
                                <span className={`px-2 py-0.5 text-xs font-medium rounded border whitespace-nowrap flex-shrink-0 ${statusBadge.cor}`}>
                                  {statusBadge.texto}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // Se for uma mensagem, renderizar normalmente
                      const mensagem = item.mensagem!;
                      
                      // Verificar se há imagem (ignorar "EMPTY" e strings vazias)
                      const base64ImagemValido = mensagem.base64_imagem && 
                     mensagem.base64_imagem.trim() !== '' && 
                     mensagem.base64_imagem.trim().toUpperCase() !== 'EMPTY';
                      const temImagem = !!base64ImagemValido;
                      
                      // Verificar se há áudio (ignorar "EMPTY" e strings vazias)
                      const base64AudioValido = mensagem.base64_audio && 
                     typeof mensagem.base64_audio === 'string' &&
                     mensagem.base64_audio.trim() !== '' && 
                     mensagem.base64_audio.trim().toUpperCase() !== 'EMPTY'
                     ? mensagem.base64_audio.trim()
                     : null;
                      const temAudio = !!base64AudioValido;
                      
                      // Verificar se há documento (ignorar "EMPTY", "NULL" e strings vazias)
                      const base64DocumentoValido = mensagem.base64_documento && 
                     typeof mensagem.base64_documento === 'string' &&
                     mensagem.base64_documento.trim() !== '' && 
                     mensagem.base64_documento.trim().toUpperCase() !== 'EMPTY' &&
                     mensagem.base64_documento.trim().toUpperCase() !== 'NULL'
                     ? mensagem.base64_documento.trim()
                     : null;
                      const temDocumento = !!base64DocumentoValido;
                      
                      const temTexto = mensagem.conteudo && mensagem.conteudo.trim() !== '';
                      const dataUriImagem = temImagem ? `data:image/jpeg;base64,${mensagem.base64_imagem}` : null;
                      
                      // Detectar formato do áudio baseado no header do base64
                      const detectarFormatoAudio = (base64: string | null): string => {
                     if (!base64 || typeof base64 !== 'string') return 'audio/ogg; codecs=opus';
                     
                     // Decodificar os primeiros bytes para identificar o formato
                     try {
                       const binaryString = atob(base64.substring(0, 20));
                       const bytes = new Uint8Array(binaryString.length);
                       for (let i = 0; i < binaryString.length; i++) {
                         bytes[i] = binaryString.charCodeAt(i);
                       }
                       
                       // OGG (Opus) - começa com "OggS"
                       if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
                         return 'audio/ogg; codecs=opus';
                       }
                       // WAV - começa com "RIFF"
                       if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
                         return 'audio/wav';
                       }
                       // MP3 - pode começar com ID3 ou FF FB/FF F3
                       if ((bytes[0] === 0xFF && (bytes[1] === 0xFB || bytes[1] === 0xF3)) ||
                           (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)) {
                         return 'audio/mpeg';
                       }
                     } catch (e) {
                       console.warn('Erro ao detectar formato de áudio:', e);
                     }
                     
                     // Fallback: tentar OGG primeiro (formato mais comum do WhatsApp)
                     return 'audio/ogg; codecs=opus';
                      };
                      
                      const dataUriAudio = temAudio && base64AudioValido && typeof base64AudioValido === 'string'
                        ? `data:${detectarFormatoAudio(base64AudioValido)};base64,${base64AudioValido}` 
                        : null;

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
                           {/* Exibir imagem se houver */}
                           {temImagem && dataUriImagem && (
                             <div className="mb-2">
                               <img
                                 src={dataUriImagem}
                                 alt="Imagem da mensagem"
                                 className="rounded-lg cursor-pointer object-cover"
                                 style={{
                                   maxWidth: '700px',
                                   maxHeight: '600px',
                                   width: 'auto',
                                   height: 'auto',
                                 }}
                                 onClick={() => {
                                   setImagemModal({
                                     src: dataUriImagem,
                                     remetente: mensagem.isCliente ? clienteAtual?.nome || 'Cliente' : 'Você',
                                     dataHora: formatarDataHora(mensagem.created_at),
                                   });
                                   setZoom(1);
                                   setPosition({ x: 0, y: 0 });
                                 }}
                               />
                             </div>
                           )}

                           {/* Exibir áudio se houver - Player customizado estilo WhatsApp */}
                           {temAudio && base64AudioValido && clienteAtual && (
                             <div className="mb-2">
                               <AudioPlayerWhatsApp
                                 audioSrc={dataUriAudio!}
                                 clienteId={clienteAtual.id}
                                 clienteNome={clienteAtual.nome}
                                 clienteFotoPerfil={clienteAtual.foto_perfil}
                                 getClienteColor={getClienteColor}
                               />
                             </div>
                           )}

                           {/* Exibir documento se houver - Estilo WhatsApp */}
                           {temDocumento && base64DocumentoValido && (
                             <div className="mb-2">
                               <DocumentoMessage
                                 base64Documento={base64DocumentoValido}
                                 isCliente={mensagem.isCliente}
                               />
                             </div>
                           )}
                           
                           {/* Exibir texto se houver */}
                           {temTexto && (
                             <p className="text-sm whitespace-pre-wrap break-words">
                               {mensagem.conteudo}
                             </p>
                           )}

                           {/* Mensagem vazia (apenas mídia) */}
                           {!temTexto && !temImagem && !temAudio && !temDocumento && (
                             <p className="text-sm text-gray-400 italic">
                               Mensagem sem conteúdo
                             </p>
                           )}
                         </div>
                         <p className={`text-xs text-gray-500 pb-1 ${mensagem.isCliente ? 'text-left' : 'text-right'}`}>
                           {formatarDataHora(mensagem.created_at)}
                         </p>
                       </div>
                     </div>
                   );
                 })}
                  </>
                )}
              </div>
              
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
      
      {/* Modal de Visualização de Imagem */}
      {imagemModal && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setImagemModal(null)}
          onWheel={(e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setZoom(prev => Math.max(0.5, Math.min(5, prev + delta)));
          }}
        >
          {/* Header - Canto Superior Esquerdo */}
          <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 text-white">
            <p className="text-sm font-medium">{imagemModal.remetente}</p>
            <p className="text-xs text-gray-300">{imagemModal.dataHora}</p>
          </div>
          
          {/* Header - Canto Superior Direito */}
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            {/* Botão Zoom In */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setZoom(prev => Math.min(5, prev + 0.25));
              }}
              className="bg-black/50 backdrop-blur-sm hover:bg-black/70 rounded-full p-2 text-white transition-colors"
              title="Aumentar zoom"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            
            {/* Botão Zoom Out */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setZoom(prev => Math.max(0.5, prev - 0.25));
              }}
              className="bg-black/50 backdrop-blur-sm hover:bg-black/70 rounded-full p-2 text-white transition-colors"
              title="Diminuir zoom"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            
            {/* Botão Download */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const link = document.createElement('a');
                link.href = imagemModal.src;
                link.download = `imagem-${Date.now()}.jpg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="bg-black/50 backdrop-blur-sm hover:bg-black/70 rounded-full p-2 text-white transition-colors"
              title="Baixar imagem"
            >
              <Download className="w-5 h-5" />
            </button>
            
            {/* Botão Fechar */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setImagemModal(null);
              }}
              className="bg-black/50 backdrop-blur-sm hover:bg-black/70 rounded-full p-2 text-white transition-colors"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Imagem com zoom e arrastar */}
          <div
            className="relative w-full h-full flex items-center justify-center overflow-hidden"
            onMouseDown={(e) => {
              if (zoom > 1) {
                setIsDragging(true);
                setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
              }
            }}
            onMouseMove={(e) => {
              if (isDragging && zoom > 1) {
                setPosition({
                  x: e.clientX - dragStart.x,
                  y: e.clientY - dragStart.y,
                });
              }
            }}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
            onClick={(e) => {
              // Só fechar se clicar no fundo (não na imagem)
              if (e.target === e.currentTarget) {
                setImagemModal(null);
              }
            }}
          >
            <img
              src={imagemModal.src}
              alt="Imagem ampliada"
              className="max-w-full max-h-full object-contain select-none"
              style={{
                transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                transition: isDragging ? 'none' : 'transform 0.2s',
              }}
              onClick={(e) => e.stopPropagation()}
              draggable={false}
            />
          </div>
        </div>
      )}

      {/* Modal de Lista de Atendimentos/Agendamentos */}
      <Modal
        isOpen={listaModal.isOpen}
        onClose={() => setListaModal({ isOpen: false, items: [] })}
        title={usuario?.tipo_marcacao === 'agendamento' ? 'Agendamentos' : 'Atendimentos'}
        size="md"
      >
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {listaModal.items.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Nenhum item encontrado</p>
          ) : (
            listaModal.items.map((item) => {
              const statusBadge = formatarStatusLista(item.status, item.tipo);
              const dataFormatada = formatarDataLista(item.data);
              const resumoPreview = item.resumo_conversa 
                ? (item.resumo_conversa.length > 100 
                    ? `${item.resumo_conversa.substring(0, 100)}...` 
                    : item.resumo_conversa)
                : '';

              return (
                <div
                  key={item.id}
                  onClick={() => handleItemListaClick(item.id)}
                  className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 font-medium">
                      {dataFormatada}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${statusBadge.cor}`}>
                      {statusBadge.texto}
                    </span>
                  </div>
                  {resumoPreview && (
                    <p className="text-sm text-gray-500 line-clamp-2">
                      {resumoPreview}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Modal>
    </div>
  );
}

