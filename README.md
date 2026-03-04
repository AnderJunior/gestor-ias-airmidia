# Sistema de Atendimento com Dashboard

Sistema web de gestão de atendimentos com dashboard e histórico de mensagens, construído com Next.js, TypeScript e Supabase.

## 🚀 Tecnologias

- **Frontend:** Next.js 14 (App Router), React, TypeScript
- **Estilização:** Tailwind CSS
- **Backend:** Supabase (Autenticação + PostgreSQL)
- **Gráficos:** Recharts

## 📋 Pré-requisitos

- Node.js 18+ instalado
- Conta no Supabase (ou instância self-hosted)
- Evolution API configurada (para integração WhatsApp)
- npm ou yarn

## 🔧 Instalação

1. Clone o repositório:
```bash
git clone <seu-repositorio>
cd sistema-gestao-ia
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.local.example .env.local
```

Edite o arquivo `.env.local` e adicione suas credenciais do Supabase e (opcional) Twilio para envio de mensagens WhatsApp:
```
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase

# Envio de mensagens WhatsApp (Twilio)
TWILIO_ACCOUNT_SID=seu_account_sid
TWILIO_AUTH_TOKEN=seu_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

## 🗄️ Configuração do Banco de Dados (Supabase)

Execute os seguintes comandos SQL no Supabase SQL Editor:

Execute o script SQL completo `supabase-setup.sql` no SQL Editor do Supabase. Este script cria:

1. **Tabela `whatsapp_instances`**: Armazena as conexões WhatsApp de cada usuário
2. **Tabela `atendimentos`**: Atendimentos com identificação por telefone
3. **Tabela `mensagens`**: Mensagens com telefones de remetente e destinatário
4. **Índices**: Para melhor performance nas consultas
5. **RLS (Row Level Security)**: Políticas de segurança para filtrar dados por usuário
6. **Funções auxiliares**: Para identificar usuários por telefone

**Importante**: O sistema identifica usuários pelos números de telefone conectados via Evolution API. Cada usuário pode ter múltiplos números conectados.

## 👤 Criando Usuários

Como mencionado nas instruções, não há tela de registro. Os usuários devem ser criados diretamente no Supabase:

1. Acesse o painel do Supabase
2. Vá em Authentication > Users
3. Clique em "Add user" e preencha email e senha
4. Ou use a API do Supabase para criar usuários programaticamente

## 🏃 Executando o Projeto

```bash
# Modo desenvolvimento
npm run dev

# Build para produção
npm run build

# Executar em produção
npm start
```

O sistema estará disponível em `http://localhost:3000`

## 📁 Estrutura do Projeto

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/          # Página de login
│   ├── (private)/
│   │   ├── dashboard/      # Dashboard com resumo
│   │   └── atendimento/    # Página de atendimentos
│   └── layout.tsx
├── components/
│   ├── ui/                 # Componentes UI base
│   ├── charts/             # Componentes de gráficos
│   └── navigation/         # Sidebar e Topbar
├── hooks/                  # React hooks customizados
├── lib/
│   ├── api/                # Funções de API
│   ├── utils/              # Utilitários
│   └── supabaseClient.ts   # Cliente Supabase
└── types/                  # Tipos TypeScript
```

## 🔐 Autenticação e Identificação

O sistema utiliza autenticação por email e senha através do Supabase. Todas as rotas privadas são protegidas e redirecionam para a página de login se o usuário não estiver autenticado.

**Identificação por Telefone**: O sistema identifica automaticamente qual usuário está relacionado a cada mensagem e atendimento através do número de telefone conectado via Evolution API. Cada usuário pode ter um ou mais números de telefone conectados.

Veja `EVOLUTION-API-INTEGRATION.md` para detalhes sobre a integração com Evolution API.

## 📊 Funcionalidades

- ✅ Login com email e senha
- ✅ Dashboard com resumo de atendimentos (filtrado por telefones do usuário)
- ✅ Visualização de atendimentos com filtros por status
- ✅ Histórico de mensagens em sidebar flutuante
- ✅ Identificação automática de usuários por telefone conectado
- ✅ Integração com Evolution API via webhook
- ✅ Suporte a múltiplos números de telefone por usuário
- ✅ Interface responsiva e moderna

## 🚢 Deploy

Para fazer deploy em um VPS:

1. Build do projeto:
```bash
npm run build
```

2. Configure um servidor Node.js (PM2, etc.) ou use Docker
3. Configure variáveis de ambiente no servidor
4. Configure um proxy reverso (Nginx) apontando para a porta do Next.js

## 📝 Notas

- Certifique-se de que as políticas RLS estão configuradas corretamente no Supabase
- O sistema não possui tela de registro - usuários devem ser criados manualmente
- Para produção, configure adequadamente as variáveis de ambiente e segurança

