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
        { error: 'Acesso negado. Apenas administradores podem editar instâncias.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { instanciaId, nomeInstancia } = body;

    if (!instanciaId || !nomeInstancia) {
      return NextResponse.json(
        { error: 'ID da instância e nome são obrigatórios' },
        { status: 400 }
      );
    }

    // Atualizar nome da instância
    const { data: instanciaData, error: updateError } = await supabaseAdmin
      .from('whatsapp_instances')
      .update({
        instance_name: nomeInstancia.trim(),
        evolution_api_instance_id: nomeInstancia.trim(), // Atualizar também o ID da Evolution API
        updated_at: new Date().toISOString(),
      })
      .eq('id', instanciaId)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar nome da instância:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Erro ao atualizar nome da instância' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        success: true, 
        instancia: instanciaData,
        message: 'Nome da instância atualizado com sucesso'
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Erro ao editar nome da instância:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

