import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { triggerWebhookDesativarCliente, triggerWebhookAtivarDesativarCliente } from '@/lib/api/webhookTrigger';

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
        { error: 'Acesso negado. Apenas administradores podem ativar/desativar clientes.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { clienteId, ativo } = body;

    if (!clienteId) {
      return NextResponse.json(
        { error: 'ID do cliente é obrigatório' },
        { status: 400 }
      );
    }

    // Se ativo não foi fornecido, assumir desativar (false) para manter compatibilidade
    const novoStatusAtivo = ativo !== undefined ? ativo : false;

    // Verificar se o cliente existe e não é administrador
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
        { error: 'Não é possível ativar/desativar um administrador' },
        { status: 403 }
      );
    }

    // Buscar etapa atual do kanban se existir
    // A fase do cliente é o ID da coluna do kanban (a coluna é 'name', não 'nome')
    let etapaAtual = null;
    let etapaAtualId = null;
    if (cliente.fase) {
      const { data: kanbanColuna } = await supabaseAdmin
        .from('kanban_colunas')
        .select('id, name')
        .eq('id', cliente.fase)
        .maybeSingle();
      
      if (kanbanColuna) {
        etapaAtual = kanbanColuna.name;
        etapaAtualId = kanbanColuna.id;
      } else if (cliente.fase === 'teste' || cliente.fase === 'producao') {
        // Se for uma fase padrão, usar o nome da fase
        etapaAtual = cliente.fase === 'teste' ? 'Teste' : 'Produção';
        etapaAtualId = cliente.fase;
      } else {
        // Se não encontrou e não é fase padrão, usar o valor da fase como fallback
        etapaAtual = cliente.fase;
        etapaAtualId = cliente.fase;
      }
    }

    // Ativar ou desativar cliente (alterar campo ativo)
    const { data: updatedCliente, error: updateError } = await supabaseAdmin
      .from('usuarios')
      .update({ ativo: novoStatusAtivo })
      .eq('id', clienteId)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar status do cliente:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Erro ao atualizar status do cliente' },
        { status: 500 }
      );
    }

    // Acionar webhook - passar o usuario_id do admin que está ativando/desativando
    try {
      await triggerWebhookAtivarDesativarCliente({
        id: updatedCliente.id,
        nome: updatedCliente.nome || '',
        telefone: updatedCliente.telefone_ia || '',
        foto_perfil: undefined,
        usuario_id: updatedCliente.id,
        etapa_atual: etapaAtual,
        etapa_atual_id: etapaAtualId,
        ativo: novoStatusAtivo,
        updated_at: updatedCliente.updated_at,
        usuario: {
          id: user.id,
          nome: null,
          telefone_ia: null,
        },
      }, user.id); // Passar o usuario_id do admin
    } catch (err) {
      console.error('Erro ao acionar webhook ativar_desativar_cliente:', err);
    }

    return NextResponse.json(
      { 
        success: true,
        cliente: updatedCliente,
        message: novoStatusAtivo ? 'Cliente ativado com sucesso' : 'Cliente desativado com sucesso'
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Erro ao desativar cliente:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

