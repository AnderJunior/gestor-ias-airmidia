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

// Função auxiliar para atualizar foreign keys manualmente
async function atualizarForeignKeysManual(supabaseAdmin: any, administradorId: string) {
  // Lista de tabelas e colunas que referenciam usuarios
  const tabelasParaAtualizar = [
    { tabela: 'tarefas', coluna: 'responsavel_id' }, // Esta já permite NULL
  ];

  // Para cada tabela, tentar atualizar diretamente
  for (const { tabela, coluna } of tabelasParaAtualizar) {
    try {
      const { error: updateError } = await supabaseAdmin
        .from(tabela)
        .update({ [coluna]: null })
        .eq(coluna, administradorId);

      if (updateError) {
        console.warn(`Não foi possível atualizar ${tabela}.${coluna} para NULL:`, updateError);
      }
    } catch (err) {
      console.warn(`Erro ao atualizar ${tabela}.${coluna}:`, err);
    }
  }
}

export async function DELETE(request: NextRequest) {
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
        { error: 'Acesso negado. Apenas administradores podem excluir outros administradores.' },
        { status: 403 }
      );
    }

    // Obter ID do administrador a ser excluído
    const { searchParams } = new URL(request.url);
    const administradorId = searchParams.get('id');

    if (!administradorId) {
      return NextResponse.json(
        { error: 'ID do administrador é obrigatório' },
        { status: 400 }
      );
    }

    // Não permitir que um administrador exclua a si mesmo
    if (administradorId === user.id) {
      return NextResponse.json(
        { error: 'Você não pode excluir a si mesmo' },
        { status: 400 }
      );
    }

    // Verificar se o administrador existe e é realmente um administrador
    const { data: administrador, error: adminError } = await supabaseAdmin
      .from('usuarios')
      .select('id, tipo')
      .eq('id', administradorId)
      .single();

    if (adminError || !administrador) {
      return NextResponse.json(
        { error: 'Administrador não encontrado' },
        { status: 404 }
      );
    }

    if (administrador.tipo !== 'administracao') {
      return NextResponse.json(
        { error: 'Este usuário não é um administrador' },
        { status: 400 }
      );
    }

    // Antes de excluir, atualizar todas as foreign keys relacionadas para NULL
    // Isso mantém os dados mas remove a referência ao administrador
    try {
      // Tentar usar função SQL se existir
      const { error: rpcError } = await supabaseAdmin.rpc('atualizar_foreign_keys_antes_excluir_admin', {
        admin_id: administradorId
      });

      if (rpcError) {
        // Se a função não existir, tentar atualizar manualmente as colunas que permitem NULL
        console.warn('Função SQL não encontrada, tentando atualização manual. Execute o script update-foreign-keys-on-admin-delete.sql no Supabase para melhor suporte.');
        
        // Atualizar tarefas.responsavel_id (já permite NULL)
        await supabaseAdmin
          .from('tarefas')
          .update({ responsavel_id: null })
          .eq('responsavel_id', administradorId);

        // Para as outras tabelas com NOT NULL, precisamos da função SQL
        // Por enquanto, vamos tentar atualizar diretamente e ver se funciona
        // (pode funcionar se as constraints já foram alteradas)
        const tabelasComNotNull = [
          { tabela: 'clientes', coluna: 'usuario_id' },
          { tabela: 'whatsapp_instances', coluna: 'usuario_id' },
          { tabela: 'webhooks_apis', coluna: 'usuario_id' },
          { tabela: 'agendamentos', coluna: 'usuario_id' },
        ];

        for (const { tabela, coluna } of tabelasComNotNull) {
          try {
            const { error: updateError } = await supabaseAdmin
              .from(tabela)
              .update({ [coluna]: null })
              .eq(coluna, administradorId);

            if (updateError) {
              console.warn(`Não foi possível atualizar ${tabela}.${coluna} para NULL. Execute o script update-foreign-keys-on-admin-delete.sql no Supabase.`, updateError);
            }
          } catch (err) {
            console.warn(`Erro ao atualizar ${tabela}.${coluna}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar foreign keys:', err);
      // Continuar com a exclusão mesmo se houver erro ao atualizar foreign keys
    }

    // Excluir registro da tabela usuarios
    const { error: deleteUsuarioError } = await supabaseAdmin
      .from('usuarios')
      .delete()
      .eq('id', administradorId);

    if (deleteUsuarioError) {
      console.error('Erro ao excluir registro na tabela usuarios:', deleteUsuarioError);
      
      // Verificar se o erro é relacionado a foreign key constraint
      if (deleteUsuarioError.message?.includes('foreign key constraint') || 
          deleteUsuarioError.message?.includes('violates foreign key')) {
        return NextResponse.json(
          { 
            error: 'Não é possível excluir este administrador pois existem dados relacionados. Execute o script SQL "update-foreign-keys-on-admin-delete.sql" no Supabase para permitir a exclusão mantendo os dados.',
            details: deleteUsuarioError.message
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: deleteUsuarioError.message || 'Erro ao excluir registro do usuário' },
        { status: 500 }
      );
    }

    // Excluir usuário do Supabase Auth
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(administradorId);

    if (deleteAuthError) {
      console.error('Erro ao excluir usuário do Auth:', deleteAuthError);
      // Não retornar erro aqui, pois o registro já foi excluído da tabela
      // O usuário do Auth pode ser limpo manualmente se necessário
    }

    return NextResponse.json(
      { 
        success: true,
        message: 'Administrador excluído com sucesso'
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Erro ao excluir administrador:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
