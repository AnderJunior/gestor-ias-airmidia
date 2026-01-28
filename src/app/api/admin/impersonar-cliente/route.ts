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
        { error: 'Acesso negado. Apenas administradores podem entrar na conta de clientes.' },
        { status: 403 }
      );
    }

    // Obter dados do corpo da requisição
    const body = await request.json();
    const clienteId = body.clienteId;

    if (!clienteId) {
      return NextResponse.json(
        { error: 'ID do cliente é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar email do cliente no Supabase Auth
    const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(clienteId);

    if (authUserError || !authUser.user) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      );
    }

    const clienteEmail = authUser.user.email;
    if (!clienteEmail) {
      return NextResponse.json(
        { error: 'Cliente não possui email cadastrado' },
        { status: 400 }
      );
    }

    // Obter a URL de redirecionamento (dashboard do cliente)
    // Detectar corretamente se está em localhost ou produção
    const host = request.headers.get('host') || '';
    const protocol = request.headers.get('x-forwarded-proto') || 
                     (host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https');
    
    let origin: string;
    
    // Se estiver em localhost, usar localhost:3000
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      origin = 'http://localhost:3000';
    } else {
      // Caso contrário, construir a URL baseada no host da requisição
      origin = `${protocol}://${host}`;
    }
    
    const redirectTo = `${origin}/dashboard`;

    // Gerar magic link para login do cliente
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: clienteEmail,
      options: {
        redirectTo,
      },
    });
    
    if (linkError || !linkData) {
      console.error('Erro ao gerar magic link:', linkError);
      return NextResponse.json(
        { error: 'Erro ao gerar link de acesso. Tente novamente.' },
        { status: 500 }
      );
    }

    // O action_link gerado pelo Supabase pode conter uma URL de redirecionamento
    // Vamos garantir que use a URL correta (localhost em dev, produção em prod)
    let actionLink = linkData.properties.action_link;
    
    // Se estiver em localhost, substituir qualquer URL de produção por localhost
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      // Substituir o parâmetro redirect_to no link
      const redirectToEncoded = encodeURIComponent(redirectTo);
      
      // Substituir redirect_to se já existir
      if (actionLink.includes('redirect_to=')) {
        actionLink = actionLink.replace(
          /redirect_to=[^&]*/g,
          `redirect_to=${redirectToEncoded}`
        );
      } else {
        // Adicionar redirect_to se não existir
        const separator = actionLink.includes('?') ? '&' : '?';
        actionLink = `${actionLink}${separator}redirect_to=${redirectToEncoded}`;
      }
      
      // Também substituir URLs de produção no próprio link (caso estejam hardcoded)
      actionLink = actionLink.replace(
        /https?:\/\/gestoria\.airmidiadigital\.com/g,
        'http://localhost:3000'
      );
    }

    // Retornar o link de ação e informações do cliente
    return NextResponse.json(
      { 
        actionLink,
        email: clienteEmail,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Erro ao impersonar cliente:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
