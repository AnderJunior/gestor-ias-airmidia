'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getUsuario } from '@/lib/api/usuarios';
import { getWhatsAppInstances } from '@/lib/api/whatsapp';
import { Usuario } from '@/lib/api/usuarios';
import { WhatsAppInstance } from '@/types/domain';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Trash2, Edit, Phone, Mail, Calendar, CheckCircle, XCircle, Clock, AlertCircle, Play, Pause, Mic, File, Image as ImageIcon, Download, ZoomIn, ZoomOut, Link2, Send, Smile, Check, CheckSquare, Square, UserPlus } from 'lucide-react';
import { ROUTES } from '@/lib/constants';
import { ClienteActionsMenu } from '@/components/admin/ClienteActionsMenu';
import { EditarClienteModal } from '@/components/admin/EditarClienteModal';
import { EditarNomeInstanciaModal } from '@/components/admin/EditarNomeInstanciaModal';
import { supabase } from '@/lib/supabaseClient';
import { fetchKanbanColunas } from '@/lib/api/kanbanColunas';
import { useMensagensPorCliente } from '@/hooks/useMensagensPorCliente';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { filterWhatsAppUrl } from '@/lib/utils/images';
import { MensagemConversa } from '@/lib/api/mensagens';

interface ClienteComStatus extends Usuario {
  statusEvolution?: 'conectado' | 'desconectado' | 'conectando' | 'erro';
  instancias?: WhatsAppInstance[];
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
  
  useEffect(() => {
    const bars = Array.from({ length: 50 }, () => Math.random() * 0.7 + 0.3);
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
      <audio
        ref={audioRef}
        preload="metadata"
        onError={(e) => console.error('Erro ao carregar áudio:', e)}
      >
        <source src={audioSrc} type="audio/ogg; codecs=opus" />
        <source src={audioSrc} type="audio/ogg" />
        <source src={audioSrc} type="audio/mpeg" />
        <source src={audioSrc} type="audio/mp3" />
        <source src={audioSrc} type="audio/wav" />
        <source src={audioSrc} type="audio/webm" />
      </audio>
      
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
      
      <div className="flex-1 min-w-0">
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
        >
          {waveform.length > 0 ? waveform.map((height, index) => {
            const isActive = index <= activeBarIndex;
            const minBarHeight = 6;
            const maxBarHeight = 20;
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
  const detectarTipoArquivo = (base64: string): { tipo: string; extensao: string; mimeType: string } => {
    try {
      const header = base64.substring(0, 50);
      const binaryString = atob(header);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
        return { tipo: 'PDF', extensao: 'pdf', mimeType: 'application/pdf' };
      }

      if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
        const base64Lower = base64.toLowerCase();
        if (base64Lower.includes('word/_rels/document.xml.rels') || 
            base64Lower.includes('word/document.xml')) {
          return { tipo: 'DOCX', extensao: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
        }
        if (base64Lower.includes('xl/_rels/workbook.xml.rels') || 
            base64Lower.includes('xl/workbook.xml')) {
          return { tipo: 'XLSX', extensao: 'xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
        }
        if (base64Lower.includes('ppt/_rels/presentation.xml.rels') || 
            base64Lower.includes('ppt/presentation.xml')) {
          return { tipo: 'PPTX', extensao: 'pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
        }
      }

      if (bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0) {
        const base64Lower = base64.toLowerCase();
        if (base64Lower.includes('worddocument') || base64Lower.includes('msword')) {
          return { tipo: 'DOC', extensao: 'doc', mimeType: 'application/msword' };
        } else if (base64Lower.includes('workbook') || base64Lower.includes('excel')) {
          return { tipo: 'XLS', extensao: 'xls', mimeType: 'application/vnd.ms-excel' };
        }
        return { tipo: 'DOC', extensao: 'doc', mimeType: 'application/msword' };
      }

      return { tipo: 'ARQUIVO', extensao: 'bin', mimeType: 'application/octet-stream' };
    } catch (e) {
      return { tipo: 'ARQUIVO', extensao: 'bin', mimeType: 'application/octet-stream' };
    }
  };

  const calcularTamanho = (base64: string): string => {
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
      <div className="relative flex-shrink-0">
        <div className="w-12 h-14 bg-gray-500/80 rounded-md flex flex-col items-center justify-center relative">
          <File className="w-5 h-5 text-white/90 mb-1" />
          <span className="text-[10px] font-bold text-white">
            {infoArquivo.tipo}
          </span>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {nomeArquivo}
        </p>
        <p className="text-xs text-white/70">
          {infoArquivo.tipo} • {tamanho}
        </p>
      </div>

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

// Componente de Tarefas
function TarefasComponent({ 
  tarefas, 
  onTarefasChange,
  clienteId 
}: { 
  tarefas: Array<{ id: string; descricao: string; concluida: boolean }>;
  onTarefasChange: (tarefas: Array<{ id: string; descricao: string; concluida: boolean }>) => void;
  clienteId: string;
}) {
  const [novaTarefa, setNovaTarefa] = useState('');
  const [mostrarOcultas, setMostrarOcultas] = useState(true);
  const [adicionandoTarefa, setAdicionandoTarefa] = useState(false);

  const tarefasVisiveis = mostrarOcultas 
    ? tarefas 
    : tarefas.filter(t => !t.concluida);

  const totalTarefas = tarefas.length;
  const tarefasConcluidas = tarefas.filter(t => t.concluida).length;
  const porcentagem = totalTarefas > 0 ? Math.round((tarefasConcluidas / totalTarefas) * 100) : 0;
  const todasMarcadas = totalTarefas > 0 && tarefas.every(t => t.concluida);

  const toggleTodasTarefas = () => {
    const novasTarefas = tarefas.map(t => ({
      ...t,
      concluida: !todasMarcadas
    }));
    onTarefasChange(novasTarefas);
  };

  const toggleTarefa = (id: string) => {
    const novasTarefas = tarefas.map(t => 
      t.id === id ? { ...t, concluida: !t.concluida } : t
    );
    onTarefasChange(novasTarefas);
  };

  const adicionarTarefa = () => {
    if (novaTarefa.trim()) {
      const nova = {
        id: `${Date.now()}-${Math.random()}`,
        descricao: novaTarefa.trim(),
        concluida: false
      };
      onTarefasChange([...tarefas, nova]);
      setNovaTarefa('');
      setAdicionandoTarefa(false);
    }
  };

  const excluirTarefa = (id: string) => {
    onTarefasChange(tarefas.filter(t => t.id !== id));
  };

  const cancelarAdicao = () => {
    setNovaTarefa('');
    setAdicionandoTarefa(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTodasTarefas}
            className="flex items-center justify-center w-5 h-5 rounded border-2 border-gray-300 hover:border-gray-400 transition-colors"
          >
            {todasMarcadas ? (
              <CheckSquare className="w-5 h-5 text-white fill-green-500 stroke-white" strokeWidth={2} />
            ) : (
              <Square className="w-5 h-5 text-gray-400" />
            )}
          </button>
          <h2 className="text-lg font-semibold text-gray-900">Tarefas</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMostrarOcultas(!mostrarOcultas)}
            className="px-3 py-1.5 bg-gray-50 text-gray-700 text-sm rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
          >
            {mostrarOcultas ? 'Ocultar itens marcados' : 'Mostrar itens marcados'}
          </button>
          <button
            onClick={() => {
              if (confirm('Tem certeza que deseja excluir todas as tarefas?')) {
                onTarefasChange([]);
              }
            }}
            className="px-3 py-1.5 bg-gray-50 text-gray-700 text-sm rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
          >
            Excluir
          </button>
        </div>
      </div>

      {/* Barra de Progresso */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-900 text-sm font-medium">{porcentagem}%</span>
        </div>
        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-600 transition-all duration-300"
            style={{ width: `${porcentagem}%` }}
          />
        </div>
      </div>

      {/* Lista de Tarefas */}
      <div className="space-y-2 mb-4">
        {tarefasVisiveis.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">Nenhuma tarefa ainda</p>
        ) : (
          tarefasVisiveis.map((tarefa) => (
            <div key={tarefa.id} className="flex items-center gap-3 group">
              <button
                onClick={() => toggleTarefa(tarefa.id)}
                className="flex items-center justify-center w-5 h-5 rounded border-2 border-gray-300 hover:border-gray-400 transition-colors flex-shrink-0"
              >
                {tarefa.concluida ? (
                  <CheckSquare className="w-5 h-5 text-white fill-green-500 stroke-white" strokeWidth={2} />
                ) : (
                  <Square className="w-5 h-5 text-gray-400" />
                )}
              </button>
              <span className={`text-gray-900 text-sm flex-1 ${tarefa.concluida ? 'line-through text-gray-500' : ''}`}>
                {tarefa.descricao}
              </span>
              <button
                onClick={() => excluirTarefa(tarefa.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-opacity"
                title="Excluir tarefa"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Campo para Adicionar Nova Tarefa */}
      {adicionandoTarefa ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={novaTarefa}
              onChange={(e) => setNovaTarefa(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  adicionarTarefa();
                } else if (e.key === 'Escape') {
                  cancelarAdicao();
                }
              }}
              placeholder="Adicionar um item"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              autoFocus
            />
            <button
              onClick={adicionarTarefa}
              className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white hover:bg-primary-700 transition-colors"
              title="Adicionar tarefa"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={adicionarTarefa}
                className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
              >
                Adicionar
              </button>
              <button
                onClick={cancelarAdicao}
                className="px-4 py-2 bg-gray-50 text-gray-700 text-sm rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
              >
                Cancelar
              </button>
            </div>
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm transition-colors">
                <UserPlus className="w-4 h-4" />
                Atribuir
              </button>
              <button className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm transition-colors">
                <Clock className="w-4 h-4" />
                Data de Entrega
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdicionandoTarefa(true)}
          className="w-full px-4 py-2 bg-gray-50 text-gray-700 text-sm rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
        >
          Adicionar um item
        </button>
      )}
    </div>
  );
}

export default function ClienteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const clienteId = params.id as string;

  const [cliente, setCliente] = useState<ClienteComStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditClienteModal, setShowEditClienteModal] = useState(false);
  const [showEditInstanceModal, setShowEditInstanceModal] = useState(false);
  const [instanciaSelecionada, setInstanciaSelecionada] = useState<WhatsAppInstance | null>(null);
  const [kanbanColumns, setKanbanColumns] = useState<Array<{ id: string; name: string; color?: string }>>([]);
  const { mensagens, loading: loadingMensagens } = useMensagensPorCliente(clienteId);
  const mensagensContainerRef = useRef<HTMLDivElement>(null);
  const [imagemModal, setImagemModal] = useState<{
    src: string;
    remetente: string;
    dataHora: string;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [comentario, setComentario] = useState('');
  const [tarefas, setTarefas] = useState<Array<{ id: string; descricao: string; concluida: boolean }>>([]);

  useEffect(() => {
    async function loadCliente() {
      if (!clienteId) return;

      try {
        setLoading(true);
        
        // Carregar colunas do Kanban
        const colunas = await fetchKanbanColunas();
        setKanbanColumns(colunas);

        // Carregar dados do cliente
        const clienteData = await getUsuario(clienteId);
        if (!clienteData) {
          router.push(ROUTES.ADMIN_CLIENTES);
          return;
        }

        // Carregar instâncias WhatsApp
        const instancias = await getWhatsAppInstances(clienteId);
        const statusEvolution = instancias.length > 0 
          ? instancias[0].status 
          : 'desconectado';

        setCliente({
          ...clienteData,
          statusEvolution,
          instancias,
        });
      } catch (error) {
        console.error('Erro ao carregar cliente:', error);
        router.push(ROUTES.ADMIN_CLIENTES);
      } finally {
        setLoading(false);
      }
    }

    loadCliente();
  }, [clienteId, router]);

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

  const formatarStatusConexao = (status?: string) => {
    switch (status) {
      case 'conectado':
        return { texto: 'Conectado', cor: 'text-green-600 bg-green-50', icon: CheckCircle };
      case 'conectando':
        return { texto: 'Conectando', cor: 'text-yellow-600 bg-yellow-50', icon: Clock };
      case 'erro':
        return { texto: 'Erro', cor: 'text-red-600 bg-red-50', icon: AlertCircle };
      default:
        return { texto: 'Desconectado', cor: 'text-gray-600 bg-gray-50', icon: XCircle };
    }
  };

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
        cor: '', 
        corHex: coluna.color || '#6b7280' 
      };
    }

    return { texto: 'Não definido', cor: 'text-gray-600 bg-gray-50', corHex: null };
  };

  const formatarStatus = (ativo?: boolean) => {
    if (ativo === true || ativo === undefined) {
      return { texto: 'Ativo', cor: 'text-green-600 bg-green-50' };
    } else {
      return { texto: 'Inativo', cor: 'text-red-600 bg-red-50' };
    }
  };

  const formatarData = (data: string) => {
    const date = new Date(data);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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

  // Gerar cor consistente baseada no ID do cliente
  const getClienteColor = (clienteId: string): string => {
    const colors = [
      '#ef4444', '#3b82f6', '#10b981', '#f59e0b',
      '#8b5cf6', '#ec4899', '#6366f1', '#f97316',
    ];
    let hash = 0;
    for (let i = 0; i < clienteId.length; i++) {
      hash = clienteId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Formatar data e hora da mensagem
  const formatarDataHora = (data: string) => {
    try {
      const hoje = new Date();
      const dataMsg = new Date(data);
      
      const hojeSemHora = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      const dataMsgSemHora = new Date(dataMsg.getFullYear(), dataMsg.getMonth(), dataMsg.getDate());
      
      const diffTime = hojeSemHora.getTime() - dataMsgSemHora.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return format(dataMsg, 'HH:mm', { locale: ptBR });
      } else {
        return format(dataMsg, 'dd/MM/yyyy HH:mm', { locale: ptBR });
      }
    } catch {
      return '';
    }
  };

  // Scroll automático para a última mensagem
  useEffect(() => {
    if (mensagensContainerRef.current && mensagens.length > 0) {
      mensagensContainerRef.current.scrollTop = mensagensContainerRef.current.scrollHeight;
    }
  }, [mensagens]);

  const handleEditInstance = () => {
    const instancia = cliente?.instancias && cliente.instancias.length > 0 
      ? cliente.instancias[0] 
      : null;
    
    if (!instancia) {
      alert('Este cliente não possui instância WhatsApp cadastrada.');
      return;
    }

    setInstanciaSelecionada(instancia);
    setShowEditInstanceModal(true);
  };

  const handleEditCliente = () => {
    setShowEditClienteModal(true);
  };

  const handleSuccessEdit = async () => {
    // Recarregar dados do cliente
    if (!clienteId) return;

    try {
      const clienteData = await getUsuario(clienteId);
      if (!clienteData) return;

      const instancias = await getWhatsAppInstances(clienteId);
      const statusEvolution = instancias.length > 0 
        ? instancias[0].status 
        : 'desconectado';

      setCliente({
        ...clienteData,
        statusEvolution,
        instancias,
      });
    } catch (error) {
      console.error('Erro ao recarregar cliente:', error);
    }
  };

  const handlePublicarAgente = async () => {
    if (!cliente) return;

    const confirmar = confirm(
      cliente.fase === 'producao'
        ? 'Tem certeza que deseja voltar este agente para a fase de teste?'
        : 'Tem certeza que deseja publicar este agente? O agente sairá do modo teste para produção.'
    );

    if (!confirmar) return;

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
          clienteId: cliente.id,
          fase: cliente.fase === 'producao' ? 'teste' : 'producao',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar fase');
      }

      await handleSuccessEdit();
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar fase. Tente novamente.');
    }
  };

  const handleDesativarCliente = async () => {
    if (!cliente) return;

    const confirmar = confirm('Tem certeza que deseja desativar este cliente?');

    if (!confirmar) return;

    try {
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
          clienteId: cliente.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao desativar cliente');
      }

      await handleSuccessEdit();
    } catch (err: any) {
      alert(err.message || 'Erro ao desativar cliente. Tente novamente.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!cliente) {
    return null;
  }

  // Detectar formato do áudio
  const detectarFormatoAudio = (base64: string | null): string => {
    if (!base64 || typeof base64 !== 'string') return 'audio/ogg; codecs=opus';
    
    try {
      const binaryString = atob(base64.substring(0, 20));
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
        return 'audio/ogg; codecs=opus';
      }
      if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
        return 'audio/wav';
      }
      if ((bytes[0] === 0xFF && (bytes[1] === 0xFB || bytes[1] === 0xF3)) ||
          (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)) {
        return 'audio/mpeg';
      }
    } catch (e) {
      console.warn('Erro ao detectar formato de áudio:', e);
    }
    
    return 'audio/ogg; codecs=opus';
  };

  const statusConexao = formatarStatusConexao(cliente.statusEvolution);
  const StatusIcon = statusConexao.icon;
  const fase = formatarFase(cliente.fase);
  const status = formatarStatus(cliente.ativo);

  return (
    <>
      <div className="w-full h-[calc(100vh-5rem)] flex flex-col">
        {/* Layout Principal: Detalhes */}
        <div className="flex-1 min-h-0">
          {/* Painel Esquerdo - Detalhes */}
          <div className="overflow-y-auto pr-[420px]">
            {/* Card Principal */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(ROUTES.ADMIN_CLIENTES)}
                className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
                aria-label="Voltar"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-semibold text-xl flex-shrink-0 border-2 border-gray-200 ${getAvatarColor(
                  cliente.nome
                )}`}
              >
                {getInitials(cliente.nome)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {cliente.nome || `Cliente ${cliente.id.substring(0, 8)}`}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ClienteActionsMenu
                fase={cliente.fase}
                onPublicarAgente={handlePublicarAgente}
                onEditInstance={handleEditInstance}
                onEditCliente={handleEditCliente}
                onDesativar={handleDesativarCliente}
              />
              </div>
            </div>

            {/* Grid de Informações */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Telefone IA */}
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-500">Telefone IA</p>
                <p className="text-sm text-gray-900 mt-1">
                  {formatarTelefone(cliente.telefone_ia)}
                </p>
              </div>
            </div>

            {/* Status Conexão */}
            <div className="flex items-start gap-3">
              <StatusIcon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-500">Status Conexão</p>
                <span className={`mt-1 inline-flex px-2 py-1 text-[10px] leading-4 font-semibold rounded-full ${statusConexao.cor}`}>
                  {statusConexao.texto}
                </span>
              </div>
            </div>

            {/* Tipo Marcação */}
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-500">Tipo Marcação</p>
                <p className="text-sm text-gray-900 mt-1">
                  {formatarTipoMarcacao(cliente.tipo_marcacao)}
                </p>
              </div>
            </div>

            {/* Fase */}
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-500">Fase</p>
                <span 
                  className={`mt-1 inline-flex px-2 py-1 text-[10px] leading-4 font-semibold rounded-full ${fase.cor || ''}`}
                  style={
                    fase.corHex 
                      ? {
                          color: fase.corHex,
                          backgroundColor: `${fase.corHex}1a`,
                          borderColor: fase.corHex,
                          borderWidth: '1px',
                          borderStyle: 'solid'
                        }
                      : undefined
                  }
                >
                  {fase.texto}
                </span>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-500">Status</p>
                <span className={`mt-1 inline-flex px-2 py-1 text-[10px] leading-4 font-semibold rounded-full ${status.cor}`}>
                  {status.texto}
                </span>
              </div>
            </div>

            {/* Data de Criação */}
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-500">Data de Criação</p>
                <p className="text-sm text-gray-900 mt-1">
                  {formatarData(cliente.created_at)}
                </p>
              </div>
            </div>
          </div>

            {/* Integrações */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h2 className="text-xs font-medium text-gray-500 mb-4">Integrações</h2>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">WhatsApp</p>
                    {cliente.statusEvolution === 'conectado' && cliente.instancias && cliente.instancias.length > 0 && cliente.instancias[0].telefone && (
                      <p className="text-xs text-gray-600 mt-1">
                        Telefone conectado: {formatarTelefone(cliente.instancias[0].telefone)}
                      </p>
                    )}
                  </div>
                </div>
                <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border ${formatarStatusConexao(cliente.statusEvolution).cor}`}>
                  {formatarStatusConexao(cliente.statusEvolution).texto}
                </span>
              </div>
            </div>
            </div>

            {/* Tarefas */}
            <div className="mb-8">
              <TarefasComponent
                tarefas={tarefas}
                onTarefasChange={setTarefas}
                clienteId={clienteId}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Chat Flutuante - Fixo na Direita */}
      <div className="fixed right-0 top-[96px] bottom-0 w-[380px] flex flex-col bg-white border-l border-gray-200 overflow-hidden z-40">
        {/* Área de Mensagens */}
        <div className="flex-1 flex flex-col min-h-0 relative bg-white">
          <div 
            ref={mensagensContainerRef}
            className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scrollbar-hide"
          >
                {loadingMensagens ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  </div>
                ) : mensagens.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Nenhuma mensagem ainda
                  </div>
                ) : (
                  mensagens.map((mensagem: MensagemConversa) => {
                    const remetenteRaw = mensagem.remetente?.toLowerCase() || '';
                    const isCliente = remetenteRaw.includes('cliente') || remetenteRaw === 'cliente';
                    
                    const base64ImagemValido = mensagem.base64_imagem && 
                      mensagem.base64_imagem.trim() !== '' && 
                      mensagem.base64_imagem.trim().toUpperCase() !== 'EMPTY';
                    const temImagem = !!base64ImagemValido;
                    
                    const base64AudioValido = mensagem.base64_audio && 
                      typeof mensagem.base64_audio === 'string' &&
                      mensagem.base64_audio.trim() !== '' && 
                      mensagem.base64_audio.trim().toUpperCase() !== 'EMPTY'
                      ? mensagem.base64_audio.trim()
                      : null;
                    const temAudio = !!base64AudioValido;
                    
                    const base64DocumentoValido = mensagem.base64_documento && 
                      typeof mensagem.base64_documento === 'string' &&
                      mensagem.base64_documento.trim() !== '' && 
                      mensagem.base64_documento.trim().toUpperCase() !== 'EMPTY' &&
                      mensagem.base64_documento.trim().toUpperCase() !== 'NULL'
                      ? mensagem.base64_documento.trim()
                      : null;
                    const temDocumento = !!base64DocumentoValido;
                    
                    const temTexto = mensagem.mensagem && mensagem.mensagem.trim() !== '';
                    const dataUriImagem = temImagem ? `data:image/jpeg;base64,${mensagem.base64_imagem}` : null;
                    const dataUriAudio = temAudio && base64AudioValido && typeof base64AudioValido === 'string'
                      ? `data:${detectarFormatoAudio(base64AudioValido)};base64,${base64AudioValido}` 
                      : null;

                    return (
                      <div
                        key={mensagem.id}
                        className={`flex ${isCliente ? 'justify-start' : 'justify-end'}`}
                      >
                        <div className={`max-w-[70%] flex items-end gap-2 ${isCliente ? 'flex-row' : 'flex-row-reverse'}`}>
                          <div
                            className={`rounded-2xl px-4 py-2 ${
                              isCliente
                                ? 'bg-gray-800 text-white'
                                : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            {temImagem && dataUriImagem && (
                              <div className="mb-2">
                                <img
                                  src={dataUriImagem}
                                  alt="Imagem da mensagem"
                                  className="rounded-lg cursor-pointer object-cover"
                                  style={{
                                    maxWidth: '300px',
                                    maxHeight: '300px',
                                    width: 'auto',
                                    height: 'auto',
                                  }}
                                  onClick={() => {
                                    setImagemModal({
                                      src: dataUriImagem,
                                      remetente: isCliente ? cliente.nome || 'Cliente' : 'Você',
                                      dataHora: formatarDataHora(mensagem.created_at),
                                    });
                                    setZoom(1);
                                    setPosition({ x: 0, y: 0 });
                                  }}
                                />
                              </div>
                            )}

                            {temAudio && dataUriAudio && (
                              <div className="mb-2">
                                <AudioPlayerWhatsApp
                                  audioSrc={dataUriAudio}
                                  clienteId={cliente.id}
                                  clienteNome={cliente.nome || 'Cliente'}
                                  clienteFotoPerfil={undefined}
                                  getClienteColor={getClienteColor}
                                />
                              </div>
                            )}

                            {temDocumento && base64DocumentoValido && (
                              <div className="mb-2">
                                <DocumentoMessage
                                  base64Documento={base64DocumentoValido}
                                  isCliente={isCliente}
                                />
                              </div>
                            )}
                            
                            {temTexto && (
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {mensagem.mensagem}
                              </p>
                            )}

                            {!temTexto && !temImagem && !temAudio && !temDocumento && (
                              <p className="text-sm text-gray-400 italic">
                                Mensagem sem conteúdo
                              </p>
                            )}
                          </div>
                          <p className={`text-xs text-gray-500 pb-1 ${isCliente ? 'text-left' : 'text-right'}`}>
                            {formatarDataHora(mensagem.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
          </div>
          
          {/* Área de Comentários */}
          <div className="border-t border-gray-200 bg-white p-4">
            <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); }} onClick={(e) => e.stopPropagation()} className="space-y-2">
              <textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Escreva um comentário..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none text-sm"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button type="button" className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                    <Link2 className="w-4 h-4 text-gray-600" />
                  </button>
                  <button type="button" className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                    <span className="text-gray-600">@</span>
                  </button>
                  <button type="button" className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                    <Calendar className="w-4 h-4 text-gray-600" />
                  </button>
                  <button type="button" className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                    <Smile className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={!comentario.trim()}
                  className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

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
          <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 text-white">
            <p className="text-sm font-medium">{imagemModal.remetente}</p>
            <p className="text-xs text-gray-300">{imagemModal.dataHora}</p>
          </div>
          
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
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
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                setImagemModal(null);
              }}
              className="bg-black/50 backdrop-blur-sm hover:bg-black/70 rounded-full p-2 text-white transition-colors"
              title="Fechar"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          
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
        }}
        cliente={cliente}
        onSuccess={handleSuccessEdit}
      />
    </>
  );
}
