import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verificarStatusZApi } from '@/lib/api/z-api';

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

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const instanceId = searchParams.get('instanceId');
    const zApiToken = searchParams.get('token');

    let finalInstanceId = instanceId;
    let finalToken = zApiToken;

    if (!finalInstanceId || !finalToken) {
      const { data: instances } = await supabaseAdmin
        .from('whatsapp_instances')
        .select('z_api_instance_id, z_api_token')
        .eq('usuario_id', user.id)
        .not('z_api_instance_id', 'is', null)
        .not('z_api_token', 'is', null)
        .limit(1);

      const instance = instances?.[0];
      if (!instance?.z_api_instance_id || !instance?.z_api_token) {
        return NextResponse.json(
          { error: 'Instância Z-API não configurada. Configure nas configurações ou ao criar o cliente.' },
          { status: 400 }
        );
      }
      finalInstanceId = instance.z_api_instance_id;
      finalToken = instance.z_api_token;
    }

    const result = await verificarStatusZApi(finalInstanceId!, finalToken!);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao verificar status';
    console.error('Erro em /api/whatsapp/status:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
