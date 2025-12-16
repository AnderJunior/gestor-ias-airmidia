'use client';

import { useState } from 'react';

export function useSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAtendimentoId, setSelectedAtendimentoId] = useState<string | null>(null);

  const openSidebar = (atendimentoId: string) => {
    setSelectedAtendimentoId(atendimentoId);
    setIsOpen(true);
  };

  const closeSidebar = () => {
    setIsOpen(false);
    setSelectedAtendimentoId(null);
  };

  return {
    isOpen,
    selectedAtendimentoId,
    openSidebar,
    closeSidebar,
  };
}







