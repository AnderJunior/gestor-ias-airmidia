import { StatusAtendimento } from '@/types/domain';

export function formatStatus(status: StatusAtendimento): string {
  const statusMap: Record<StatusAtendimento, string> = {
    aberto: 'Aberto',
    em_andamento: 'Em Andamento',
    encerrado: 'Encerrado',
  };
  return statusMap[status] || status;
}

export function getStatusColor(status: StatusAtendimento): string {
  const colorMap: Record<StatusAtendimento, string> = {
    aberto: 'bg-yellow-100 text-yellow-800',
    em_andamento: 'bg-blue-100 text-blue-800',
    encerrado: 'bg-green-100 text-green-800',
  };
  return colorMap[status] || 'bg-gray-100 text-gray-800';
}

export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}







