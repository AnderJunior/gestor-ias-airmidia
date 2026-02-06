# Funções do Sistema – Visão Admin e Usuário Normal

Este documento descreve as funções disponíveis no **Gestor IA Air Midia** para **administradores** e **usuários normais** (clientes), incluindo diferenças de menu, telas e permissões.

---

## 1. Tipos de usuário

O sistema diferencia usuários pelo campo **`tipo`** na tabela de usuários:

| Tipo              | Descrição |
|-------------------|-----------|
| **administracao**  | Administrador. Acessa a área admin (Dashboard admin e gestão de Clientes). Não vê Atendimento/Agendamentos nem Mensagens no menu. |
| **Cliente**       | Usuário normal (atendimento ou agendamento). Vê Dashboard, Atendimento/Agendamentos e Mensagens. |

Dentro dos **clientes**, o campo **`tipo_marcacao`** define o foco do uso:

| tipo_marcacao  | Menu lateral        | Foco principal |
|----------------|---------------------|----------------|
| **atendimento**| "Atendimento"       | Solicitações de atendimento humano (lista, kanban). Sem aba Calendário. |
| **agendamento**| "Agendamentos"      | Agendamentos (lista, kanban, calendário). |

---

## 2. Visualização e funções – Usuário normal (cliente)

Usuários com `tipo` diferente de `administracao` têm o seguinte comportamento.

### 2.1 Menu lateral (Sidebar)

- **Dashboard** – Resumo e gráficos do próprio usuário.
- **Atendimento** ou **Agendamentos** – Conforme `tipo_marcacao` (um ou outro).
- **Mensagens** – Conversas WhatsApp.
- **Configurações** – Sempre visível.
- **Sair** – Logout.

### 2.2 Dashboard (`/dashboard`)

- **Cards de resumo:**
  - Total de clientes atendidos (total de clientes cadastrados para o usuário).
  - **Atendimento:** Atendimentos em andamento / **Agendamento:** Agendamentos cancelados.
  - **Atendimento:** Total de solicitações de atendimento / **Agendamento:** Total de agendamentos (agendados + confirmados).
- **Gráfico:** Quantidade de atendimento ou de agendamento por mês (últimos 6 meses).
- **Lista recente:** Atendimentos ou agendamentos recentes; ao clicar, redireciona para Atendimento e abre o item na sidebar.

Se o usuário for administrador, ao acessar `/dashboard` é redirecionado para `/admin/dashboard`.

### 2.3 Atendimento / Agendamentos (`/atendimento`)

- **Abas:** Lista, Kanban e (somente para **agendamento**) Calendário.
- **Lista:** Listagem de atendimentos ou agendamentos com filtros e busca.
- **Kanban:** Colunas por status; arrastar e soltar para alterar status.
- **Calendário:** Apenas para `tipo_marcacao === 'agendamento'`; visualização mensal dos agendamentos.
- **Sidebar lateral:** Ao selecionar um item, abre painel com detalhes, histórico e ações (ex.: atualizar status, ver mensagens).

### 2.4 Mensagens (`/mensagens`)

- Lista de conversas (clientes/contatos) com mensagens via WhatsApp.
- Envio e recebimento de texto, imagens, áudio e documentos.
- Integração com Evolution API; mensagens em tempo real (Supabase Realtime).
- Player de áudio no estilo WhatsApp, visualização de imagens/documentos e indicadores de leitura.

### 2.5 Configurações (`/configuracoes`)

Três abas disponíveis para o usuário logado:

- **Perfil**
  - Nome e e-mail (e-mail não editável).
  - Edição do nome.
  - Telefone da IA (exibido quando houver).
- **Integrações (na aba Perfil)**
  - **WhatsApp:** Status da conexão (Conectado / Desconectado / Conectando / Erro), botão Conectar e opção de Desconectar.
  - **Google Calendar:** Exibido como “Em desenvolvimento”.
- **Webhook**
  - Configuração de webhooks (URLs e eventos).
- **Administradores**
  - Listagem de administradores, criação de novo administrador e exclusão. O acesso efetivo a essas ações pode ser restrito por RLS no Supabase conforme a política do projeto.

### 2.6 Outros comportamentos do usuário normal

- **Notificações (sino no Topbar):** Notificações do sistema e atendimentos/agendamentos recentes; ao clicar, abre o item na página de Atendimento.
- **Verificação de dados iniciais:** Modal para preencher **nome** e **telefone_ia** quando ainda não estiverem preenchidos (apenas para clientes, não para administradores).
- **Verificação de conexão WhatsApp:** Componente que alerta se o WhatsApp não estiver conectado quando necessário.

---

## 3. Visualização e funções – Administrador

Usuários com `tipo === 'administracao'` passam pelo **AdminRouteGuard**: ao acessar rotas `/admin/*` sem ser admin, são redirecionados para `/dashboard`.

### 3.1 Menu lateral (Sidebar) – Admin

- **Dashboard** – Leva ao dashboard administrativo (`/admin/dashboard`).
- **Clientes** – Lista e gestão de clientes (`/admin/clientes`).
- **Configurações** – Mesma página de configurações (Perfil, Webhook, Administradores).
- **Sair** – Logout.

Admin **não** vê no menu: Atendimento/Agendamentos nem Mensagens.

### 3.2 Dashboard admin (`/admin/dashboard`)

- **Clientes Ativos** – Total de clientes ativos.
- **Clientes em Teste** – Total em fase “teste”.
- **Clientes em Produção** – Total em fase “produção”.

Fonte: estatísticas agregadas da base (hooks/API de admin).

### 3.3 Clientes (`/admin/clientes`)

- **Visualizações:** Lista e Kanban (colunas customizáveis no Supabase).
- **Por cliente (lista ou card):**
  - Nome, e-mail, tipo (atendimento/agendamento), fase (teste/produção), status da instância WhatsApp (conectado/desconectado/etc.).
- **Ações por cliente (menu de ações):**
  - **Entrar na Conta** – Impersonação: abre a sessão como esse cliente (útil para suporte).
  - **Editar nome instância** – Nome da instância WhatsApp.
  - **Editar cliente** – Dados do cliente (nome, e-mail, telefone, tipo_marcacao, etc.).
  - **Desativar** / **Ativar** – Ativar ou desativar o cliente (campo `ativo`).
  - **Excluir** – Exclusão do cliente (com confirmação e, em alguns fluxos, digitação do nome).
- **Criar cliente:** Modal para novo cliente (nome, telefone_ia, tipo_marcacao, e-mail, senha, fase). Após criação, pode ser exibido popup com credenciais (e-mail e senha).
- **Kanban:** Arrastar cliente entre colunas para alterar fase (teste/produção); colunas podem ser criadas, editadas e excluídas.
- **Busca e paginação** na lista de clientes.

### 3.4 Detalhes do cliente (`/admin/clientes/[id]`)

- Dados cadastrais, status da instância WhatsApp, tipo e fase.
- Ações rápidas: Editar cliente, Editar nome instância, Desativar/Ativar, Excluir, Entrar na Conta.
- **Mensagens:** Visualização da conversa WhatsApp do cliente (leitura; envio dependendo da implementação).
- **Tarefas:** Lista de tarefas do cliente; atribuição de responsável e data; gerenciamento de tarefas.
- **Link de agendamento:** Exibição e gestão do link de agendamento quando aplicável.

### 3.5 Configurações – Admin

- Mesmas abas: **Perfil**, **Webhook**, **Administradores**.
- Na aba **Administradores:** criar novos administradores (e-mail, senha, nome) e excluir administradores existentes (com políticas RLS aplicadas no backend).

---

## 4. Resumo comparativo

| Recurso                    | Usuário normal (cliente)     | Administrador        |
|---------------------------|-----------------------------|----------------------|
| Dashboard                 | Sim (próprios dados)        | Sim (estatísticas de clientes) |
| Atendimento / Agendamentos| Sim (conforme tipo_marcacao)| Não (não no menu)    |
| Mensagens                 | Sim                         | Não (não no menu)    |
| Configurações             | Sim (Perfil, Webhook, Admins)| Sim (idem)          |
| Gestão de clientes        | Não                         | Sim (lista, kanban, CRUD, impersonar) |
| Criar/Excluir administradores | Conforme RLS (aba Administradores) | Sim (aba Administradores) |
| Notificações (sino)       | Sim (atendimentos/agendamentos) | Disponível na área privada |
| Verificação dados iniciais| Sim (nome + telefone_ia)    | Não (não exibido)    |

---

## 5. Rotas principais

| Rota                    | Quem acessa        | Descrição |
|-------------------------|--------------------|-----------|
| `/login`                | Todos              | Login.    |
| `/dashboard`             | Apenas clientes     | Dashboard do usuário; admin é redirecionado. |
| `/atendimento`           | Apenas clientes     | Atendimento ou Agendamentos. |
| `/mensagens`            | Apenas clientes     | Mensagens WhatsApp. |
| `/configuracoes`        | Todos (logados)     | Perfil, Webhook, Administradores. |
| `/admin/dashboard`      | Apenas administradores | Dashboard admin. |
| `/admin/clientes`       | Apenas administradores | Lista/kanban de clientes. |
| `/admin/clientes/[id]`  | Apenas administradores | Detalhes e gestão do cliente. |

---

## 6. APIs administrativas (referência)

As rotas em `/api/admin/*` são usadas pela área admin e por componentes de configuração (ex.: administradores):

- `atualizar-atendimento-atual` – Atualiza atendimento atual do cliente.
- `atualizar-fase-cliente` – Atualiza fase (teste/produção) do cliente.
- `buscar-email-cliente` – Busca e-mail do cliente.
- `criar-administrador` – Criação de administrador.
- `criar-cliente` – Criação de cliente (nome, telefone_ia, tipo_marcacao, email, senha, fase).
- `desativar-cliente` – Desativa cliente.
- `editar-email-cliente` – Edita e-mail do cliente.
- `editar-nome-instancia` – Edita nome da instância WhatsApp.
- `excluir-administrador` – Exclusão de administrador.
- `excluir-cliente` – Exclusão de cliente.
- `impersonar-cliente` – Gera sessão “Entrar na Conta” do cliente.
- `listar-administradores` – Lista administradores.

O acesso a essas rotas deve ser protegido no backend (por exemplo, verificando se o usuário é administrador e aplicando RLS no Supabase).

---

*Documento gerado com base na estrutura do projeto Gestor IA Air Midia (rotas, componentes e hooks).*
