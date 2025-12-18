import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente Supabase com anon key para verificar autenticação
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Usar service role key para operações administrativas (apenas no servidor)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: NextRequest) {
  try {
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
        { error: 'Acesso negado. Apenas administradores podem desativar clientes.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { clienteId } = body;

    if (!clienteId) {
      return NextResponse.json(
        { error: 'ID do cliente é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se o cliente existe e não é administrador
    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from('usuarios')
      .select('id, tipo')
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
        { error: 'Não é possível desativar um administrador' },
        { status: 403 }
      );
    }

    // Desativar cliente (alterar campo ativo para false)
    const { data: updatedCliente, error: updateError } = await supabaseAdmin
      .from('usuarios')
      .update({ ativo: false })
      .eq('id', clienteId)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao desativar cliente:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Erro ao desativar cliente' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        success: true,
        cliente: updatedCliente,
        message: 'Cliente desativado com sucesso'
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

