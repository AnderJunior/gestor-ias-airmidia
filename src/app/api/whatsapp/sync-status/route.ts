import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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

    const body = await request.json().catch(() => ({}));
    const instanceName = body.instanceName as string | undefined;
    const telefone = body.telefone as string | undefined;
    const status = body.status as 'conectado' | 'desconectado' | 'conectando' | 'erro';

    if (!instanceName || !telefone || !status) {
      return NextResponse.json(
        { error: 'instanceName, telefone e status são obrigatórios' },
        { status: 400 }
      );
    }

    const validStatuses = ['conectado', 'desconectado', 'conectando', 'erro'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
    }

    // Buscar instância existente para preservar usuario_id (evitar "roubo" ao impersonar)
    const { data: byName } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('usuario_id')
      .eq('instance_name', instanceName)
      .maybeSingle();

    const { data: byTel } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('usuario_id')
      .eq('telefone', telefone)
      .maybeSingle();

    // Nunca sobrescrever usuario_id existente (evita admin "roubar" instância ao impersonar)
    const updateData: Record<string, unknown> = {
      instance_name: instanceName,
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'conectado') {
      updateData.qr_code = null;
    }

    // Só incluir usuario_id quando criando nova linha (não existe por telefone)
    if (!byTel && user.id) {
      updateData.usuario_id = user.id;
    }

    const { data, error } = await supabaseAdmin
      .from('whatsapp_instances')
      .upsert(
        {
          telefone,
          ...updateData,
        },
        { onConflict: 'telefone' }
      )
      .select()
      .single();

    if (error) {
      console.error('Erro ao sincronizar status em /api/whatsapp/sync-status:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data?.usuario_id) {
      clearInstancesCache(data.usuario_id);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao sincronizar';
    console.error('Erro em /api/whatsapp/sync-status:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
