# Integração com Evolution API

Este documento explica como integrar o sistema com a Evolution API para identificar usuários pelos seus números de telefone conectados.

## Visão Geral

O sistema identifica automaticamente qual usuário está relacionado a cada mensagem e atendimento através do número de telefone conectado via Evolution API. Cada usuário pode ter um ou mais números de telefone conectados.

## Estrutura do Banco de Dados

### Tabela `whatsapp_instances`

Armazena as conexões WhatsApp de cada usuário:

- `usuario_id`: ID do usuário do sistema (Supabase Auth)
- `telefone`: Número do telefone conectado (ex: 5511999999999)
- `instance_name`: Nome da instância na Evolution API
- `evolution_api_instance_id`: ID da instância na Evolution API
- `status`: Status da conexão (conectado, desconectado, conectando, erro)

### Tabela `atendimentos`

Cada atendimento está associado a:
- `telefone_cliente`: Número do cliente que está sendo atendido
- `telefone_usuario`: Número do usuário que está fazendo o atendimento
- `usuario_id`: ID do usuário (opcional, pode ser identificado pelo telefone)

### Tabela `mensagens`

Cada mensagem contém:
- `telefone_remetente`: Número que enviou a mensagem
- `telefone_destinatario`: Número que recebeu a mensagem

## Fluxo de Identificação

1. **Conexão WhatsApp**: Quando um usuário conecta seu WhatsApp via Evolution API:
   - A instância é criada/atualizada na tabela `whatsapp_instances`
   - O `telefone` é associado ao `usuario_id`

2. **Recebimento de Mensagem**: Quando uma mensagem chega via Evolution API:
   - O sistema identifica o `telefone_usuario` pelo número que recebeu a mensagem
   - Busca ou cria um atendimento para o `telefone_cliente`
   - Cria a mensagem associando os telefones

3. **Visualização**: Quando um usuário acessa o sistema:
   - O sistema busca todos os `telefone_usuario` associados ao usuário logado
   - Filtra atendimentos e mensagens apenas dos seus números

## Configuração da Evolution API

### 1. Criar Instância WhatsApp

Quando um usuário conecta seu WhatsApp, você precisa:

```typescript
import { upsertWhatsAppInstance } from '@/lib/api/whatsapp';

// Quando a instância é criada na Evolution API
await upsertWhatsAppInstance(
  '5511999999999', // telefone
  'Instância Principal', // instance_name
  'instance-id-from-evolution', // evolution_api_instance_id
  'conectado' // status
);
```

### 2. Configurar Webhook

Configure o webhook da Evolution API para apontar para:
```
POST https://seu-dominio.com/api/webhooks/evolution
```

### 3. Processar Eventos

O webhook processa os seguintes eventos:

- `messages.upsert`: Mensagens recebidas/enviadas
- `connection.update`: Atualizações de status de conexão
- `qrcode.updated`: QR Code atualizado

## Exemplo de Uso

### Criar Atendimento Automaticamente

Quando uma mensagem chega via Evolution API:

```typescript
import { createMensagemFromEvolutionAPI } from '@/lib/api/mensagens';

// Processar mensagem recebida
await createMensagemFromEvolutionAPI(
  '5511888888888', // telefone_remetente (cliente)
  '5511999999999', // telefone_destinatario (usuário)
  'Olá, preciso de ajuda', // conteudo
  'message-id-123' // message_id da Evolution API
);
```

Esta função:
1. Busca um atendimento ativo para esse cliente e telefone do usuário
2. Se não encontrar, cria um novo atendimento
3. Cria a mensagem associada ao atendimento

### Buscar Atendimentos do Usuário

```typescript
import { getAtendimentos } from '@/lib/api/atendimentos';

// Retorna apenas atendimentos dos telefones conectados do usuário logado
const atendimentos = await getAtendimentos();
```

### Identificar Usuário pelo Telefone

```typescript
import { getUsuarioByTelefone } from '@/lib/api/whatsapp';

// Identifica qual usuário possui este telefone conectado
const usuarioId = await getUsuarioByTelefone('5511999999999');
```

## Segurança (RLS)

O sistema usa Row Level Security (RLS) para garantir que:

- Usuários só veem atendimentos dos seus próprios números de telefone
- Usuários só podem criar atendimentos usando seus números conectados
- Mensagens são filtradas automaticamente pelos atendimentos do usuário

## Funções Auxiliares

### Atualizar Status da Conexão

```typescript
import { updateWhatsAppInstanceStatus } from '@/lib/api/whatsapp';

await updateWhatsAppInstanceStatus(
  '5511999999999',
  'conectado',
  qrCode // opcional, apenas quando status = 'conectando'
);
```

### Buscar Instâncias Conectadas

```typescript
import { getConnectedInstances } from '@/lib/api/whatsapp';

const instancias = await getConnectedInstances();
// Retorna apenas instâncias com status = 'conectado' do usuário logado
```

## Próximos Passos

1. **Completar Integração Evolution API**: 
   - Implementar função `getTelefoneByInstanceName` em `src/lib/api/evolution.ts`
   - Configurar webhook na Evolution API

2. **Testar Fluxo Completo**:
   - Conectar WhatsApp via Evolution API
   - Enviar mensagem de teste
   - Verificar se atendimento é criado automaticamente
   - Verificar se mensagem aparece no sistema

3. **Melhorias Futuras**:
   - Interface para gerenciar conexões WhatsApp
   - Visualização de QR Code para conexão
   - Notificações em tempo real de novas mensagens







