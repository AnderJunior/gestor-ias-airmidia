export type StatusAtendimento = 'aberto' | 'em_andamento' | 'encerrado';
export type StatusWhatsAppInstance = 'conectado' | 'desconectado' | 'conectando' | 'erro';

export interface WhatsAppInstance {
  id: string;
  usuario_id: string;
  telefone: string;
  instance_name?: string;
  evolution_api_instance_id?: string;
  status: StatusWhatsAppInstance;
  qr_code?: string;
  created_at: string;
  updated_at: string;
}

export interface Atendimento {
  id: string;
  cliente_id: string;
  cliente_nome?: string;
  cliente_foto_perfil?: string; // URL da foto de perfil do cliente
  telefone_cliente: string; // Número do telefone do cliente que está sendo atendido
  telefone_usuario: string; // Número do telefone do usuário que está fazendo o atendimento
  usuario_id?: string; // ID do usuário do sistema (opcional, pode ser identificado pelo telefone)
  status: StatusAtendimento;
  created_at: string;
  updated_at: string;
  ultima_mensagem?: string;
  ultima_mensagem_at?: string;
  resumo_conversa?: string; // Resumo do atendimento
}

export interface Mensagem {
  id: string;
  atendimento_id: string;
  conteudo: string;
  tipo: 'humano' | 'bot';
  telefone_remetente: string; // Número que enviou a mensagem
  telefone_destinatario: string; // Número que recebeu a mensagem
  message_id?: string; // ID da mensagem na Evolution API
  created_at: string;
}

export interface DashboardStats {
  totalAtendimentos: number;
  atendimentosAbertos: number;
  atendimentosEmAndamento: number;
  atendimentosEncerrados: number;
  totalMensagens: number;
}

export type StatusAgendamento = 'agendado' | 'confirmado' | 'cancelado' | 'concluido';

export interface Agendamento {
  id: string;
  cliente_id: string;
  cliente_nome?: string;
  cliente_foto_perfil?: string;
  telefone_cliente?: string;
  usuario_id: string;
  data_e_hora: string; // ISO string
  resumo_conversa?: string;
  link_agendamento?: string; // Link da reunião/agendamento
  status: StatusAgendamento;
  created_at: string;
  updated_at: string;
}

