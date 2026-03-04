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
    const { instanciaId, clienteId, nomeInstancia, telefone, z_api_instance_id, z_api_token } = body;

    const formatarTelefone = (v: string) => {
      const n = String(v).replace(/\D/g, '');
      return n.startsWith('55') ? n.slice(0, 13) : `55${n.slice(0, 11)}`;
    };

    if (!nomeInstancia) {
      return NextResponse.json(
        { error: 'Nome da instância é obrigatório' },
        { status: 400 }
      );
    }

    let instanciaData;

    // Se tem instanciaId, atualizar instância existente
    if (instanciaId) {
      // Se também tem clienteId, atualizar o usuario_id para corrigir vínculo errado
      const updateData: any = {
        instance_name: nomeInstancia.trim(),
        updated_at: new Date().toISOString(),
      };
      if (z_api_instance_id !== undefined) updateData.z_api_instance_id = z_api_instance_id || null;
      if (z_api_token !== undefined) updateData.z_api_token = z_api_token || null;
      if (telefone && telefone.trim()) {
        updateData.telefone = formatarTelefone(telefone.trim());
      }
      if (clienteId) updateData.usuario_id = clienteId;
      
      const { data, error: updateError } = await supabaseAdmin
        .from('whatsapp_instances')
        .update(updateData)
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

      instanciaData = data;

      if (telefone && telefone.trim() && clienteId) {
        const telefoneFormatado = formatarTelefone(telefone.trim());
        await supabaseAdmin.from('usuarios').update({
          telefone_ia: telefoneFormatado,
          updated_at: new Date().toISOString(),
        }).eq('id', clienteId);
      }
    }
    // Se não tem instanciaId mas tem clienteId e telefone, criar ou atualizar instância
    else if (clienteId && telefone) {
      const telefoneFormatado = formatarTelefone(telefone.trim());
      const { data: existingInstance } = await supabaseAdmin
        .from('whatsapp_instances')
        .select('id')
        .eq('usuario_id', clienteId)
        .maybeSingle();

      if (existingInstance) {
        const updatePayload: any = {
          instance_name: nomeInstancia.trim(),
          telefone: telefoneFormatado,
          updated_at: new Date().toISOString(),
        };
        if (z_api_instance_id !== undefined) updatePayload.z_api_instance_id = z_api_instance_id || null;
        if (z_api_token !== undefined) updatePayload.z_api_token = z_api_token || null;
        const { data, error: updateError } = await supabaseAdmin
          .from('whatsapp_instances')
          .update(updatePayload)
          .eq('id', existingInstance.id)
          .select()
          .single();

        if (updateError) {
          console.error('Erro ao atualizar nome da instância:', updateError);
          return NextResponse.json(
            { error: updateError.message || 'Erro ao atualizar nome da instância' },
            { status: 500 }
          );
        }

        instanciaData = data;
        const tf = formatarTelefone(telefone.trim());
        await supabaseAdmin.from('usuarios').update({
          telefone_ia: tf,
          updated_at: new Date().toISOString(),
        }).eq('id', clienteId);
      } else {
        // Criar nova instância
        const insertPayload: any = {
          usuario_id: clienteId,
          telefone: telefoneFormatado,
          instance_name: nomeInstancia.trim(),
          status: 'desconectado',
          updated_at: new Date().toISOString(),
        };
        if (z_api_instance_id) insertPayload.z_api_instance_id = z_api_instance_id;
        if (z_api_token) insertPayload.z_api_token = z_api_token;
        const { data, error: createError } = await supabaseAdmin
          .from('whatsapp_instances')
          .insert(insertPayload)
          .select()
          .single();

        if (createError) {
          console.error('Erro ao criar instância:', createError);
          return NextResponse.json(
            { error: createError.message || 'Erro ao criar instância' },
            { status: 500 }
          );
        }

        instanciaData = data;
        const tf = formatarTelefone(telefone.trim());
        await supabaseAdmin.from('usuarios').update({
          telefone_ia: tf,
          updated_at: new Date().toISOString(),
        }).eq('id', clienteId);
      }
    } else {
      return NextResponse.json(
        { error: 'É necessário fornecer instanciaId ou (clienteId e telefone)' },
        { status: 400 }
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

