import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { desconectarZApi } from '@/lib/api/z-api';
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
    const instanceId = body.instanceId as string | undefined;
    const zApiToken = body.token as string | undefined;

    let finalInstanceId = instanceId;
    let finalToken = zApiToken;
    let instanceName = body.instanceName as string | undefined;
    let telefone = body.telefone as string | undefined;

    if (!finalInstanceId || !finalToken) {
      const { data: instances } = await supabaseAdmin
        .from('whatsapp_instances')
        .select('z_api_instance_id, z_api_token, instance_name, telefone')
        .eq('usuario_id', user.id)
        .not('z_api_instance_id', 'is', null)
        .not('z_api_token', 'is', null)
        .limit(1);

      const instance = instances?.[0];
      if (!instance?.z_api_instance_id || !instance?.z_api_token) {
        return NextResponse.json(
          { error: 'Instância Z-API não configurada.' },
          { status: 400 }
        );
      }
      finalInstanceId = instance.z_api_instance_id;
      finalToken = instance.z_api_token;
      instanceName = instance.instance_name;
      telefone = instance.telefone;
    }

    const result = await desconectarZApi(finalInstanceId!, finalToken!);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (finalInstanceId) {
      const { data } = await supabaseAdmin
        .from('whatsapp_instances')
        .update({
          status: 'desconectado',
          updated_at: new Date().toISOString(),
        })
        .eq('z_api_instance_id', finalInstanceId)
        .select('usuario_id')
        .maybeSingle();

      if (data?.usuario_id) {
        clearInstancesCache(data.usuario_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao desconectar';
    console.error('Erro em /api/whatsapp/disconnect:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
