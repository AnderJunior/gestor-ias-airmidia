import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { triggerWebhookExcluirCliente } from '@/lib/api/webhookTrigger';

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
        { error: 'Acesso negado. Apenas administradores podem excluir clientes.' },
        { status: 403 }
      );
    }

    // Obter ID do cliente da query string
    const { searchParams } = new URL(request.url);
    const clienteId = searchParams.get('id');

    if (!clienteId) {
      return NextResponse.json(
        { error: 'ID do cliente é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar TODAS as informações do cliente ANTES de excluir qualquer coisa
    // Isso é necessário para enviar o webhook com as informações corretas
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
        { error: 'Não é possível excluir um administrador' },
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

    // Acionar webhook ANTES de excluir - passar o usuario_id do admin que está excluindo
    // Isso garante que as informações sejam enviadas corretamente antes da exclusão
    try {
      await triggerWebhookExcluirCliente({
        id: cliente.id,
        nome: cliente.nome || '',
        telefone: cliente.telefone_ia || '',
        foto_perfil: undefined,
        usuario_id: clienteId,
        etapa_atual: etapaAtual,
        etapa_atual_id: etapaAtualId,
      }, user.id); // Passar o usuario_id do admin
    } catch (err) {
      console.error('Erro ao acionar webhook excluir_cliente:', err);
      // Continuar com a exclusão mesmo se o webhook falhar
    }

    // Excluir todos os dados relacionados APÓS enviar o webhook
    // Ordem: agendamentos -> atendimentos_solicitado -> clientes -> whatsapp_instances -> usuarios (via Auth)
    
    // 1. Excluir agendamentos do usuário
    const { error: agendamentosError } = await supabaseAdmin
      .from('agendamentos')
      .delete()
      .eq('usuario_id', clienteId);
    
    if (agendamentosError) {
      console.error('Erro ao excluir agendamentos:', agendamentosError);
    }

    // 2. Excluir atendimentos_solicitado do usuário
    const { error: atendimentosError } = await supabaseAdmin
      .from('atendimentos_solicitado')
      .delete()
      .eq('usuario_id', clienteId);
    
    if (atendimentosError) {
      console.error('Erro ao excluir atendimentos:', atendimentosError);
    }

    // 3. Excluir clientes do usuário
    const { error: clientesError } = await supabaseAdmin
      .from('clientes')
      .delete()
      .eq('usuario_id', clienteId);
    
    if (clientesError) {
      console.error('Erro ao excluir clientes:', clientesError);
    }

    // 4. Excluir whatsapp_instances do usuário
    const { error: whatsappError } = await supabaseAdmin
      .from('whatsapp_instances')
      .delete()
      .eq('usuario_id', clienteId);
    
    if (whatsappError) {
      console.error('Erro ao excluir instâncias WhatsApp:', whatsappError);
    }

    // 5. Excluir usuário do Auth (isso também excluirá o registro na tabela usuarios devido ao CASCADE)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(clienteId);

    if (deleteError) {
      console.error('Erro ao excluir usuário:', deleteError);
      
      // Traduzir mensagens de erro comuns do Supabase
      let errorMessage = 'Erro ao excluir cliente';
      const errorMsg = deleteError.message?.toLowerCase() || '';
      
      if (errorMsg.includes('database error') || errorMsg.includes('database_error')) {
        errorMessage = 'Erro no banco de dados ao excluir o usuário. Verifique se não há dados relacionados que precisam ser removidos primeiro.';
      } else if (errorMsg.includes('permission') || errorMsg.includes('forbidden')) {
        errorMessage = 'Sem permissão para excluir este usuário.';
      } else if (errorMsg.includes('not found')) {
        errorMessage = 'Usuário não encontrado.';
      } else if (deleteError.message) {
        errorMessage = deleteError.message;
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        success: true,
        message: 'Cliente excluído com sucesso'
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Erro ao excluir cliente:', error);
    
    // Traduzir mensagens de erro comuns
    let errorMessage = 'Erro interno do servidor';
    const errorMsg = error.message?.toLowerCase() || '';
    
    if (errorMsg.includes('database error') || errorMsg.includes('database_error')) {
      errorMessage = 'Erro no banco de dados ao excluir o usuário. Verifique se não há dados relacionados que precisam ser removidos primeiro.';
    } else if (errorMsg.includes('permission') || errorMsg.includes('forbidden')) {
      errorMessage = 'Sem permissão para excluir este usuário.';
    } else if (errorMsg.includes('not found')) {
      errorMessage = 'Usuário não encontrado.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

