'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, MessageSquare, Send, Calendar, User, FolderTree, FileText, Link2, ThumbsUp, Smile, ChevronDown, ChevronUp, Flag, Search as SearchIcon, Trash2, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { useModal } from '@/contexts/ModalContext'
import { cn } from '@/lib/utils'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { TarefaKanbanColuna } from '@/types/kanban.types'

type Cliente = {
  id: string
  nome: string
}

type Projeto = {
  id: string
  nome: string
}

type Tarefa = {
  id: string
  nome: string
  descricao: string | null
  status: string
  prioridade: 'urgente' | 'alta' | 'normal' | 'baixa' | null
  data_inicio: string | null
  data_vencimento: string | null
  cliente_id: string | null
  clientes?: Cliente | null
  projetos?: Projeto | null
  created_at: string
}

type Atividade = {
  id: string
  descricao: string
  created_at: string
}

type Comentario = {
  id: string
  comentario: string
  created_at: string
  user_id?: string | null
}

type AtividadeItem = 
  | (Atividade & { tipo: 'atividade' })
  | (Comentario & { tipo: 'comentario' })

interface TarefaDetailModalProps {
  isOpen: boolean
  onClose: () => void
  tarefa: Tarefa
  onUpdate?: () => void
  kanbanColumns: TarefaKanbanColuna[]
}

type StatusOption = {
  value: string
  label: string
  accent: string
}

export function TarefaDetailModal({ isOpen, onClose, tarefa, onUpdate, kanbanColumns }: TarefaDetailModalProps) {
  const { alert, confirm } = useModal()
  const [loading, setLoading] = useState(false)
  const [atividades, setAtividades] = useState<AtividadeItem[]>([])
  const [comentario, setComentario] = useState('')
  const [tarefaData, setTarefaData] = useState<Tarefa>(tarefa)
  const [originalTarefa, setOriginalTarefa] = useState<Tarefa>(tarefa)
  const [draftHasChanges, setDraftHasChanges] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    oldStatus: string
    newStatus: string
  } | null>(null)
  
  // Estados para edição
  const [editingNome, setEditingNome] = useState(false)
  const [editingStatus, setEditingStatus] = useState(false)
  const [editingCliente, setEditingCliente] = useState(false)
  const [editingPrioridade, setEditingPrioridade] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [searchCliente, setSearchCliente] = useState('')
  
  // Estados para calendário
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarType, setCalendarType] = useState<'inicio' | 'vencimento' | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  
  const calendarRef = useRef<HTMLDivElement>(null)
  const clienteRef = useRef<HTMLDivElement>(null)

  const loadAtividades = useCallback(async () => {
    const supabase = createClient()
    
    const [atividadesRes, comentariosRes] = await Promise.all([
      supabase
        .from('tarefas_atividades')
        .select('*')
        .eq('tarefa_id', tarefa.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('tarefas_comentarios')
        .select('*')
        .eq('tarefa_id', tarefa.id)
        .order('created_at', { ascending: true })
    ])

    const atividadesList: AtividadeItem[] = []
    
    if (atividadesRes.data) {
      atividadesList.push(...atividadesRes.data.map(a => ({ ...a, tipo: 'atividade' as const })))
    }
    
    if (comentariosRes.data) {
      atividadesList.push(...comentariosRes.data.map(c => ({ ...c, tipo: 'comentario' as const })))
    }

    atividadesList.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    setAtividades(atividadesList)
  }, [tarefa.id])

  // Função para salvar descrição
  const handleDescriptionChange = useCallback((newDescription: string) => {
    setTarefaData((prev) => ({ ...prev, descricao: newDescription || null }))
    setDraftHasChanges(true)
  }, [])

  // Editor de texto rico para descrição
  const descriptionEditor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary-600 underline',
        },
      }),
      Placeholder.configure({
        placeholder: 'Digite sua descrição aqui... Você pode colar imagens, links e formatar o texto.',
      }),
    ],
    content: tarefaData.descricao || '<p></p>',
    editable: true,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const cleanHtml = html === '<p></p>' ? '' : html
      if (cleanHtml !== tarefaData.descricao) {
        handleDescriptionChange(cleanHtml)
      }
    },
    editorProps: {
      handlePaste: (view, event) => {
        const items = Array.from(event.clipboardData?.items || [])
        const imageItem = items.find(item => item.type.startsWith('image/'))
        
        if (imageItem) {
          event.preventDefault()
          const file = imageItem.getAsFile()
          if (file) {
            const reader = new FileReader()
            reader.onload = (e) => {
              const src = e.target?.result as string
              if (src) {
                descriptionEditor?.chain().focus().setImage({ src }).run()
              }
            }
            reader.readAsDataURL(file)
          }
          return true
        }
        return false
      },
      handleDrop: (view, event) => {
        const items = Array.from(event.dataTransfer?.items || [])
        const imageItem = items.find(item => item.type.startsWith('image/'))
        
        if (imageItem) {
          event.preventDefault()
          const file = imageItem.getAsFile()
          if (file) {
            const reader = new FileReader()
            reader.onload = (e) => {
              const src = e.target?.result as string
              if (src) {
                const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY })
                if (coordinates) {
                  descriptionEditor?.chain().focus().setImage({ src }).run()
                }
              }
            }
            reader.readAsDataURL(file)
          }
          return true
        }
        return false
      },
    },
  })

  // Atualizar conteúdo do editor quando tarefaData.descricao mudar externamente
  useEffect(() => {
    if (descriptionEditor && tarefaData.descricao !== descriptionEditor.getHTML()) {
      descriptionEditor.commands.setContent(tarefaData.descricao || '')
    }
  }, [tarefaData.descricao, descriptionEditor])

  // Cleanup do editor quando o componente for desmontado
  useEffect(() => {
    return () => {
      if (descriptionEditor) {
        descriptionEditor.destroy()
      }
    }
  }, [descriptionEditor])

  const loadClientes = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .order('nome')
    
    if (data) {
      setClientes(data)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      setTarefaData(tarefa)
      setOriginalTarefa(tarefa)
      setDraftHasChanges(false)
      setPendingStatusChange(null)
      setEditingNome(false)
      loadAtividades()
      loadClientes()
      
      // Buscar usuário atual
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => {
        setCurrentUserId(user?.id || null)
      })
    }
  }, [isOpen, tarefa, loadAtividades, loadClientes])

  // Focar no select quando entrar no modo de edição
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showCalendar && calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false)
        setCalendarType(null)
      }
      if (editingCliente && clienteRef.current && !clienteRef.current.contains(event.target as Node)) {
        setEditingCliente(false)
        setSearchCliente('')
      }
      if (editingPrioridade && !(event.target as HTMLElement).closest('[data-prioridade-menu]')) {
        setEditingPrioridade(false)
      }
      if (editingStatus && !(event.target as HTMLElement).closest('select') && !(event.target as HTMLElement).closest('[data-status-container]')) {
        setEditingStatus(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCalendar, editingCliente, editingPrioridade, editingStatus])

  const handleStatusChange = (newStatus: string) => {
    if (tarefaData.status === newStatus) {
      setEditingStatus(false)
      return
    }

    setTarefaData((prev) => ({
      ...prev,
      status: newStatus,
    }))
    setDraftHasChanges(true)
    setPendingStatusChange((prev) => ({
      oldStatus: prev?.oldStatus || originalTarefa.status,
      newStatus,
    }))
    setEditingStatus(false)
  }

  const handleClienteChange = (clienteId: string | null) => {
    const cliente = clienteId ? clientes.find((c) => c.id === clienteId) : null
    setTarefaData((prev) => ({
      ...prev,
      cliente_id: clienteId,
      clientes: cliente || null,
    }))
    setDraftHasChanges(true)
    setEditingCliente(false)
  }

  const handlePrioridadeChange = (prioridade: string | null) => {
    setTarefaData((prev) => ({
      ...prev,
      prioridade: prioridade as Tarefa['prioridade'],
    }))
    setDraftHasChanges(true)
    setEditingPrioridade(false)
  }

  const handleDateChange = (date: Date | null, type: 'inicio' | 'vencimento') => {
    let formattedDate: string | null = null
    if (date) {
      // Usar valores locais para evitar problemas de timezone
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      
      if (type === 'vencimento') {
        // Para data_vencimento (TIMESTAMP WITH TIME ZONE), adicionar hora 12:00 no timezone local
        // Isso evita problemas de conversão de timezone
        // Criar uma nova data com hora 12:00 local usando valores numéricos
        const dateWithTime = new Date(year, date.getMonth(), date.getDate(), 12, 0, 0)
        // Converter para ISO string que será interpretada corretamente pelo PostgreSQL
        formattedDate = dateWithTime.toISOString()
      } else {
        // Para data_inicio (DATE), usar apenas a data
        formattedDate = `${year}-${month}-${day}`
      }
    }
    setTarefaData((prev) => ({
      ...prev,
      data_inicio: type === 'inicio' ? formattedDate : prev.data_inicio,
      data_vencimento: type === 'vencimento' ? formattedDate : prev.data_vencimento,
    }))
    setDraftHasChanges(true)
    setShowCalendar(false)
    setCalendarType(null)
  }

  const handleComentarioSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!comentario.trim()) return

    setLoading(true)
    const supabase = createClient()
    
    const { error } = await supabase
      .from('tarefas_comentarios')
      .insert([{
        tarefa_id: tarefa.id,
        comentario: comentario.trim(),
      }])

    if (!error) {
      setComentario('')
      await loadAtividades()
    } else {
      await alert('Erro ao adicionar comentário: ' + error.message, 'Erro')
    }
    setLoading(false)
  }

  const handleDeleteComentario = async (comentarioId: string) => {
    const confirmed = await confirm(
      'Tem certeza que deseja excluir este comentário?',
      'Confirmar exclusão',
      'Excluir',
      'Cancelar',
      'danger'
    )
    
    if (!confirmed) return

    setLoading(true)
    const supabase = createClient()
    
    const { error } = await supabase
      .from('tarefas_comentarios')
      .delete()
      .eq('id', comentarioId)

    if (!error) {
      await loadAtividades()
    } else {
      await alert('Erro ao excluir comentário: ' + error.message, 'Erro')
    }
    setLoading(false)
  }

  const getStatusLabel = (statusId: string | null) => {
    const column = kanbanColumns.find((coluna: TarefaKanbanColuna) => coluna.id === statusId)
    return column?.nome || 'Sem status'
  }

  const statusOptions: StatusOption[] = kanbanColumns.map((coluna) => ({
    value: coluna.id,
    label: coluna.nome,
    accent: coluna.cor,
  }))

  const getStatusBadge = (statusId: string | null) => {
    const column = kanbanColumns.find((coluna: TarefaKanbanColuna) => coluna.id === statusId)
    if (column) {
      return {
        label: column.nome,
        style: {
          color: column.cor,
          borderColor: column.cor,
          backgroundColor: `${column.cor}1a`,
        },
      }
    }

    return {
      label: 'Sem status',
      style: {
        color: '#374151',
        borderColor: 'transparent',
        backgroundColor: '#f5f5f5',
      },
    }
  }

  const getPrioridadeBadge = (prioridade: string | null) => {
    const prioridadeMap: Record<string, { label: string; className: string; iconColor: string }> = {
      urgente: { label: 'Urgente', className: 'bg-red-50 text-red-700 p-[2px]', iconColor: 'text-red-600' },
      alta: { label: 'Alta', className: 'bg-orange-50 text-orange-700 p-[2px]', iconColor: 'text-orange-600' },
      normal: { label: 'Normal', className: 'bg-blue-50 text-blue-700 p-[2px]', iconColor: 'text-blue-600' },
      baixa: { label: 'Baixa', className: 'bg-gray-50 text-gray-700 p-[2px]', iconColor: 'text-gray-600' },
    }
    return prioridadeMap[prioridade || ''] || { label: 'Vazio', className: 'text-gray-500', iconColor: 'text-gray-400' }
  }

  const formatTimeAgo = (date: string) => {
    const now = new Date()
    const past = new Date(date)
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000)
    const threeHoursInSeconds = 3 * 3600
    
    if (diffInSeconds < threeHoursInSeconds) {
      if (diffInSeconds < 60) return 'Agora há pouco'
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minuto${Math.floor(diffInSeconds / 60) > 1 ? 's' : ''}`
      return `${Math.floor(diffInSeconds / 3600)} hora${Math.floor(diffInSeconds / 3600) > 1 ? 's' : ''}`
    }
    
    const day = past.getDate()
    const month = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][past.getMonth()]
    const hour = past.getHours().toString().padStart(2, '0')
    const minute = past.getMinutes().toString().padStart(2, '0')
    return `${day} ${month} às ${hour}:${minute}`
  }

  const renderTextWithLinks = (text: string) => {
    // Regex para detectar URLs (http, https, www, ou protocolos comuns)
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/g
    const parts: (string | { type: 'link'; url: string; text: string })[] = []
    let lastIndex = 0
    let match

    while ((match = urlRegex.exec(text)) !== null) {
      // Adicionar texto antes do link
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index))
      }

      // Processar o link
      let url = match[0]
      let displayText = match[0]

      // Adicionar https:// se começar com www
      if (url.startsWith('www.')) {
        url = 'https://' + url
      }

      parts.push({ type: 'link', url, text: displayText })
      lastIndex = match.index + match[0].length
    }

    // Adicionar texto restante
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex))
    }

    // Se não encontrou nenhum link, retorna o texto original
    if (parts.length === 0) {
      return text
    }

    // Renderizar os elementos
    return parts.map((part, index) => {
      if (typeof part === 'string') {
        return <span key={index}>{part}</span>
      } else {
        return (
          <a
            key={index}
            href={part.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:text-primary-700 underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part.text}
          </a>
        )
      }
    })
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    // Ajustar para segunda-feira ser o primeiro dia (0 = domingo, 1 = segunda, etc.)
    const dayOfWeek = firstDay.getDay()
    const startingDayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    
    return { daysInMonth, startingDayOfWeek, year, month }
  }

  const getNextMonday = (base: Date) => {
    const date = new Date(base)
    const day = date.getDay()
    let diff = (8 - day) % 7
    if (diff === 0) diff = 7
    date.setDate(date.getDate() + diff)
    return date
  }

  const getSameDayNextMonth = (base: Date) => {
    const date = new Date(base)
    const day = date.getDate()
    date.setMonth(date.getMonth() + 1)

    if (date.getDate() !== day) {
      // Ajustar para o último dia do mês, se necessário
      date.setDate(0)
    }

    return date
  }

  const saveChanges = useCallback(async () => {
    if (!draftHasChanges) return true

    setLoading(true)
    const supabase = createClient()
    const updateData: Record<string, any> = {}

    if (tarefaData.status !== originalTarefa.status) {
      updateData.status = tarefaData.status
    }
    if (tarefaData.cliente_id !== originalTarefa.cliente_id) {
      updateData.cliente_id = tarefaData.cliente_id
    }
    if (tarefaData.prioridade !== originalTarefa.prioridade) {
      updateData.prioridade = tarefaData.prioridade
    }
    if (tarefaData.data_inicio !== originalTarefa.data_inicio) {
      updateData.data_inicio = tarefaData.data_inicio
    }
    if (tarefaData.data_vencimento !== originalTarefa.data_vencimento) {
      updateData.data_vencimento = tarefaData.data_vencimento
    }
    if (tarefaData.descricao !== originalTarefa.descricao) {
      updateData.descricao = tarefaData.descricao
    }
    if (tarefaData.nome !== originalTarefa.nome) {
      updateData.nome = tarefaData.nome
    }

    let saved = true
    try {
      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from('tarefas')
          .update(updateData)
          .eq('id', tarefa.id)

        if (error) {
          await alert('Erro ao salvar alterações: ' + error.message, 'Erro')
          saved = false
        }
      }

      if (saved && pendingStatusChange && pendingStatusChange.oldStatus !== pendingStatusChange.newStatus) {
        await supabase
          .from('tarefas_atividades')
          .insert([{
            tarefa_id: tarefa.id,
            tipo: 'status',
            campo_alterado: 'status',
            valor_anterior: pendingStatusChange.oldStatus,
            valor_novo: pendingStatusChange.newStatus,
            descricao: `Status alterado de ${getStatusLabel(pendingStatusChange.oldStatus)} para ${getStatusLabel(pendingStatusChange.newStatus)}`,
          }])
      }

      if (saved) {
        setOriginalTarefa(tarefaData)
        setDraftHasChanges(false)
        setPendingStatusChange(null)
        await loadAtividades()
        onUpdate?.()
      }
    } catch (error) {
      await alert('Erro ao salvar alterações: ' + (error instanceof Error ? error.message : 'Erro desconhecido'), 'Erro')
      saved = false
    } finally {
      setLoading(false)
    }

    return saved
  }, [alert, draftHasChanges, loadAtividades, onUpdate, originalTarefa, pendingStatusChange, tarefa.id, tarefaData])

  const handleDelete = useCallback(async () => {
    const confirmed = await confirm(
      `Tem certeza que deseja excluir a tarefa "${tarefaData.nome}"?\n\nEsta ação não pode ser desfeita.`,
      'Confirmar exclusão',
      'Excluir',
      'Cancelar',
      'danger'
    )
    
    if (!confirmed) return

    setLoading(true)
    const supabase = createClient()
    
    const { error } = await supabase
      .from('tarefas')
      .delete()
      .eq('id', tarefa.id)

    if (error) {
      await alert('Erro ao excluir tarefa: ' + error.message, 'Erro')
      setLoading(false)
      return
    }

    setLoading(false)
    onUpdate?.()
    onClose()
  }, [confirm, tarefa.id, tarefaData.nome, alert, onUpdate, onClose])

  const handleModalClose = useCallback(() => {
    void (async () => {
      const saved = await saveChanges()
      if (saved) {
        onClose()
      }
    })()
  }, [onClose, saveChanges])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleModalClose()
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleEscape)
    }

    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, handleModalClose])

  // Função auxiliar para normalizar data_vencimento (TIMESTAMP) para exibição
  const normalizeVencimentoDate = (dateStr: string | null): string | null => {
    if (!dateStr) return null
    // Se for TIMESTAMP (contém 'T'), extrair apenas a data
    if (dateStr.includes('T')) {
      return dateStr.split('T')[0]
    }
    return dateStr
  }

  if (!isOpen) return null

  // Preparar dados para renderização
  const statusBadge = getStatusBadge(tarefaData.status)
  const prioridadeBadge = getPrioridadeBadge(tarefaData.prioridade)
  const createdDate = new Date(tarefaData.created_at)
  const day = createdDate.getDate()
  const monthName = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][createdDate.getMonth()]
  const { daysInMonth, startingDayOfWeek, year, month: currentMonthIndex } = getDaysInMonth(currentMonth)
  const weekdays = ['2ª', '3ª', '4ª', '5ª', '6ª', 'sáb', 'do']
  const filteredClientes = searchCliente
    ? clientes.filter(c => c.nome.toLowerCase().includes(searchCliente.toLowerCase()))
    : clientes

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          void handleModalClose()
        }
      }}
    >
      <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm" />

      <div
        className="relative bg-white rounded-lg shadow-2xl w-full max-w-[95vw] h-[95vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Tarefa</span>
              <span className="text-sm font-mono text-gray-400">{tarefaData.id.substring(0, 8)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleDelete()}
              disabled={loading}
              className="text-red-400 hover:text-red-600 transition-colors p-1 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Excluir tarefa"
              title="Excluir tarefa"
            >
              <Trash2 className="w-6 h-6" />
            </button>
            <button
              onClick={() => void handleModalClose()}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
              aria-label="Fechar modal"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Detalhes */}
          <div className="flex-1 overflow-y-auto p-6 border-r border-gray-200">
            <div className="flex items-center gap-2 mb-6">
              {editingNome ? (
                <input
                  type="text"
                  value={tarefaData.nome}
                  onChange={(e) => {
                    setTarefaData((prev) => ({ ...prev, nome: e.target.value }))
                    setDraftHasChanges(true)
                  }}
                  onBlur={() => setEditingNome(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur()
                    } else if (e.key === 'Escape') {
                      setTarefaData((prev) => ({ ...prev, nome: originalTarefa.nome }))
                      setDraftHasChanges(false)
                      setEditingNome(false)
                    }
                  }}
                  className="text-3xl font-bold text-gray-900 flex-1 border-2 border-primary-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
              ) : (
                <>
                  <h1 className="text-3xl font-bold text-gray-900">{tarefaData.nome}</h1>
                  <button
                    onClick={() => setEditingNome(true)}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                    aria-label="Editar nome da tarefa"
                    title="Editar nome da tarefa"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            {/* Campos Editáveis - Duas Colunas */}
            <div className="grid grid-cols-[minmax(260px,320px)_minmax(220px,1fr)] gap-20 mb-4 items-start">
              {/* Coluna Esquerda */}
              <div className="space-y-3">
                {/* Status */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-black w-[50px]">Status</label>
                  <div className="flex-1 relative" data-status-container>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setEditingStatus(true)
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-lg border font-medium text-sm flex items-center justify-between"
                      style={statusBadge.style}
                    >
                      <span>{statusBadge.label}</span>
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    {editingStatus && (
                      <div className="absolute top-full left-0 mt-2 w-full z-[9999] rounded-lg border border-gray-200 bg-white shadow-xl overflow-hidden">
                        {statusOptions.map((option: StatusOption) => (
                        <button
                          key={option.value}
                          onClick={() => handleStatusChange(option.value)}
                          className={cn(
                            "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between",
                            tarefaData.status === option.value ? 'font-semibold' : 'text-gray-900'
                          )}
                          style={
                            tarefaData.status === option.value
                              ? {
                                  color: option.accent,
                                  backgroundColor: `${option.accent}1a`,
                                  borderColor: option.accent,
                                }
                              : undefined
                          }
                        >
                            <span>{option.label}</span>
                            {tarefaData.status === option.value && (
                              <span className="text-xs text-gray-500">Selecionado</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Datas */}
                <div className="flex items-center gap-3 relative" ref={calendarRef}>
                  <label className="text-sm font-medium text-black w-[50px]">Datas</label>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setShowCalendar(!showCalendar)
                          setCalendarType('inicio')
                        }}
                        className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 whitespace-nowrap"
                      >
                        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span>{tarefaData.data_inicio ? formatDate(tarefaData.data_inicio) : 'Data inicial'}</span>
                      </button>
                      {tarefaData.data_inicio && (
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleDateChange(null, 'inicio')
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50 flex-shrink-0"
                          title="Limpar data inicial"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <span className="text-gray-400 flex-shrink-0">→</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setShowCalendar(!showCalendar)
                          setCalendarType('vencimento')
                        }}
                        className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 whitespace-nowrap"
                      >
                        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span>{tarefaData.data_vencimento ? formatDate(tarefaData.data_vencimento) : 'Data de vencimento'}</span>
                      </button>
                      {tarefaData.data_vencimento && (
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleDateChange(null, 'vencimento')
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50 flex-shrink-0"
                          title="Limpar data de vencimento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {showCalendar && calendarType && (
                    <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-4 w-[520px] text-gray-700" onClick={(e) => e.stopPropagation()}>
                      <div className="grid grid-cols-2 gap-4">
                        {/* Presets */}
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-gray-600 uppercase mb-2">Rápido</div>
                          {[
                            {
                              label: 'Hoje',
                              getDate: (base: Date) => new Date(base),
                            },
                            {
                              label: 'Amanhã',
                              getDate: (base: Date) => {
                                const date = new Date(base)
                                date.setDate(date.getDate() + 1)
                                return date
                              },
                            },
                            {
                              label: 'Próxima segunda',
                              getDate: (base: Date) => getNextMonday(base),
                            },
                            {
                              label: 'Mês que vem',
                              getDate: (base: Date) => getSameDayNextMonth(base),
                            },
                          ].map((preset) => {
                            const today = new Date()
                            const date = preset.getDate(today)
                            return (
                              <button
                                key={preset.label}
                                onClick={() => handleDateChange(date, calendarType)}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded flex items-center justify-between"
                              >
                                <span>{preset.label}</span>
                              </button>
                            )
                          })}
                        </div>

                        {/* Calendar */}
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div className="text-sm font-semibold text-gray-900 capitalize">
                              {['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'][currentMonthIndex]} {year}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleDateChange(null, calendarType)
                                }}
                                className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                                title="Limpar data"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <div className="flex flex-col gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                                  className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                                  aria-label="Mês anterior"
                                >
                                  <ChevronUp className="w-3 h-3 text-gray-500" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                                  className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                                  aria-label="Próximo mês"
                                >
                                  <ChevronDown className="w-3 h-3 text-gray-500" />
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-7 gap-1 mb-2">
                            {weekdays.map(day => (
                              <div key={day} className="text-xs text-gray-600 text-center py-1">{day}</div>
                            ))}
                          </div>
                          <div className="grid grid-cols-7 gap-1">
                            {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                              <div key={`empty-${i}`} className="aspect-square" />
                            ))}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                              const day = i + 1
                              const date = new Date(year, currentMonthIndex, day)
                              const isToday = date.toDateString() === new Date().toDateString()
                              // Formatar data usando valores locais para comparação
                              const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                              
                              // Para data_vencimento (TIMESTAMP), extrair apenas a data para comparação
                              let vencimentoDateStr = tarefaData.data_vencimento
                              if (vencimentoDateStr && vencimentoDateStr.includes('T')) {
                                vencimentoDateStr = vencimentoDateStr.split('T')[0]
                              }
                              
                              const isSelected = calendarType === 'inicio' 
                                ? tarefaData.data_inicio === dateStr
                                : vencimentoDateStr === dateStr
                              
                              return (
                                <button
                                  key={day}
                                  onClick={() => handleDateChange(date, calendarType)}
                                  className={cn(
                                    "aspect-square text-sm rounded hover:bg-gray-100 transition-colors text-gray-700",
                                    isToday && "font-semibold",
                                    isSelected && "bg-primary-600 text-white hover:bg-primary-700"
                                  )}
                                >
                                  {day}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Coluna Direita */}
              <div className="space-y-2 max-w-[400px]">
                {/* Cliente Âncora */}
                <div className="flex items-center gap-2 relative" ref={clienteRef}>
                  <label className="text-sm font-medium text-black w-[100px]">Cliente Âncora</label>
                  <div className="flex-1 relative">
                    <button
                      onClick={() => {
                        setEditingCliente(true)
                        setSearchCliente('')
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 flex items-center gap-2"
                    >
                      {tarefaData.clientes ? (
                        <>
                          <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-medium">
                            {tarefaData.clientes.nome.charAt(0).toUpperCase()}
                          </div>
                          <span>{tarefaData.clientes.nome}</span>
                        </>
                      ) : (
                        <span className="text-gray-500">Selecionar cliente</span>
                      )}
                      <ChevronDown className="w-4 h-4 ml-auto text-gray-400" />
                    </button>
                    {editingCliente && (
                      <div className="absolute top-full left-0 mt-2 w-full z-[9999]">
                        <div className="border border-gray-300 rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                          <div className="p-2 border-b border-gray-200 bg-white">
                            <div className="relative">
                              <SearchIcon className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                              <input
                                type="text"
                                value={searchCliente}
                                onChange={(e) => setSearchCliente(e.target.value)}
                                placeholder="Pesquisar cliente..."
                                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 bg-white"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </div>
                          <div className="max-h-60 overflow-y-auto bg-white">
                            <button
                              onClick={() => handleClienteChange(null)}
                              className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-100 bg-white"
                            >
                              Nenhum cliente
                            </button>
                            {filteredClientes.map((cliente) => (
                              <button
                                key={cliente.id}
                                onClick={() => handleClienteChange(cliente.id)}
                                className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-100 flex items-center gap-2 bg-white"
                              >
                                <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-medium">
                                  {cliente.nome.charAt(0).toUpperCase()}
                                </div>
                                <span>{cliente.nome}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Prioridade */}
                <div className="flex items-center gap-2 relative">
                  <label className="text-sm font-medium text-black w-[100px]">Prioridade</label>
                  <div className="flex-1 relative">
                    <button
                      onClick={() => setEditingPrioridade(true)}
                      className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2"
                    >
                      {tarefaData.prioridade ? (
                        <>
                          <Flag className={cn("w-4 h-4", prioridadeBadge.iconColor)} />
                          <span className={prioridadeBadge.className}>{prioridadeBadge.label}</span>
                        </>
                      ) : (
                        <span className="text-gray-500">Vazio</span>
                      )}
                      <ChevronDown className="w-4 h-4 ml-auto text-gray-400" />
                    </button>
                    {editingPrioridade && (
                      <div className="absolute top-full left-0 mt-2 w-full z-[9999]" data-prioridade-menu>
                        <div className="border border-gray-300 rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                          {[
                            { value: 'urgente', label: 'Urgente', color: 'text-red-600' },
                            { value: 'alta', label: 'Alta', color: 'text-orange-600' },
                            { value: 'normal', label: 'Normal', color: 'text-blue-600' },
                            { value: 'baixa', label: 'Baixa', color: 'text-gray-600' },
                          ].map((prioridade) => (
                            <button
                              key={prioridade.value}
                              onClick={() => handlePrioridadeChange(prioridade.value)}
                              className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-100 flex items-center gap-2 bg-white"
                            >
                              <Flag className={cn("w-4 h-4", prioridade.color)} />
                              <span>{prioridade.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Descrição - Editor de Texto Rico */}
            <div className="mb-6">
              {descriptionEditor ? (
                <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                  <div className="p-2 bg-white border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => descriptionEditor.chain().focus().toggleBold().run()}
                        disabled={loading}
                        className={`px-2 py-1 text-sm font-semibold rounded border border-transparent bg-white text-gray-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:opacity-40 disabled:cursor-not-allowed ${
                          descriptionEditor.isActive('bold') ? 'bg-gray-100 text-gray-900 border-gray-200' : 'hover:border-gray-200'
                        }`}
                        title="Negrito"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() => descriptionEditor.chain().focus().toggleItalic().run()}
                        disabled={loading}
                        className={`px-2 py-1 text-sm italic rounded border border-transparent bg-white text-gray-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:opacity-40 disabled:cursor-not-allowed ${
                          descriptionEditor.isActive('italic') ? 'bg-gray-100 text-gray-900 border-gray-200' : 'hover:border-gray-200'
                        }`}
                        title="Itálico"
                      >
                        I
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (descriptionEditor.isActive('link')) {
                            descriptionEditor.chain().focus().unsetLink().run()
                          } else {
                            const url = window.prompt('Digite a URL do link:')
                            if (url) {
                              descriptionEditor.chain().focus().setLink({ href: url }).run()
                            }
                          }
                        }}
                        disabled={loading}
                        className={`px-2 py-1 text-sm rounded border border-transparent bg-white text-gray-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:opacity-40 disabled:cursor-not-allowed ${
                          descriptionEditor.isActive('link') ? 'bg-gray-100 text-gray-900 border-gray-200' : 'hover:border-gray-200'
                        }`}
                        title={descriptionEditor.isActive('link') ? 'Remover link' : 'Adicionar link'}
                      >
                        🔗
                      </button>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            const reader = new FileReader()
                            reader.onload = (event) => {
                              const src = event.target?.result as string
                              if (src) {
                                descriptionEditor.chain().focus().setImage({ src }).run()
                              }
                            }
                            reader.readAsDataURL(file)
                          }
                          e.target.value = '' // Reset input
                        }}
                        disabled={loading}
                        className="hidden"
                        id="tarefa-image-upload"
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById('tarefa-image-upload')?.click()}
                        disabled={loading}
                        className="px-2 py-1 text-sm rounded border border-transparent bg-white text-gray-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 focus-visible:ring-offset-white hover:border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Inserir imagem"
                      >
                        🖼️
                      </button>
                    </div>
                  </div>
                  <div
                    className="p-3 min-h-[200px] max-h-[400px] overflow-y-auto cursor-text bg-white outline-none"
                    onClick={() => descriptionEditor.commands.focus()}
                  >
                    <EditorContent editor={descriptionEditor} className="tarefa-description-editor" />
                  </div>
                </div>
              ) : (
                <div className="border border-gray-300 rounded-lg p-3 min-h-[200px] flex items-center justify-center text-gray-500">
                  Carregando editor...
                </div>
              )}
            </div>

          </div>

          {/* Right Panel - Atividades */}
          <div className="w-[400px] border-l border-gray-200 flex flex-col bg-gray-50">
            <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Atividade</h3>
              <div className="text-sm text-gray-500">
                Criada em {day} {monthName}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {atividades.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-8">
                  Nenhuma atividade ainda
                </div>
              ) : (
                atividades.map((item) => {
                  if (item.tipo === 'comentario') {
                    const comentario = item as Comentario & { tipo: 'comentario' }
                    const isOwner = currentUserId && comentario.user_id === currentUserId
                    return (
                      <div key={comentario.id} className="bg-white rounded-lg p-4 border border-gray-200" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                            A
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">Anderson Andrade</span>
                                <span className="text-xs text-gray-500">{formatTimeAgo(comentario.created_at)}</span>
                              </div>
                              {isOwner && (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    void handleDeleteComentario(comentario.id)
                                  }}
                                  disabled={loading}
                                  className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  aria-label="Excluir comentário"
                                  title="Excluir comentário"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            <div className="text-sm text-gray-700 break-words">{renderTextWithLinks(comentario.comentario)}</div>
                          </div>
                        </div>
                      </div>
                    )
                  } else {
                    const atividade = item as Atividade & { tipo: 'atividade' }
                    return (
                      <div key={atividade.id} className="flex items-start gap-2">
                        <span className="text-gray-400 text-sm">•</span>
                        <div className="flex-1">
                          <div className="text-sm text-gray-700 opacity-70">{atividade.descricao}</div>
                          <div className="text-xs text-gray-500 opacity-60 mt-0.5">
                            {formatTimeAgo(atividade.created_at)}
                          </div>
                        </div>
                      </div>
                    )
                  }
                })
              )}
            </div>

            {/* Comentário Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <form onSubmit={handleComentarioSubmit} onClick={(e) => e.stopPropagation()} className="space-y-2">
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Escreva um comentário..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none text-sm"
                  disabled={loading}
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
                    disabled={loading || !comentario.trim()}
                    className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
