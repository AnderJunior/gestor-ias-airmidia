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
    const { clienteId, email, telefone_ia } = body;

    if (!clienteId) {
      return NextResponse.json(
        { error: 'ID do cliente é obrigatório' },
        { status: 400 }
      );
    }

    const atualizarTelefone = telefone_ia !== undefined && String(telefone_ia).trim() !== '';
    const formatarTelefone = (v: string) => {
      const n = String(v).replace(/\D/g, '');
      return n.startsWith('55') ? n.slice(0, 13) : `55${n.slice(0, 11)}`;
    };

    if (!email && !atualizarTelefone) {
      return NextResponse.json(
        { error: 'Informe e-mail e/ou telefone para atualizar' },
        { status: 400 }
      );
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: 'E-mail inválido' },
          { status: 400 }
        );
      }
    }

    if (atualizarTelefone && formatarTelefone(String(telefone_ia).trim()).length < 12) {
      return NextResponse.json(
        { error: 'Telefone inválido. Use DDD + número.' },
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

    if (email) {
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
    }

    if (email) {
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
      clienteId,
      {
        email: email.trim(),
        email_confirm: true,
      }
    );

      if (updateAuthError) {
        console.error('Erro ao atualizar email no Auth:', updateAuthError);
        return NextResponse.json(
          { error: updateAuthError.message || 'Erro ao atualizar e-mail' },
          { status: 500 }
        );
      }
    }

    if (atualizarTelefone) {
      const tf = formatarTelefone(String(telefone_ia).trim());
      await supabaseAdmin.from('usuarios').update({
        telefone_ia: tf,
        updated_at: new Date().toISOString(),
      }).eq('id', clienteId);

      const { data: inst } = await supabaseAdmin
        .from('whatsapp_instances')
        .select('id')
        .eq('usuario_id', clienteId)
        .maybeSingle();
      if (inst) {
        await supabaseAdmin.from('whatsapp_instances').update({
          telefone: tf,
          updated_at: new Date().toISOString(),
        }).eq('usuario_id', clienteId);
      }
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

