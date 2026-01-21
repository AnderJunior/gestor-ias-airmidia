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

export async function GET(request: NextRequest) {
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
        { error: 'Acesso negado. Apenas administradores podem listar outros administradores.' },
        { status: 403 }
      );
    }

    // Buscar todos os administradores da tabela usuarios
    const { data: administradores, error: adminError } = await supabaseAdmin
      .from('usuarios')
      .select('*')
      .eq('tipo', 'administracao')
      .order('nome', { ascending: true });

    if (adminError) {
      console.error('Erro ao buscar administradores:', adminError);
      return NextResponse.json(
        { error: 'Erro ao buscar administradores' },
        { status: 500 }
      );
    }

    if (!administradores || administradores.length === 0) {
      return NextResponse.json(
        { administradores: [] },
        { status: 200 }
      );
    }

    // Buscar e-mail de cada administrador individualmente usando getUserById
    const administradoresComEmail = await Promise.all(
      administradores.map(async (admin) => {
        try {
          const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(admin.id);
          
          if (authUserError || !authUser.user) {
            console.error(`Erro ao buscar e-mail do administrador ${admin.id}:`, authUserError);
            return {
              ...admin,
              email: null,
            };
          }

          return {
            ...admin,
            email: authUser.user.email || null,
          };
        } catch (error) {
          console.error(`Erro ao buscar e-mail do administrador ${admin.id}:`, error);
          return {
            ...admin,
            email: null,
          };
        }
      })
    );

    return NextResponse.json(
      { administradores: administradoresComEmail },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Erro ao listar administradores:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
