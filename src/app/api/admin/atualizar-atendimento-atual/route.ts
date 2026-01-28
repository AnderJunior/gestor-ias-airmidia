import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    const body = await request.json();
    const { clienteId, atendimentoAtual } = body;

    if (!clienteId) {
      return NextResponse.json(
        { error: 'ID do cliente é obrigatório' },
        { status: 400 }
      );
    }

    if (!atendimentoAtual || !['ia', 'humano', 'pausa'].includes(atendimentoAtual)) {
      return NextResponse.json(
        { error: 'Tipo de atendimento inválido. Deve ser: ia, humano ou pausa' },
        { status: 400 }
      );
    }

    // Verificar se o cliente existe e se o usuário tem permissão para atualizar
    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from('clientes')
      .select('id, usuario_id')
      .eq('id', clienteId)
      .single();

    if (clienteError || !cliente) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se o usuário é administrador ou se o cliente pertence ao usuário
    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from('usuarios')
      .select('tipo')
      .eq('id', user.id)
      .single();

    const isAdmin = usuario && usuario.tipo === 'administracao';
    const isOwnCliente = cliente.usuario_id === user.id;

    if (!isAdmin && !isOwnCliente) {
      return NextResponse.json(
        { error: 'Você só pode atualizar o atendimento dos seus próprios clientes' },
        { status: 403 }
      );
    }

    // Atualizar atendimento_atual na tabela clientes
    const { data: updatedCliente, error: updateError } = await supabaseAdmin
      .from('clientes')
      .update({
        atendimento_atual: atendimentoAtual,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clienteId)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar atendimento_atual:', updateError);
      return NextResponse.json(
        { error: 'Erro ao atualizar tipo de atendimento' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      cliente: updatedCliente,
    });
  } catch (error: any) {
    console.error('Erro ao atualizar atendimento_atual:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
