# Documentação Completa do Sistema de Gestão IA

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Funções Principais](#funções-principais)
3. [Telas e Páginas](#telas-e-páginas)
4. [Sistema de Permissões e Cargos](#sistema-de-permissões-e-cargos)
5. [Autenticação e Segurança](#autenticação-e-segurança)
6. [Integrações](#integrações)
7. [APIs e Endpoints](#apis-e-endpoints)
8. [Estrutura de Banco de Dados](#estrutura-de-banco-de-dados)
9. [Componentes e Funcionalidades](#componentes-e-funcionalidades)
10. [Fluxos de Trabalho](#fluxos-de-trabalho)

---

## 🎯 Visão Geral

Sistema web de gestão de atendimentos e agendamentos com integração WhatsApp via Evolution API. O sistema permite gerenciar clientes, atendimentos humanos, agendamentos, mensagens e configurações de instâncias WhatsApp.

### Tecnologias Utilizadas

- **Frontend:** Next.js 14 (App Router), React, TypeScript
- **Estilização:** Tailwind CSS
- **Backend:** Supabase (Autenticação + PostgreSQL)
- **Gráficos:** Recharts
- **Integração WhatsApp:** Evolution API
- **Real-time:** Supabase Realtime

---

## ⚙️ Funções Principais

### Para Usuários Clientes

1. **Dashboard**
   - Visualização de estatísticas de atendimentos/agendamentos
   - Gráficos de dados por mês
   - Lista de itens recentes
   - Cards informativos com métricas

2. **Gestão de Atendimentos/Agendamentos**
   - Visualização em Lista
   - Visualização em Kanban
   - Visualização em Calendário (apenas para tipo agendamento)
   - Filtros por status
   - Detalhes do atendimento/agendamento em sidebar

3. **Mensagens**
   - Lista de conversas com clientes
   - Visualização de mensagens em tempo real
   - Suporte a mensagens de texto, áudio, imagem e documentos
   - Player de áudio estilo WhatsApp
   - Visualização de imagens com zoom
   - Download de documentos
   - Timeline com logs de atendimentos e agendamentos

4. **Configurações**
   - Edição de perfil (nome)
   - Configuração de conexão WhatsApp
   - Visualização de status de integrações
   - Desconexão de WhatsApp

### Para Administradores

1. **Dashboard Administrativo**
   - Estatísticas de clientes ativos
   - Clientes em teste
   - Clientes em produção

2. **Gestão de Clientes**
   - Criação de novos clientes
   - Listagem de todos os clientes
   - Edição de dados do cliente
   - Edição de nome da instância WhatsApp
   - Desativação de clientes
   - Exclusão de clientes (com confirmação)
   - Alteração de fase (teste/produção)
   - Visualização de status de conexão Evolution API
   - Busca e paginação de clientes

---

## 📱 Telas e Páginas

### Páginas Públicas

#### 1. Login (`/login`)
- **Função:** Autenticação de usuários
- **Funcionalidades:**
  - Login com email e senha
  - Redirecionamento automático se já autenticado
  - Validação de credenciais via Supabase Auth

### Páginas Privadas (Cliente)

#### 2. Dashboard (`/dashboard`)
- **Função:** Página inicial com resumo de informações
- **Funcionalidades:**
  - 3 cards com métricas principais:
    - Total de clientes atendidos
    - Atendimentos em Andamento / Agendamentos cancelados
    - Total de solicitações de atendimento / Total de Agendamentos
  - Gráfico de área com dados dos últimos 6 meses
  - Lista de itens recentes (atendimentos ou agendamentos)
  - Adaptação baseada em `tipo_marcacao` (atendimento/agendamento)

#### 3. Atendimento (`/atendimento`)
- **Função:** Gestão de atendimentos ou agendamentos
- **Visualizações:**
  - **Lista:** Lista vertical com cards de atendimentos/agendamentos
  - **Kanban:** Visualização em colunas por status
  - **Calendário:** Visualização mensal (apenas para tipo agendamento)
- **Funcionalidades:**
  - Filtros por status
  - Busca de atendimentos/agendamentos
  - Sidebar com detalhes ao clicar em um item
  - Atualização de status via drag-and-drop no Kanban
  - Atualização em tempo real via Supabase Realtime

#### 4. Mensagens (`/mensagens`)
- **Função:** Central de mensagens estilo WhatsApp
- **Estrutura:**
  - Lista de conversas à esquerda
  - Área de chat à direita
- **Funcionalidades:**
  - Busca de conversas
  - Visualização de mensagens em tempo real
  - Suporte a múltiplos tipos de mídia:
    - Texto
    - Áudio (player customizado)
    - Imagens (com zoom e download)
    - Documentos (com download)
  - Timeline com logs de atendimentos e agendamentos
  - Badges de status de atendimento/agendamento
  - Abertura de detalhes via sidebar

#### 5. Configurações (`/configuracoes`)
- **Função:** Configurações pessoais e integrações
- **Funcionalidades:**
  - Edição de nome do perfil
  - Visualização e edição de email (somente leitura)
  - Gerenciamento de conexão WhatsApp:
    - Status da conexão (conectado/desconectado/conectando/erro)
    - Conexão via QR Code
    - Desconexão de número
  - Integração Google Calendar (em desenvolvimento)

### Páginas Administrativas

#### 6. Dashboard Admin (`/admin/dashboard`)
- **Função:** Dashboard administrativo com estatísticas globais
- **Funcionalidades:**
  - Card: Clientes Ativos
  - Card: Clientes em Teste
  - Card: Clientes em Produção
  - Acesso restrito a usuários com tipo `administracao`

#### 7. Clientes Admin (`/admin/clientes`)
- **Função:** Gestão completa de clientes
- **Funcionalidades:**
  - Listagem de todos os clientes em tabela
  - Busca por nome ou telefone
  - Paginação (6 itens por página)
  - Informações exibidas:
    - Nome do cliente
    - Telefone IA
    - Status de conexão Evolution API
    - Tipo de marcação (atendimento/agendamento)
    - Fase (teste/produção)
    - Status (ativo/inativo)
  - Ações disponíveis:
    - Criar novo cliente
    - Editar dados do cliente
    - Editar nome da instância WhatsApp
    - Publicar/Voltar agente (alterar fase)
    - Desativar cliente
    - Excluir cliente (com dupla confirmação)
  - Exibição de credenciais após criação

---

## 🔐 Sistema de Permissões e Cargos

### Tipos de Usuário

O sistema possui dois tipos principais de usuários:

#### 1. Cliente (`tipo: 'cliente'`)
- **Permissões:**
  - Acesso ao Dashboard próprio
  - Gestão de seus próprios atendimentos/agendamentos
  - Visualização de suas próprias mensagens
  - Configurações pessoais
  - Conexão com WhatsApp via instâncias próprias
- **Restrições:**
  - Não pode acessar páginas administrativas
  - Não pode ver dados de outros clientes
  - Acesso limitado apenas aos seus próprios dados

#### 2. Administração (`tipo: 'administracao'`)
- **Permissões:**
  - Acesso ao Dashboard administrativo
  - Gestão completa de todos os clientes
  - Visualização de todos os clientes e suas instâncias
  - Criação, edição e exclusão de clientes
  - Alteração de fase de clientes (teste/produção)
  - Visualização de estatísticas globais
- **Restrições:**
  - Não pode alterar outros administradores
  - Não pode excluir outros administradores

### Fases de Cliente

Clientes podem estar em duas fases:

#### 1. Teste (`fase: 'teste'`)
- Cliente em fase de testes
- Status padrão para novos clientes

#### 2. Produção (`fase: 'producao'`)
- Cliente publicado e em produção
- Pode ser revertido para teste pelo administrador

### Tipos de Marcação

Usuários podem ter dois tipos de marcação:

#### 1. Atendimento (`tipo_marcacao: 'atendimento'`)
- Foco em atendimentos humanos
- Visualizações: Lista e Kanban
- Sem visualização de calendário

#### 2. Agendamento (`tipo_marcacao: 'agendamento'`)
- Foco em agendamentos
- Visualizações: Lista, Kanban e Calendário
- Integração com Google Calendar (planejado)

### Status de Atendimentos

- **Aberto:** Atendimento criado, aguardando ação
- **Em Andamento:** Atendimento sendo processado
- **Encerrado:** Atendimento finalizado

### Status de Agendamentos

- **Agendado:** Agendamento criado
- **Confirmado:** Agendamento confirmado
- **Cancelado:** Agendamento cancelado
- **Concluído:** Agendamento realizado

### Status de Instâncias WhatsApp

- **Conectado:** Instância ativa e conectada
- **Desconectado:** Instância desconectada
- **Conectando:** Em processo de conexão
- **Erro:** Erro na conexão

---

## 🔒 Autenticação e Segurança

### Sistema de Autenticação

- **Provider:** Supabase Auth
- **Método:** Email e senha
- **Gestão de Sessão:** Automática via Supabase
- **Proteção de Rotas:** Middleware Next.js

### Row Level Security (RLS)

Todas as tabelas possuem políticas RLS configuradas:

#### Políticas Gerais
- Usuários só veem seus próprios dados
- Administradores veem todos os dados de clientes
- Cada registro é vinculado ao `usuario_id`

#### Função Auxiliar `is_admin()`
```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM usuarios 
    WHERE id = auth.uid() AND tipo = 'administracao'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Guards de Rota

- **`AdminRouteGuard`:** Componente que verifica se o usuário é administrador antes de permitir acesso às páginas administrativas
- **Middleware:** Redireciona usuários não autenticados para `/login`

---

## 🔌 Integrações

### 1. Evolution API

#### Funcionalidades
- Conexão de instâncias WhatsApp via QR Code
- Recebimento de mensagens em tempo real
- Identificação de usuários por número de telefone
- Sincronização de status de conexão
- Desconexão de instâncias

#### Webhook
- Endpoint: `/api/webhooks/evolution`
- Recebe eventos da Evolution API
- Processa mensagens, status e conexões

### 2. Supabase Realtime

#### Funcionalidades
- Atualização em tempo real de:
  - Mensagens
  - Atendimentos
  - Agendamentos
  - Status de conexão WhatsApp
- Notificações push para novos itens

### 3. Google Calendar (Planejado)

- Sincronização de agendamentos
- Integração via OAuth
- Atualmente marcado como "em desenvolvimento"

---

## 🌐 APIs e Endpoints

### APIs Administrativas

Todas as APIs administrativas requerem autenticação e verificação de tipo `administracao`.

#### 1. Criar Cliente
- **Endpoint:** `POST /api/admin/criar-cliente`
- **Body:**
  ```json
  {
    "nome": "string",
    "email": "string",
    "senha": "string",
    "telefone_ia": "string",
    "tipo_marcacao": "atendimento" | "agendamento",
    "fase": "teste" | "producao"
  }
  ```
- **Resposta:** Credenciais do cliente criado

#### 2. Editar Email do Cliente
- **Endpoint:** `POST /api/admin/editar-email-cliente`
- **Body:**
  ```json
  {
    "clienteId": "uuid",
    "email": "string"
  }
  ```

#### 3. Buscar Email do Cliente
- **Endpoint:** `GET /api/admin/buscar-email-cliente?id=uuid`
- **Resposta:** Email do cliente

#### 4. Editar Nome da Instância
- **Endpoint:** `POST /api/admin/editar-nome-instancia`
- **Body:**
  ```json
  {
    "instanciaId": "uuid",
    "nomeInstancia": "string"
  }
  ```

#### 5. Desativar Cliente
- **Endpoint:** `POST /api/admin/desativar-cliente`
- **Body:**
  ```json
  {
    "clienteId": "uuid"
  }
  ```
- **Efeito:** Define `ativo = false` na tabela `usuarios`

#### 6. Excluir Cliente
- **Endpoint:** `DELETE /api/admin/excluir-cliente?id=uuid`
- **Efeito:** Exclui o cliente e todos os dados relacionados (cascade)

#### 7. Atualizar Fase do Cliente
- **Endpoint:** `POST /api/admin/atualizar-fase-cliente`
- **Body:**
  ```json
  {
    "clienteId": "uuid",
    "fase": "teste" | "producao"
  }
  ```

### Webhooks

#### Evolution API Webhook
- **Endpoint:** `POST /api/webhooks/evolution`
- **Função:** Recebe eventos da Evolution API
- **Eventos Processados:**
  - Novas mensagens
  - Status de conexão
  - QR Code para conexão

---

## 🗄️ Estrutura de Banco de Dados

### Tabelas Principais

#### 1. `usuarios`
Armazena informações dos usuários do sistema.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID (PK) | ID do usuário (mesmo do Supabase Auth) |
| `nome` | TEXT | Nome do usuário |
| `telefone_ia` | TEXT | Telefone da IA do usuário |
| `tipo_marcacao` | TEXT | Tipo: 'atendimento' ou 'agendamento' |
| `tipo` | TEXT | Tipo: 'cliente' ou 'administracao' |
| `fase` | TEXT | Fase: 'teste' ou 'producao' |
| `ativo` | BOOLEAN | Status ativo/inativo |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data de atualização |

**Relacionamentos:**
- 1:N com `clientes`
- 1:N com `whatsapp_instances`
- 1:N com `atendimentos_solicitado`
- 1:N com `agendamentos`

#### 2. `clientes`
Armazena informações dos clientes (contatos).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID (PK) | ID único do cliente |
| `nome` | TEXT | Nome do cliente |
| `telefone` | TEXT | Telefone do cliente |
| `foto_perfil` | VARCHAR | URL da foto de perfil |
| `usuario_id` | UUID (FK) | Referência ao usuário dono |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data de atualização |

**Relacionamentos:**
- N:1 com `usuarios`
- 1:N com `atendimentos_solicitado`
- 1:N com `agendamentos`

#### 3. `whatsapp_instances`
Armazena instâncias WhatsApp conectadas.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID (PK) | ID único da instância |
| `usuario_id` | UUID (FK) | Referência ao usuário |
| `telefone` | TEXT | Telefone da instância |
| `instance_name` | TEXT | Nome da instância |
| `evolution_api_instance_id` | TEXT | ID na Evolution API |
| `status` | TEXT | Status: 'conectado', 'desconectado', 'conectando', 'erro' |
| `qr_code` | VARCHAR | QR Code para conexão |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data de atualização |

**Relacionamentos:**
- N:1 com `usuarios`
- 1:N com `atendimentos_solicitado`

#### 4. `atendimentos_solicitado`
Armazena solicitações de atendimento humano.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID (PK) | ID único do atendimento |
| `usuario_id` | UUID (FK) | Referência ao usuário |
| `cliente_id` | UUID (FK) | Referência ao cliente |
| `whatsapp_instance_id` | UUID (FK) | Referência à instância WhatsApp |
| `resumo_conversa` | VARCHAR | Resumo da conversa |
| `status` | TEXT | Status: 'aberto', 'em_andamento', 'encerrado' |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data de atualização |

**Relacionamentos:**
- N:1 com `usuarios`
- N:1 com `clientes`
- N:1 com `whatsapp_instances`

#### 5. `agendamentos`
Armazena agendamentos criados pela IA.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID (PK) | ID único do agendamento |
| `cliente_id` | UUID (FK) | Referência ao cliente |
| `usuario_id` | UUID (FK) | Referência ao usuário |
| `data_e_hora` | TIMESTAMPTZ | Data e hora do agendamento |
| `resumo_conversa` | VARCHAR | Resumo da conversa |
| `link_agendamento` | TEXT | Link da reunião/agendamento |
| `status` | TEXT | Status: 'agendado', 'confirmado', 'cancelado', 'concluido' |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data de atualização |

**Relacionamentos:**
- N:1 com `clientes`
- N:1 com `usuarios`

#### 6. `mensagens`
Armazena todas as mensagens trocadas.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID (PK) | ID único da mensagem |
| `cliente_id` | UUID (FK) | Referência ao cliente |
| `usuario_id` | UUID (FK) | Referência ao usuário |
| `atendimento_id` | UUID (FK) | Referência ao atendimento (opcional) |
| `mensagem` | TEXT | Conteúdo da mensagem |
| `remetente` | TEXT | 'cliente' ou 'usuario' |
| `data_e_hora` | TIMESTAMPTZ | Data e hora da mensagem |
| `base64_audio` | TEXT | Áudio em base64 (opcional) |
| `base64_imagem` | TEXT | Imagem em base64 (opcional) |
| `base64_documento` | TEXT | Documento em base64 (opcional) |
| `created_at` | TIMESTAMPTZ | Data de criação |

**Relacionamentos:**
- N:1 com `clientes`
- N:1 com `usuarios`
- N:1 com `atendimentos_solicitado` (opcional)

### Índices

- `idx_usuarios_tipo` - Consultas por tipo de usuário
- `idx_usuarios_fase` - Consultas por fase
- Índices em foreign keys para performance

### Políticas RLS

Todas as tabelas possuem RLS habilitado com políticas que garantem:
- Clientes veem apenas seus próprios dados
- Administradores veem todos os dados de clientes
- Administradores não podem modificar outros administradores

---

## 🧩 Componentes e Funcionalidades

### Componentes de Navegação

#### `Sidebar`
- Menu lateral com navegação principal
- Exibição condicional baseada em tipo de usuário
- Perfil do usuário no rodapé
- Link para configurações
- Botão de logout

#### `Topbar`
- Barra superior com informações do sistema
- Notificações (quando aplicável)

### Componentes de Dashboard

#### `SimpleBarChart`
- Gráfico de barras simples para métricas

#### `SplineAreaChart`
- Gráfico de área com linha suave
- Exibe dados mensais

#### `RecentList`
- Lista de itens recentes
- Suporta atendimentos e agendamentos

### Componentes de Atendimento

#### `AtendimentoList`
- Lista vertical de atendimentos/agendamentos
- Filtros e busca
- Cards clicáveis

#### `AtendimentoKanban`
- Visualização em colunas por status
- Drag-and-drop para atualizar status
- Atualização em tempo real

#### `AtendimentoCalendar`
- Visualização mensal de agendamentos
- Integração com `react-big-calendar`

#### `AtendimentoSidebar`
- Sidebar com detalhes do atendimento/agendamento
- Formulário de atualização de status
- Resumo da conversa

### Componentes Administrativos

#### `AdminRouteGuard`
- Guard de rota para páginas administrativas
- Redireciona usuários não autorizados

#### `CriarClienteModal`
- Modal para criação de novos clientes
- Formulário completo com validação
- Geração de credenciais

#### `EditarClienteModal`
- Modal para edição de dados do cliente
- Validação de campos

#### `EditarNomeInstanciaModal`
- Modal para edição do nome da instância WhatsApp

#### `CredenciaisPopup`
- Popup exibindo credenciais após criação de cliente
- Possibilidade de copiar credenciais

#### `ClienteActionsMenu`
- Menu de ações contextuais para clientes
- Ações baseadas em fase do cliente

### Componentes de Mensagens

#### `AudioPlayerWhatsApp`
- Player de áudio estilo WhatsApp
- Waveform visual
- Controles de reprodução
- Detecção automática de formato

#### `DocumentoMessage`
- Exibição de documentos
- Detecção de tipo de arquivo
- Download de documentos

### Componentes UI Reutilizáveis

#### `Button`
- Botões com variantes (primary, secondary, danger, ghost)
- Tamanhos customizáveis

#### `Card`
- Card com título opcional
- Padding e estilos consistentes

#### `Input`
- Input de formulário com label
- Validação visual

#### `Modal`
- Modal reutilizável
- Tamanhos customizáveis
- Fechamento por clique fora (opcional)

#### `Pagination`
- Paginação simples
- Controle de página atual e total

#### `Tabs`
- Abas para navegação
- Suporte a badges

#### `StatusDropdown`
- Dropdown para seleção de status
- Estilos visuais por status

---

## 🔄 Fluxos de Trabalho

### Fluxo de Login

1. Usuário acessa `/login`
2. Insere email e senha
3. Sistema autentica via Supabase Auth
4. Redireciona para `/dashboard`
5. Se for administrador, redireciona para `/admin/dashboard`

### Fluxo de Conexão WhatsApp

1. Usuário acessa `/configuracoes`
2. Clica em "Conectar" no WhatsApp
3. Modal exibe QR Code
4. Usuário escaneia QR Code no WhatsApp
5. Sistema recebe confirmação via webhook
6. Status atualizado para "conectado"

### Fluxo de Criação de Cliente (Admin)

1. Admin acessa `/admin/clientes`
2. Clica em "Adicionar Cliente"
3. Preenche formulário (nome, email, senha, telefone, tipo)
4. Sistema cria:
   - Usuário no Supabase Auth
   - Registro na tabela `usuarios`
   - Instância WhatsApp (se necessário)
5. Popup exibe credenciais
6. Cliente pode fazer login com as credenciais

### Fluxo de Recebimento de Mensagem

1. Mensagem chega via Evolution API
2. Webhook recebe evento em `/api/webhooks/evolution`
3. Sistema identifica:
   - Cliente pelo número
   - Usuário pela instância WhatsApp
4. Mensagem salva na tabela `mensagens`
5. Cliente criado/atualizado se necessário
6. Atendimento criado se necessário (quando solicitado)
7. Notificação em tempo real via Supabase Realtime
8. Interface atualizada automaticamente

### Fluxo de Atendimento

1. Cliente solicita atendimento humano (via mensagem ou comando)
2. Sistema cria registro em `atendimentos_solicitado`
3. Notificação exibida ao usuário
4. Usuário visualiza em `/atendimento`
5. Atualiza status conforme processa
6. Ao finalizar, marca como "encerrado"

### Fluxo de Agendamento

1. IA cria agendamento durante conversa
2. Registro criado em `agendamentos`
3. Cliente visualiza em `/atendimento` (aba Calendário)
4. Usuário pode confirmar, cancelar ou marcar como concluído
5. Status atualizado em tempo real

---

## 📝 Notas Importantes

1. **Sem Registro de Usuários:** Não há tela de registro público. Usuários são criados apenas por administradores ou diretamente no Supabase.

2. **Identificação por Telefone:** O sistema identifica usuários pelos números de telefone conectados via Evolution API. Cada usuário pode ter múltiplos números.

3. **Cascata de Exclusão:** Quando um cliente é excluído, todos os dados relacionados são excluídos automaticamente (ON DELETE CASCADE).

4. **Realtime:** Todas as tabelas principais estão habilitadas para Realtime, permitindo atualizações instantâneas na interface.

5. **Filtragem Automática:** O sistema automaticamente filtra dados baseado no `usuario_id` do usuário logado, exceto para administradores que veem todos os dados.

6. **Validação de Tipos:** Todos os campos de tipo, fase e status possuem CHECK constraints no banco para garantir valores válidos.

---

## 🚀 Conclusão

Este sistema oferece uma solução completa para gestão de atendimentos e agendamentos com integração WhatsApp, permitindo que empresas gerenciem suas interações com clientes de forma eficiente e organizada. O sistema é escalável, seguro e oferece uma experiência de usuário moderna e intuitiva.

