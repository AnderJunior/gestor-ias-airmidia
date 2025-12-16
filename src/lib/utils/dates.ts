export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Agora';
  }
  if (diffMins < 60) {
    return `${diffMins} min atrás`;
  }
  if (diffHours < 24) {
    return `${diffHours}h atrás`;
  }
  if (diffDays < 7) {
    return `${diffDays}d atrás`;
  }

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTimeTable(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}.${month}.${day} ${hours}:${minutes}`;
}

export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) {
    return 'Agora';
  } else if (diffMins >= 1 && diffMins < 5) {
    return `A ${diffMins} minutos`;
  } else if (diffMins >= 5 && diffMins < 10) {
    return 'A 5 minutos';
  } else if (diffMins >= 10 && diffMins < 30) {
    return 'A 10 minutos';
  } else if (diffMins >= 30 && diffMins < 60) {
    return 'A 30 minutos atrás';
  } else if (diffHours === 1) {
    return 'A 1 hora atrás';
  } else if (diffHours > 1 && diffHours < 3) {
    return `A ${diffHours} horas`;
  } else if (diffHours === 3) {
    return 'A 3 horas atrás';
  } else {
    // Se acima de 3 horas, mostrar data completa: dd/mm/yyyy hh:MM
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }
}

/**
 * Formata data no formato dd/mm/yyyy hh:MM
 * @param dateString - String da data em formato ISO
 * @returns String formatada como dd/mm/yyyy hh:MM
 */
export function formatSolicitadoEm(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

