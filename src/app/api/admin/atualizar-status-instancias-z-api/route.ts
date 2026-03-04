import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verificarStatusZApi } from '@/lib/api/z-api';
import { clearInstancesCache } from '@/lib/api/whatsapp';

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
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Varre todas as instâncias com Z-API configurada, verifica status na Z-API
 * e atualiza a tabela whatsapp_instances.
 * Apenas administradores podem chamar.
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseClient = getSupabaseClient();
    const supabaseAdmin = getSupabaseAdmin();

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { data: usuario } = await supabaseAdmin
      .from('usuarios')
      .select('tipo')
      .eq('id', user.id)
      .single();

    if (!usuario || usuario.tipo !== 'administracao') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem executar esta ação.' },
        { status: 403 }
      );
    }

    const { data: instances } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('id, z_api_instance_id, z_api_token, usuario_id')
      .not('z_api_instance_id', 'is', null)
      .not('z_api_token', 'is', null);

    if (!instances?.length) {
      return NextResponse.json({ updated: 0, message: 'Nenhuma instância Z-API configurada' });
    }

    let updated = 0;
    const userIdsToClear = new Set<string>();

    for (const inst of instances) {
      if (!inst.z_api_instance_id || !inst.z_api_token) continue;

      try {
        const result = await verificarStatusZApi(inst.z_api_instance_id, inst.z_api_token);
        const newStatus = result.connected ? 'conectado' : 'desconectado';

        const updateData: Record<string, unknown> = {
          status: newStatus,
          updated_at: new Date().toISOString(),
        };
        if (result.connected) updateData.qr_code = null;

        const { error } = await supabaseAdmin
          .from('whatsapp_instances')
          .update(updateData)
          .eq('id', inst.id);

        if (!error) {
          updated++;
          if (inst.usuario_id) userIdsToClear.add(inst.usuario_id);
        }
      } catch (err) {
        console.error(`Erro ao atualizar instância ${inst.id}:`, err);
      }
    }

    userIdsToClear.forEach((id) => clearInstancesCache(id));

    return NextResponse.json({ updated, total: instances.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao atualizar status';
    console.error('Erro em /api/admin/atualizar-status-instancias-z-api:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
