export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  ATENDIMENTO: '/atendimento',
  MENSAGENS: '/mensagens',
  CONFIGURACOES: '/configuracoes',
} as const;

export const STATUS_OPTIONS = [
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'encerrado', label: 'Finalizado' },
] as const;

