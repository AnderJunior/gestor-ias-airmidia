import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { triggerWebhookAtualizarStatusCliente } from '@/lib/api/webhookTrigger';

// Função para obter cliente Supabase com anon key
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Variáveis de ambiente do Supabase não configuradas');
  }
  
  return createClient(supabaseUrl, supabaseAnonKey);
}

// Função para obter cliente Supabase admin
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Variáveis de ambiente do Supabase não configuradas');
  }
  
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabaseClient = getSupabaseClient();
    const supabaseAdmin = getSupabaseAdmin();
    
    // Verificar autenticação do usuário
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Extrair token do header
    const token = authHeader.replace('Bearer ', '');
    
    // Verificar token e obter usuário
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verificar se o usuário é administrador
    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from('usuarios')
      .select('tipo')
      .eq('id', user.id)
      .single();

    if (usuarioError || !usuario || usuario.tipo !== 'administracao') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem atualizar a fase dos clientes.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { clienteId, fase } = body;

    if (!clienteId) {
      return NextResponse.json(
        { error: 'ID do cliente é obrigatório' },
        { status: 400 }
      );
    }

    if (!fase || typeof fase !== 'string' || fase.trim() === '') {
      return NextResponse.json(
        { error: 'Fase é obrigatória e deve ser uma string válida' },
        { status: 400 }
      );
    }

    // Verificar se o cliente existe e não é administrador
    // Buscar dados completos incluindo fase anterior
    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from('usuarios')
      .select('id, tipo, nome, telefone_ia, fase')
      .eq('id', clienteId)
      .single();

    if (clienteError || !cliente) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      );
    }

    if (cliente.tipo === 'administracao') {
      return NextResponse.json(
        { error: 'Não é possível alterar a fase de um administrador' },
        { status: 403 }
      );
    }

    // Buscar etapa atual do kanban antes de atualizar
    // A fase do cliente é o ID da coluna do kanban (pode ser TEXT ou string 'teste'/'producao')
    let etapaAnterior = null;
    let etapaAnteriorId = null;
    if (cliente.fase) {
      // Primeiro, tentar buscar na tabela kanban_colunas (a coluna é 'name', não 'nome')
      const { data: kanbanColunaAnterior, error: kanbanErrorAnterior } = await supabaseAdmin
        .from('kanban_colunas')
        .select('id, name')
        .eq('id', cliente.fase)
        .maybeSingle();
      
      if (kanbanErrorAnterior) {
        console.error('Erro ao buscar coluna kanban anterior:', kanbanErrorAnterior);
      }
      
      if (kanbanColunaAnterior) {
        etapaAnterior = kanbanColunaAnterior.name;
        etapaAnteriorId = kanbanColunaAnterior.id;
      } else if (cliente.fase === 'teste' || cliente.fase === 'producao') {
        // Se for uma fase padrão, usar o nome da fase
        etapaAnterior = cliente.fase === 'teste' ? 'Teste' : 'Produção';
        etapaAnteriorId = cliente.fase;
      } else {
        // Se não encontrou e não é fase padrão, usar o valor da fase como fallback
        etapaAnterior = cliente.fase;
        etapaAnteriorId = cliente.fase;
      }
    }

    // Atualizar fase do cliente
    const { data: updatedCliente, error: updateError } = await supabaseAdmin
      .from('usuarios')
      .update({ 
        fase,
        updated_at: new Date().toISOString()
      })
      .eq('id', clienteId)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar fase do cliente:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Erro ao atualizar fase do cliente' },
        { status: 500 }
      );
    }

    // Buscar nova etapa do kanban após atualização
    // A fase do cliente é o ID da coluna do kanban (pode ser TEXT ou string 'teste'/'producao')
    let etapaNova = null;
    let etapaNovaId = null;
    if (fase) {
      // Primeiro, tentar buscar na tabela kanban_colunas (a coluna é 'name', não 'nome')
      const { data: kanbanColunaNova, error: kanbanErrorNova } = await supabaseAdmin
        .from('kanban_colunas')
        .select('id, name')
        .eq('id', fase)
        .maybeSingle();
      
      if (kanbanErrorNova) {
        console.error('Erro ao buscar coluna kanban nova:', kanbanErrorNova);
      }
      
      if (kanbanColunaNova) {
        etapaNova = kanbanColunaNova.name;
        etapaNovaId = kanbanColunaNova.id;
      } else if (fase === 'teste' || fase === 'producao') {
        // Se for uma fase padrão, usar o nome da fase
        etapaNova = fase === 'teste' ? 'Teste' : 'Produção';
        etapaNovaId = fase;
      } else {
        // Se não encontrou e não é fase padrão, usar o valor da fase como fallback
        etapaNova = fase;
        etapaNovaId = fase;
      }
    }

    // Acionar webhooks baseado na mudança
    const faseAnterior = cliente.fase || 'teste';
    const faseNova = fase;

    // Sempre acionar webhook de atualização de status (mudança de etapa no kanban)
    if (etapaAnterior !== etapaNova || faseAnterior !== faseNova) {
      try {
        await triggerWebhookAtualizarStatusCliente({
          id: updatedCliente.id,
          nome: updatedCliente.nome || '',
          telefone: updatedCliente.telefone_ia || '',
          etapa_anterior: etapaAnterior || null,
          etapa_anterior_id: etapaAnteriorId || null,
          etapa_nova: etapaNova || null,
          etapa_nova_id: etapaNovaId || null,
          usuario_id: updatedCliente.id,
          updated_at: updatedCliente.updated_at,
          usuario: {
            id: user.id,
            nome: null,
            telefone_ia: null,
          },
        }, user.id); // Passar o usuario_id do admin
      } catch (err) {
        console.error('Erro ao acionar webhook atualizar_status_cliente:', err);
      }
    }

    return NextResponse.json(
      { 
        success: true,
        cliente: updatedCliente,
        message: `Fase do cliente atualizada para ${fase} com sucesso`
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Erro ao atualizar fase do cliente:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

