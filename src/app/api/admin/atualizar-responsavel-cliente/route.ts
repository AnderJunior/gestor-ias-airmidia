import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { triggerWebhookAtribuicaoNovoResponsavelCliente } from '@/lib/api/webhookTrigger';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Variáveis de ambiente do Supabase não configuradas');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Variáveis de ambiente do Supabase não configuradas');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabaseClient = getSupabaseClient();
    const supabaseAdmin = getSupabaseAdmin();

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabaseClient.auth.getUser(token);
    const authUser = authData.user;

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { data: usuarioAuth, error: usuarioAuthError } = await supabaseAdmin
      .from('usuarios')
      .select('tipo')
      .eq('id', authUser.id)
      .single();

    if (usuarioAuthError || !usuarioAuth || usuarioAuth.tipo !== 'administracao') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem atribuir responsáveis.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { clienteId, responsavelId } = body as {
      clienteId?: string;
      responsavelId?: string | null;
    };

    if (!clienteId) {
      return NextResponse.json({ error: 'ID do cliente é obrigatório' }, { status: 400 });
    }

    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from('usuarios')
      .select('id, tipo, nome, telefone_ia, admin_responsavel, updated_at')
      .eq('id', clienteId)
      .single();

    if (clienteError || !cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    if (cliente.tipo === 'administracao') {
      return NextResponse.json(
        { error: 'Não é possível atribuir responsável para um administrador' },
        { status: 403 }
      );
    }

    let responsavelNovoNome: string | null = null;
    if (responsavelId) {
      const { data: responsavel, error: responsavelError } = await supabaseAdmin
        .from('usuarios')
        .select('id, tipo, nome')
        .eq('id', responsavelId)
        .single();

      if (responsavelError || !responsavel) {
        return NextResponse.json({ error: 'Responsável não encontrado' }, { status: 404 });
      }

      if (responsavel.tipo !== 'administracao') {
        return NextResponse.json(
          { error: 'O responsável selecionado deve ser um administrador' },
          { status: 400 }
        );
      }

      responsavelNovoNome = responsavel.nome || null;
    }

    let responsavelAnteriorNome: string | null = null;
    if (cliente.admin_responsavel) {
      const { data: responsavelAnterior } = await supabaseAdmin
        .from('usuarios')
        .select('nome')
        .eq('id', cliente.admin_responsavel)
        .maybeSingle();
      responsavelAnteriorNome = responsavelAnterior?.nome || null;
    }

    const { data: clienteAtualizado, error: updateError } = await supabaseAdmin
      .from('usuarios')
      .update({
        admin_responsavel: responsavelId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clienteId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || 'Erro ao atualizar responsável do cliente' },
        { status: 500 }
      );
    }

    if (cliente.admin_responsavel !== (responsavelId || null) && responsavelId && responsavelNovoNome) {
      try {
        await triggerWebhookAtribuicaoNovoResponsavelCliente(
          {
            id: clienteAtualizado.id,
            nome: clienteAtualizado.nome || '',
            telefone: clienteAtualizado.telefone_ia || '',
            responsavel_anterior_id: cliente.admin_responsavel || null,
            responsavel_anterior_nome: responsavelAnteriorNome,
            responsavel_novo_id: responsavelId,
            responsavel_novo_nome: responsavelNovoNome,
            usuario_id: clienteAtualizado.id,
            updated_at: clienteAtualizado.updated_at,
            usuario: {
              id: authUser.id,
              nome: null,
              telefone_ia: null,
            },
          },
          authUser.id
        );
      } catch (err) {
        console.error('Erro ao acionar webhook atribuicao_novo_responsavel:', err);
      }
    }

    return NextResponse.json(
      {
        success: true,
        cliente: clienteAtualizado,
        message: responsavelId ? 'Responsável atualizado com sucesso' : 'Responsável removido com sucesso',
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Erro ao atualizar responsável do cliente:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
