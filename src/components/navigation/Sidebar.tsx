'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';
import { useUsuario } from '@/hooks/useUsuario';
import { DashboardIcon, ChatIcon, LogoutIcon } from '@/components/icons/NavIcons';
import React from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { usuario: usuarioData } = useUsuario();

  const navItems: NavItem[] = [
    { href: ROUTES.DASHBOARD, label: 'Dashboard', icon: <DashboardIcon /> },
    { href: ROUTES.ATENDIMENTO, label: 'Atendimento', icon: <ChatIcon /> },
  ];

  // Função para extrair primeiro e último nome
  const getPrimeiroUltimoNome = () => {
    if (!usuarioData?.nome) {
      return 'Usuário';
    }

    const nomes = usuarioData.nome.trim().split(/\s+/);
    if (nomes.length === 1) {
      return nomes[0];
    }
    // Retorna primeiro e último nome
    return `${nomes[0]} ${nomes[nomes.length - 1]}`;
  };

  // Função para formatar telefone para exibição
  const formatarTelefoneExibicao = (telefone: string | null) => {
    if (!telefone) {
      return 'Não configurado';
    }

    // Remove tudo que não é número
    const numeros = telefone.replace(/\D/g, '');
    
    // Formata como (99) 99999-9999
    if (numeros.length === 11) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
    } else if (numeros.length === 10) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
    }
    
    return telefone;
  };

  const getUserInitials = () => {
    if (usuarioData?.nome) {
      const nomes = usuarioData.nome.trim().split(/\s+/);
      const primeiraLetra = nomes[0].charAt(0).toUpperCase();
      return primeiraLetra;
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  return (
    <aside className="w-72 min-h-screen flex flex-col shadow-lg" style={{ backgroundColor: '#ffffff' }}>
      {/* Perfil do Usuário */}
      <div className="p-6 border-b" style={{ borderColor: '#F3F4F6' }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold text-lg shadow-md">
            {getUserInitials()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {getPrimeiroUltimoNome()}
            </h3>
            <p className="text-xs text-gray-500 truncate">
              {formatarTelefoneExibicao(usuarioData?.telefone_ia || null)}
            </p>
          </div>
        </div>
      </div>
      
      {/* Navegação */}
      <nav className="flex-1 p-6 overflow-y-auto scrollbar-hide">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-primary-50'
                  }`}
                >
                  <span className={`flex items-center justify-center ${isActive ? 'text-white drop-shadow-sm' : 'text-gray-600'}`}>
                    {item.icon}
                  </span>
                  <span className="text-sm font-medium flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="bg-primary-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Botão de Sair */}
      <div className="p-6 border-t border-primary-100">
        <button
          onClick={signOut}
          className="group w-full text-left px-3 py-2.5 rounded-lg text-gray-700 hover:bg-red-600 hover:text-white transition-all duration-200 text-sm font-medium flex items-center gap-3"
        >
          <span className="flex items-center justify-center text-gray-600 group-hover:text-white transition-colors duration-200">
            <LogoutIcon />
          </span>
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}

