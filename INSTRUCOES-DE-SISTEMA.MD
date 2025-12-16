# Sistema de Atendimento com Dashboard (Supabase + Frontend Web)

> Documento de especificação e estrutura do sistema

---

## 1. Visão Geral

Sistema web onde o cliente faz login com e-mail e senha e acessa um painel com:

- Resumo dos atendimentos
- Volume de mensagens enviadas
- Status dos atendimentos (aberto, em andamento, encerrado)
- Acesso à página de **Atendimento**, onde é possível visualizar o histórico de atendimentos humanos.

Não haverá tela de registro (sign up).  
Os usuários serão criados diretamente no Supabase (via painel ou script).

---

## 2. Stack Tecnológico (sugestão)

- **Frontend:**
  - React + Next.js (App Router)
  - TypeScript
  - CSS/Tailwind (ou outro framework à escolha)
- **Backend-as-a-Service:**
  - Supabase:
    - Autenticação (email + senha)
    - Banco de dados PostgreSQL
    - RLS (Row Level Security)
    - Edge Functions (se necessário)
- **Infraestrutura:**
  - Deploy direto em VPS (para o frontend)
  - Supabase Cloud ou self-hosted (já é seu padrão)

---

## 3. Estrutura de Pastas (projeto frontend)

```bash
.
├── README.md
├── package.json
├── tsconfig.json
├── next.config.mjs
├── .env.local              # SUPABASE_URL, SUPABASE_ANON_KEY etc.
└── src
    ├── app
    │   ├── (auth)
    │   │   └── login
    │   │       ├── page.tsx
    │   │       └── LoginForm.tsx
    │   ├── (private)
    │   │   ├── layout.tsx         # Layout autenticado (navbar, sidebar etc.)
    │   │   ├── dashboard
    │   │   │   └── page.tsx
    │   │   └── atendimento
    │   │       ├── page.tsx
    │   │       └── components
    │   │           ├── AtendimentoList.tsx
    │   │           ├── AtendimentoItem.tsx
    │   │           └── AtendimentoSidebar.tsx  # “floating group” lateral
    │   ├── api
    │   │   ├── auth
    │   │   │   └── callback (se usar OAuth, opcional)
    │   │   └── webhooks            # opcional (gatilhos externos)
    │   └── layout.tsx              # Layout público geral (pode ser básico)
    ├── components
    │   ├── ui                      # Botões, inputs etc.
    │   │   ├── Button.tsx
    │   │   ├── Input.tsx
    │   │   ├── Card.tsx
    │   │   └── Modal.tsx
    │   ├── charts
    │   │   └── SimpleBarChart.tsx  # gráfico simples de atendimentos/mensagens
    │   └── navigation
    │       ├── Sidebar.tsx
    │       └── Topbar.tsx
    ├── lib
    │   ├── supabaseClient.ts       # criação do cliente supabase
    │   ├── auth.ts                 # helpers de auth (getUser, requireAuth etc.)
    │   ├── api
    │   │   ├── atendimentos.ts     # funções para buscar atendimentos
    │   │   └── mensagens.ts        # funções para buscar mensagens
    │   ├── utils
    │   │   ├── dates.ts            # formatação de datas
    │   │   └── formatters.ts       # formatação de textos/labels
    │   └── constants.ts
    ├── hooks
    │   ├── useAuth.ts              # hook para estado de usuário logado
    │   ├── useAtendimentos.ts      # hook para carregar lista de atendimentos
    │   └── useSidebar.ts           # hook para controlar sidebar de atendimento
    ├── types
    │   ├── supabase.ts             # tipagens geradas pelo supabase
    │   └── domain.ts               # tipos de domínio (Atendimento, Mensagem etc.)
    ├── styles
    │   ├── globals.css
    │   └── theme.css               # se necessário
    └── middleware.ts               # proteção de rotas (se necessário)
