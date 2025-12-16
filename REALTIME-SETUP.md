# Configuração de Realtime no Supabase

Este documento explica como habilitar atualizações em tempo real no sistema.

## ✅ O que já está implementado

O sistema já possui subscriptions em tempo real configuradas para:

1. **Dashboard Stats** (`useDashboardStats`)
   - Escuta mudanças em `atendimentos_solicitado`
   - Escuta mudanças em `whatsapp_instances`
   - Atualiza automaticamente as estatísticas

2. **Atendimentos** (`useAtendimentos`)
   - Escuta mudanças em `atendimentos_solicitado`
   - Escuta mudanças em `clientes` (quando nome é atualizado)
   - Escuta mudanças em `whatsapp_instances` (quando status muda)
   - Atualiza automaticamente a lista de atendimentos

3. **Mensagens** (`useMensagens`)
   - Escuta mudanças em `mensagens`
   - Atualiza automaticamente quando novas mensagens são adicionadas

4. **Usuários** (`useUsuario`)
   - Escuta mudanças em `usuarios`
   - Atualiza automaticamente os dados do usuário

5. **Instâncias WhatsApp** (`useWhatsAppInstances` e `useConnectedInstances`)
   - Escuta mudanças em `whatsapp_instances`
   - Atualiza automaticamente o status das conexões

## 🔧 Como habilitar Realtime no Supabase

### Passo 1: Executar o script SQL

Execute o arquivo `enable-realtime.sql` no SQL Editor do Supabase:

1. Acesse o painel do Supabase
2. Vá em **SQL Editor**
3. Clique em **New Query**
4. Cole o conteúdo do arquivo `enable-realtime.sql`
5. Clique em **Run**

Este script habilita o Realtime nas seguintes tabelas:
- `usuarios`
- `whatsapp_instances`
- `clientes`
- `atendimentos_solicitado` (ou `atendimentos`)
- `mensagens`

### Passo 2: Verificar se está funcionando

Após executar o script, você pode verificar se as tabelas foram adicionadas corretamente executando:

```sql
SELECT 
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;
```

Você deve ver todas as tabelas listadas acima.

## 🚀 Como funciona

### Cliente Supabase

O cliente Supabase está configurado em `src/lib/supabaseClient.ts` com suporte a Realtime:

```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
```

### Hooks com Realtime

Todos os hooks que precisam de atualizações em tempo real:

1. Fazem uma busca inicial dos dados
2. Criam uma subscription para mudanças na tabela
3. Atualizam o estado automaticamente quando há mudanças
4. Fazem cleanup quando o componente desmonta

### Exemplo de uso

```typescript
// Em qualquer componente
const { atendimentos, loading } = useAtendimentos();

// Os atendimentos serão atualizados automaticamente
// quando houver mudanças no Supabase, sem precisar
// recarregar a página ou fazer novas requisições
```

## 📝 Notas importantes

1. **RLS (Row Level Security)**: Certifique-se de que as políticas RLS estão configuradas corretamente. O Realtime respeita as mesmas políticas de segurança.

2. **Performance**: O sistema está configurado para processar até 10 eventos por segundo. Se precisar de mais, ajuste em `supabaseClient.ts`.

3. **Conexões**: Cada hook cria uma conexão WebSocket separada. Isso é normal e o Supabase gerencia automaticamente.

4. **Filtros**: As subscriptions usam filtros para escutar apenas mudanças relevantes ao usuário logado, melhorando a performance.

## 🔍 Troubleshooting

### Realtime não está funcionando

1. Verifique se executou o script `enable-realtime.sql`
2. Verifique se as tabelas estão na publicação `supabase_realtime`
3. Verifique o console do navegador para erros
4. Verifique se as políticas RLS permitem leitura

### Mudanças não aparecem

1. Verifique se a mudança foi realmente feita no Supabase
2. Verifique se o usuário tem permissão para ver os dados (RLS)
3. Verifique o console para mensagens de erro
4. Verifique se o hook está sendo usado corretamente

### Muitas atualizações

Se houver muitas atualizações simultâneas, o sistema pode fazer múltiplas requisições. Isso é normal e o sistema está otimizado para lidar com isso usando cache e debouncing interno.

