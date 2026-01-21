# Documentação Completa do Sistema - Gestor IA Air Midia

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura e Tecnologias](#arquitetura-e-tecnologias)
3. [Estrutura de Pastas](#estrutura-de-pastas)
4. [Design System](#design-system)
5. [Layout e Navegação](#layout-e-navegação)
6. [Funcionalidades Principais](#funcionalidades-principais)
7. [Componentes UI](#componentes-ui)
8. [Hooks Customizados](#hooks-customizados)
9. [APIs e Integrações](#apis-e-integrações)
10. [Tipos e Interfaces](#tipos-e-interfaces)
11. [Fluxos Principais](#fluxos-principais)
12. [Autenticação e Segurança](#autenticação-e-segurança)

---

## Visão Geral

O **Gestor IA Air Midia** é um sistema web completo de gestão de atendimentos e agendamentos via WhatsApp, desenvolvido para facilitar a comunicação entre empresas e clientes através de uma interface moderna e intuitiva.

### Características Principais

- **Sistema de Atendimento**: Gerenciamento completo de atendimentos humanos solicitados via WhatsApp
- **Sistema de Agendamentos**: Gestão de agendamentos com visualização em calendário
- **Dashboard Analítico**: Métricas e gráficos de desempenho
- **Mensagens em Tempo Real**: Chat estilo WhatsApp com suporte a texto, imagens, áudio e documentos
- **Múltiplos Usuários**: Suporte a diferentes tipos de usuários (atendimento, agendamento, administração)
- **Integração WhatsApp**: Conexão via Evolution API para recebimento e envio de mensagens

---

## Arquitetura e Tecnologias

### Stack Tecnológico

#### Frontend
- **Next.js 14** (App Router) - Framework React com roteamento baseado em arquivos
- **React 18** - Biblioteca para construção de interfaces
- **TypeScript** - Tipagem estática para maior segurança de código
- **Tailwind CSS** - Framework CSS utility-first para estilização
- **Lucide React** - Biblioteca de ícones moderna

#### Backend & Banco de Dados
- **Supabase** - Backend-as-a-Service
  - PostgreSQL (banco de dados)
  - Autenticação (email/senha)
  - Row Level Security (RLS)
  - Realtime subscriptions
- **Evolution API** - Integração WhatsApp

#### Bibliotecas Adicionais
- **Recharts** - Gráficos e visualizações
- **ApexCharts** - Gráficos avançados
- **date-fns** - Manipulação e formatação de datas

### Estrutura de Arquitetura

```
┌─────────────────┐
│   Next.js App   │
│   (Frontend)    │
└────────┬────────┘
         │
         ├─── Supabase (Auth + Database)
         │
         └─── Evolution API (WhatsApp)
```

---

## Estrutura de Pastas

```
gestor-ias-airmidia/
├── public/                          # Arquivos estáticos
│   ├── logotipo-air-midia.webp     # Logo da empresa
│   └── sons/                        # Sons do sistema
│       └── blip-131856.mp3         # Som de notificação
│
├── src/
│   ├── app/                         # App Router do Next.js
│   │   ├── (auth)/                  # Grupo de rotas de autenticação
│   │   │   ├── layout.tsx          # Layout de autenticação
│   │   │   ├── login/              # Página de login
│   │   │   │   ├── page.tsx
│   │   │   │   └── LoginForm.tsx
│   │   │   └── reset-password/     # Reset de senha
│   │   │
│   │   ├── (private)/              # Grupo de rotas privadas
│   │   │   ├── layout.tsx          # Layout principal (Sidebar + Topbar)
│   │   │   ├── dashboard/          # Dashboard principal
│   │   │   ├── atendimento/        # Página de atendimentos
│   │   │   │   └── components/     # Componentes específicos
│   │   │   │       ├── AtendimentoList.tsx
│   │   │   │       ├── AtendimentoKanban.tsx
│   │   │   │       ├── AtendimentoCalendar.tsx
│   │   │   │       ├── AtendimentoItem.tsx
│   │   │   │       └── AtendimentoSidebar.tsx
│   │   │   ├── mensagens/          # Página de mensagens
│   │   │   ├── configuracoes/      # Configurações do usuário
│   │   │   └── admin/              # Área administrativa
│   │   │       ├── layout.tsx      # Layout admin (com guard)
│   │   │       ├── dashboard/      # Dashboard admin
│   │   │       └── clientes/       # Gestão de clientes
│   │   │           ├── page.tsx    # Lista de clientes
│   │   │           └── [id]/       # Detalhes do cliente
│   │   │
│   │   ├── api/                    # API Routes
│   │   │   ├── admin/              # Rotas administrativas
│   │   │   └── webhooks/           # Webhooks externos
│   │   │       └── evolution/      # Webhook Evolution API
│   │   │
│   │   ├── layout.tsx              # Layout raiz
│   │   ├── page.tsx                # Página inicial (redireciona)
│   │   ├── globals.css             # Estilos globais
│   │   └── not-found.tsx           # Página 404
│   │
│   ├── components/                 # Componentes reutilizáveis
│   │   ├── ui/                     # Componentes base UI
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Pagination.tsx
│   │   │   ├── StatusDropdown.tsx
│   │   │   └── Tabs.tsx
│   │   │
│   │   ├── navigation/             # Navegação
│   │   │   ├── Sidebar.tsx         # Barra lateral
│   │   │   └── Topbar.tsx          # Barra superior
│   │   │
│   │   ├── charts/                 # Gráficos
│   │   │   ├── SimpleBarChart.tsx
│   │   │   └── SplineAreaChart.tsx
│   │   │
│   │   ├── dashboard/              # Componentes do dashboard
│   │   │   └── RecentList.tsx
│   │   │
│   │   ├── admin/                  # Componentes administrativos
│   │   │   ├── AdminRouteGuard.tsx
│   │   │   ├── ClienteActionsMenu.tsx
│   │   │   ├── CriarClienteModal.tsx
│   │   │   └── ...
│   │   │
│   │   ├── calendar/               # Componentes de calendário
│   │   ├── icons/                  # Ícones customizados
│   │   ├── notifications/          # Sistema de notificações
│   │   ├── usuarios/               # Componentes de usuário
│   │   └── whatsapp/               # Componentes WhatsApp
│   │
│   ├── contexts/                   # React Contexts
│   │   ├── AuthContext.tsx         # Context de autenticação
│   │   └── NotificationsContext.tsx # Context de notificações
│   │
│   ├── hooks/                      # Custom Hooks
│   │   ├── useAuth.ts
│   │   ├── useAtendimentos.ts
│   │   ├── useAgendamentos.ts
│   │   ├── useMensagens.ts
│   │   ├── useUsuario.ts
│   │   ├── useWhatsAppInstances.ts
│   │   └── ...
│   │
│   ├── lib/                        # Bibliotecas e utilitários
│   │   ├── supabaseClient.ts       # Cliente Supabase
│   │   ├── auth.ts                 # Helpers de autenticação
│   │   ├── constants.ts            # Constantes do sistema
│   │   │
│   │   ├── api/                    # Funções de API
│   │   │   ├── atendimentos.ts
│   │   │   ├── agendamentos.ts
│   │   │   ├── mensagens.ts
│   │   │   ├── clientes.ts
│   │   │   ├── usuarios.ts
│   │   │   ├── whatsapp.ts
│   │   │   ├── evolution.ts
│   │   │   └── kanbanColunas.ts
│   │   │
│   │   └── utils/                  # Utilitários
│   │       ├── dates.ts
│   │       ├── dateUtils.ts
│   │       ├── formatters.ts
│   │       └── images.ts
│   │
│   ├── types/                      # Tipos TypeScript
│   │   ├── domain.ts               # Tipos de domínio
│   │   ├── supabase.ts             # Tipos do Supabase
│   │   └── calendar.ts             # Tipos de calendário
│   │
│   └── utils/                      # Utilitários gerais
│       ├── audio.ts
│       └── notifications.ts
│
├── tailwind.config.ts              # Configuração Tailwind
├── tsconfig.json                   # Configuração TypeScript
├── next.config.mjs                 # Configuração Next.js
└── package.json                    # Dependências do projeto
```

---

## Design System

### Paleta de Cores

O sistema utiliza uma paleta de cores baseada em roxo (primary) com variações:

#### Cores Primárias
```typescript
primary: {
  50: '#f5e6ff',   // Muito claro
  100: '#eaccff',
  200: '#d999ff',
  300: '#c766ff',
  400: '#b433ff',
  500: '#a100ff',  // Cor principal
  600: '#880BDB',  // Cor principal alternativa
  700: '#6d09af',
  800: '#520783',
  900: '#370557',   // Muito escuro
}
```

#### Cores de Status
- **Sucesso**: `green-500`, `green-600`, `green-700`
- **Aviso**: `yellow-500`, `yellow-600`
- **Erro**: `red-500`, `red-600`, `red-700`
- **Info**: `blue-500`, `blue-600`
- **Neutro**: `gray-50` até `gray-900`

### Tipografia

- **Fonte Principal**: System fonts stack
  ```css
  -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 
  'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 
  'Helvetica Neue', sans-serif
  ```

- **Tamanhos**:
  - Títulos: `text-2xl`, `text-3xl` (24px, 30px)
  - Subtítulos: `text-lg`, `text-xl` (18px, 20px)
  - Corpo: `text-sm`, `text-base` (14px, 16px)
  - Pequeno: `text-xs` (12px)

### Espaçamento

Sistema baseado em múltiplos de 4px (padrão Tailwind):
- `p-2` = 8px
- `p-4` = 16px
- `p-6` = 24px
- `p-8` = 32px

### Componentes Base

#### Button
```typescript
Variantes: 'primary' | 'secondary' | 'danger' | 'ghost'
Tamanhos: 'sm' | 'md' | 'lg'
```

**Estilos**:
- Primary: Fundo roxo (`primary-600`), texto branco, sombra
- Secondary: Fundo cinza claro, borda
- Danger: Fundo vermelho, texto branco
- Ghost: Transparente, hover com fundo cinza

#### Card
Componente de container com:
- Fundo branco
- Borda cinza (`border-gray-300`)
- Padding padrão (`p-6`)
- Border radius (`rounded-lg`)
- Suporte a título opcional

#### Input
- Borda cinza (`border-gray-200`)
- Focus: ring roxo (`focus:ring-primary-500`)
- Padding interno (`px-4 py-2`)

### Sombras

- **Pequena**: `shadow-sm` - Para cards e elementos elevados
- **Média**: `shadow-md` - Para modais e elementos importantes
- **Grande**: `shadow-lg` - Para elementos destacados

### Border Radius

- **Pequeno**: `rounded` (4px)
- **Médio**: `rounded-lg` (8px)
- **Grande**: `rounded-xl` (12px)
- **Total**: `rounded-full` - Para avatares e badges

---

## Layout e Navegação

### Estrutura de Layout

O sistema utiliza um layout de três colunas:

```
┌─────────────────────────────────────────────────┐
│                    Topbar                       │
├──────────┬──────────────────────────────────────┤
│          │                                      │
│ Sidebar  │         Conteúdo Principal          │
│          │         (Páginas)                    │
│          │                                      │
│          │                                      │
└──────────┴──────────────────────────────────────┘
```

### Sidebar (Barra Lateral)

**Largura**: `w-72` (288px)

**Estrutura**:
1. **Logo** (topo)
   - Logo da Air Midia Digital
   - Altura: 60% da largura do container

2. **Navegação** (meio)
   - Links de navegação dinâmicos baseados no tipo de usuário
   - Ícones + Labels
   - Estado ativo destacado com fundo roxo

3. **Configurações** (antes do rodapé)
   - Link fixo para página de configurações

4. **Perfil do Usuário** (rodapé)
   - Avatar com inicial
   - Nome (primeiro + último)
   - Telefone conectado
   - Botão de logout

**Itens de Navegação por Tipo de Usuário**:

**Usuário Normal (Atendimento/Agendamento)**:
- Dashboard
- Atendimento/Agendamentos
- Mensagens

**Administrador**:
- Dashboard Admin
- Clientes

### Topbar (Barra Superior)

**Altura**: Variável

**Conteúdo**:
1. **Título da Página** (esquerda)
   - "Bem-vindo de volta!"
   - Subtítulo com nome da página atual

2. **Ações** (direita)
   - Ícone de notificações (com badge de não lidas)
   - Ícone de configurações
   - Barra de busca

### Layout Responsivo

- **Desktop**: Sidebar fixa + conteúdo flexível
- **Mobile**: Sidebar colapsável (funcionalidade futura)

### Rotas Principais

```typescript
ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  ATENDIMENTO: '/atendimento',
  MENSAGENS: '/mensagens',
  CONFIGURACOES: '/configuracoes',
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_CLIENTES: '/admin/clientes',
}
```

---

## Funcionalidades Principais

### 1. Dashboard

**Localização**: `/dashboard`

**Funcionalidades**:
- **Cards de Métricas**:
  - Total de clientes atendidos
  - Atendimentos em andamento / Agendamentos cancelados
  - Total de solicitações / Total de agendamentos

- **Gráficos**:
  - Gráfico de área (Spline) com dados dos últimos 6 meses
  - Mostra quantidade de atendimentos/agendamentos por mês

- **Lista Recente**:
  - Últimos atendimentos/agendamentos
  - Clique abre detalhes na página de atendimento

**Diferenciação por Tipo**:
- Usuários de **atendimento**: Métricas de atendimentos
- Usuários de **agendamento**: Métricas de agendamentos
- Administradores: Redirecionados para dashboard admin

### 2. Atendimento

**Localização**: `/atendimento`

**Visualizações**:
1. **Lista** (padrão)
   - Lista vertical de atendimentos/agendamentos
   - Filtros por status
   - Busca
   - Paginação

2. **Kanban**
   - Colunas por status
   - Drag & drop entre colunas
   - Atualização de status em tempo real

3. **Calendário** (apenas para agendamentos)
   - Visualização mensal
   - Eventos clicáveis
   - Navegação entre meses

**Sidebar de Detalhes**:
- Abre ao clicar em um atendimento/agendamento
- Mostra:
  - Informações do cliente
  - Histórico de mensagens
  - Resumo da conversa
  - Ações (atualizar status, etc.)

### 3. Mensagens

**Localização**: `/mensagens`

**Interface Estilo WhatsApp**:
- **Lista de Conversas** (esquerda):
  - Lista de clientes com conversas
  - Última mensagem preview
  - Badge de atendimento/agendamento
  - Busca de clientes

- **Área de Chat** (direita):
  - Mensagens em formato de bolhas
  - Suporte a:
    - Texto
    - Imagens (com visualizador modal)
    - Áudios (player customizado estilo WhatsApp)
    - Documentos (PDF, DOC, etc.)
  - Timeline com logs de atendimentos/agendamentos
  - Formatação de data/hora inteligente

**Recursos**:
- Scroll automático para última mensagem
- Realtime updates via Supabase
- Visualização de imagens com zoom e arrastar
- Player de áudio com waveform
- Download de documentos

### 4. Configurações

**Localização**: `/configuracoes`

**Seções**:
1. **Perfil**:
   - Avatar com inicial
   - Edição de nome
   - Exibição de email (não editável)
   - Telefone IA

2. **Integrações**:
   - **WhatsApp**:
     - Status da conexão
     - Telefone conectado
     - Botão conectar/desconectar
     - Modal de conexão com QR Code
   - **Google Calendar** (em desenvolvimento)

### 5. Área Administrativa

**Localização**: `/admin/*`

**Acesso**: Apenas usuários com `tipo === 'administracao'`

**Funcionalidades**:

#### Dashboard Admin
- Métricas gerais do sistema
- Visão consolidada de todos os clientes

#### Gestão de Clientes
- Lista de clientes
- Criação de novos clientes
- Edição de clientes
- Exclusão/desativação
- Visualização de detalhes
- Gestão de fases (Kanban)
- Edição de nome de instância

---

## Componentes UI

### Button

```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  // ... outras props HTML
}
```

**Uso**:
```tsx
<Button variant="primary" size="md">Salvar</Button>
<Button variant="danger" size="sm">Excluir</Button>
```

### Card

```typescript
interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}
```

**Uso**:
```tsx
<Card title="Título do Card">
  Conteúdo do card
</Card>
```

### Modal

```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnClickOutside?: boolean;
  children: React.ReactNode;
}
```

**Uso**:
```tsx
<Modal 
  isOpen={isOpen} 
  onClose={() => setIsOpen(false)}
  title="Título do Modal"
  size="md"
>
  Conteúdo do modal
</Modal>
```

### Input

```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  // Props padrão do input HTML
}
```

**Uso**:
```tsx
<Input 
  type="text" 
  placeholder="Digite algo..."
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

### Tabs

```typescript
interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}
```

**Uso**:
```tsx
<Tabs 
  tabs={[
    { id: 'lista', label: 'Lista', icon: <ListIcon /> },
    { id: 'kanban', label: 'Kanban', icon: <GridIcon /> }
  ]}
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>
```

### StatusDropdown

Componente para seleção de status com opções pré-definidas.

---

## Hooks Customizados

### useAuth

Gerencia autenticação do usuário.

```typescript
const { user, loading, signOut } = useAuth();
```

**Retorna**:
- `user`: Usuário autenticado (Supabase User)
- `loading`: Estado de carregamento
- `signOut`: Função para fazer logout

### useUsuario

Busca dados do usuário na tabela `usuarios`.

```typescript
const { usuario, loading, refetch } = useUsuario();
```

**Retorna**:
- `usuario`: Dados do usuário (nome, telefone_ia, tipo_marcacao, etc.)
- `loading`: Estado de carregamento
- `refetch`: Função para recarregar dados

### useAtendimentos

Gerencia atendimentos do usuário.

```typescript
const { atendimentos, loading, refetch } = useAtendimentos();
```

**Recursos**:
- Busca atendimentos filtrados por telefones do usuário
- Realtime updates
- Filtros por status

### useAgendamentos

Gerencia agendamentos do usuário.

```typescript
const { agendamentos, loading, refetch } = useAgendamentos();
```

**Recursos**:
- Busca agendamentos do usuário
- Realtime updates
- Filtros por status

### useMensagens

Gerencia mensagens de um atendimento específico.

```typescript
const { mensagens, loading } = useMensagens(atendimentoId);
```

### useMensagensPorCliente

Busca mensagens agrupadas por cliente.

```typescript
const { mensagens, loading } = useMensagensPorCliente(clienteId);
const { clientes, loading, refetch } = useClientesComConversas();
```

### useWhatsAppInstances

Gerencia instâncias WhatsApp do usuário.

```typescript
const { instances, loading, refetch } = useWhatsAppInstances();
```

**Retorna**:
- `instances`: Array de instâncias WhatsApp
- `loading`: Estado de carregamento
- `refetch`: Função para recarregar

### useDashboardStats

Calcula estatísticas do dashboard.

```typescript
const { stats, loading } = useDashboardStats();
```

**Retorna**:
- `stats`: Objeto com métricas (totalAtendimentos, atendimentosAbertos, etc.)

### useAtendimentosNotifications

Escuta novos atendimentos e toca som de notificação.

```typescript
useAtendimentosNotifications();
```

### useAgendamentosNotifications

Escuta novos agendamentos e toca som de notificação.

```typescript
useAgendamentosNotifications();
```

### useSidebar

Gerencia estado da sidebar de detalhes.

```typescript
const { isOpen, selectedAtendimentoId, openSidebar, closeSidebar } = useSidebar();
```

---

## APIs e Integrações

### Supabase API

Todas as funções de API estão em `src/lib/api/`:

#### atendimentos.ts
- `getAtendimentos(usuarioId)`: Busca atendimentos do usuário
- `getAtendimentoById(id)`: Busca atendimento específico
- `updateAtendimentoStatus(id, status)`: Atualiza status
- `getAtendimentosRecentes(usuarioId)`: Busca atendimentos recentes

#### agendamentos.ts
- `getAgendamentos(usuarioId)`: Busca agendamentos do usuário
- `getAgendamentoById(id)`: Busca agendamento específico
- `updateAgendamentoStatus(id, status)`: Atualiza status
- `createAgendamento(data)`: Cria novo agendamento

#### mensagens.ts
- `getMensagensPorAtendimento(atendimentoId)`: Busca mensagens de um atendimento
- `getMensagensPorCliente(clienteId, usuarioId)`: Busca mensagens de um cliente
- `getClientesComConversas(usuarioId)`: Busca clientes com conversas

#### clientes.ts
- `getClientes(usuarioId)`: Busca clientes do usuário
- `createCliente(data)`: Cria novo cliente
- `updateCliente(id, data)`: Atualiza cliente
- `deleteCliente(id)`: Exclui cliente

#### whatsapp.ts
- `getWhatsAppInstances(usuarioId)`: Busca instâncias do usuário
- `getConnectedInstances(usuarioId)`: Busca apenas instâncias conectadas
- `createWhatsAppInstance(data)`: Cria nova instância
- `updateInstanceStatus(id, status)`: Atualiza status da instância

#### evolution.ts
- `criarInstancia(instanceName, qrCode)`: Cria instância na Evolution API
- `verificarStatusInstancia(instanceName)`: Verifica status
- `fazerLogoutInstancia(instanceName)`: Desconecta instância

### Webhooks

#### Evolution API Webhook
**Rota**: `/api/webhooks/evolution`

**Funcionalidade**:
- Recebe eventos da Evolution API
- Processa mensagens recebidas
- Cria/atualiza atendimentos
- Salva mensagens no banco

**Eventos Processados**:
- `messages.upsert`: Nova mensagem recebida
- `connection.update`: Atualização de conexão
- `qrcode.updated`: QR Code atualizado

---

## Tipos e Interfaces

### Tipos de Domínio

```typescript
// Status de atendimento
type StatusAtendimento = 'aberto' | 'em_andamento' | 'encerrado';

// Status de agendamento
type StatusAgendamento = 'agendado' | 'confirmado' | 'cancelado' | 'concluido';

// Status de instância WhatsApp
type StatusWhatsAppInstance = 'conectado' | 'desconectado' | 'conectando' | 'erro';
```

### Interfaces Principais

#### Atendimento
```typescript
interface Atendimento {
  id: string;
  cliente_id: string;
  cliente_nome?: string;
  cliente_foto_perfil?: string;
  telefone_cliente: string;
  telefone_usuario: string;
  usuario_id?: string;
  status: StatusAtendimento;
  created_at: string;
  updated_at: string;
  ultima_mensagem?: string;
  ultima_mensagem_at?: string;
  resumo_conversa?: string;
}
```

#### Agendamento
```typescript
interface Agendamento {
  id: string;
  cliente_id: string;
  cliente_nome?: string;
  cliente_foto_perfil?: string;
  telefone_cliente?: string;
  usuario_id: string;
  data_e_hora: string; // ISO string
  resumo_conversa?: string;
  link_agendamento?: string;
  status: StatusAgendamento;
  created_at: string;
  updated_at: string;
}
```

#### Mensagem
```typescript
interface Mensagem {
  id: string;
  atendimento_id: string;
  conteudo: string;
  tipo: 'humano' | 'bot';
  telefone_remetente: string;
  telefone_destinatario: string;
  message_id?: string;
  created_at: string;
  base64_audio?: string;
  base64_imagem?: string;
  base64_documento?: string;
}
```

#### WhatsAppInstance
```typescript
interface WhatsAppInstance {
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
```

#### DashboardStats
```typescript
interface DashboardStats {
  totalAtendimentos: number;
  atendimentosAbertos: number;
  atendimentosEmAndamento: number;
  atendimentosEncerrados: number;
  totalMensagens: number;
}
```

---

## Fluxos Principais

### 1. Fluxo de Autenticação

```
1. Usuário acessa /login
2. Preenche email e senha
3. Supabase autentica
4. Redireciona para /dashboard
5. AuthContext gerencia estado
6. Rotas privadas verificam autenticação
```

### 2. Fluxo de Recebimento de Mensagem

```
1. Evolution API recebe mensagem WhatsApp
2. Webhook é acionado (/api/webhooks/evolution)
3. Sistema identifica usuário pelo telefone
4. Cria/atualiza cliente se necessário
5. Salva mensagem no banco
6. Cria/atualiza atendimento se necessário
7. Realtime subscription notifica frontend
8. Som de notificação é tocado
9. Badge de notificações é atualizado
```

### 3. Fluxo de Visualização de Atendimento

```
1. Usuário acessa /atendimento
2. Lista de atendimentos é carregada
3. Usuário clica em um atendimento
4. Sidebar abre com detalhes
5. Mensagens são carregadas
6. Realtime atualiza mensagens em tempo real
```

### 4. Fluxo de Conexão WhatsApp

```
1. Usuário acessa /configuracoes
2. Clica em "Conectar" WhatsApp
3. Modal abre com QR Code
4. Sistema cria instância na Evolution API
5. QR Code é exibido
6. Usuário escaneia com WhatsApp
7. Status muda para "conectado"
8. Instância é salva no Supabase
```

### 5. Fluxo de Criação de Agendamento

```
1. Usuário conversa com cliente via WhatsApp
2. Cliente solicita agendamento
3. Sistema detecta intenção (via IA ou manual)
4. Agendamento é criado
5. Dados são salvos no Supabase
6. Realtime notifica frontend
7. Agendamento aparece no calendário
```

---

## Autenticação e Segurança

### Autenticação

- **Método**: Email + Senha via Supabase Auth
- **Gerenciamento**: `AuthContext` e `useAuth` hook
- **Proteção de Rotas**: Middleware do Next.js
- **Sessão**: Gerenciada pelo Supabase (cookies)

### Row Level Security (RLS)

Todas as tabelas possuem políticas RLS:

- **usuarios**: Usuário só vê seus próprios dados
- **clientes**: Usuário só vê seus próprios clientes
- **atendimentos**: Filtrado por telefones do usuário
- **agendamentos**: Filtrado por `usuario_id`
- **mensagens**: Filtrado por telefones do usuário

### Proteção de Rotas Admin

- Componente `AdminRouteGuard` verifica tipo de usuário
- Redireciona se não for administrador
- Aplicado no layout admin

---

## Conclusão

Este documento fornece uma visão completa do sistema **Gestor IA Air Midia**, incluindo:

- Arquitetura e tecnologias utilizadas
- Estrutura de pastas e organização do código
- Design system completo
- Layout e navegação
- Todas as funcionalidades principais
- Componentes, hooks e APIs
- Tipos e interfaces
- Fluxos principais do sistema

Para mais detalhes sobre configuração do banco de dados, consulte:
- `DOCUMENTACAO-TABELAS-SUPABASE.md`
- `EVOLUTION-API-INTEGRATION.md`
- `REALTIME-SETUP.md`

---

**Última atualização**: Janeiro 2025
**Versão do Sistema**: 1.0.0
