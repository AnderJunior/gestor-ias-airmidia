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
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
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
        { error: 'Acesso negado. Apenas administradores podem editar clientes.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { clienteId, email } = body;

    if (!clienteId || !email) {
      return NextResponse.json(
        { error: 'ID do cliente e e-mail são obrigatórios' },
        { status: 400 }
      );
    }

    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'E-mail inválido' },
        { status: 400 }
      );
    }

    // Verificar se o cliente existe e não é administrador
    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from('usuarios')
      .select('tipo')
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
        { error: 'Não é possível editar e-mail de administradores' },
        { status: 403 }
      );
    }

    // Verificar se o email já está em uso por outro usuário
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const emailExists = existingUser.users.some(
      u => u.email === email && u.id !== clienteId
    );

    if (emailExists) {
      return NextResponse.json(
        { error: 'Este e-mail já está em uso por outro usuário' },
        { status: 400 }
      );
    }

    // Atualizar email no Supabase Auth
    const { data: authData, error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
      clienteId,
      {
        email: email.trim(),
        email_confirm: true, // Confirmar email automaticamente
      }
    );

    if (updateAuthError) {
      console.error('Erro ao atualizar email no Auth:', updateAuthError);
      return NextResponse.json(
        { error: updateAuthError.message || 'Erro ao atualizar e-mail' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        success: true, 
        message: 'E-mail atualizado com sucesso'
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Erro ao editar email do cliente:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

