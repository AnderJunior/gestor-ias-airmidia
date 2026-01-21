import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Variáveis de ambiente do Supabase não configuradas');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * POST /api/webhooks/disparar
 * Proxy para disparar webhooks externos a partir do servidor, evitando CORS.
 * O frontend chama esta rota em vez de fazer fetch direto para URLs externas (ex: N8N).
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = getSupabaseClient();
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { url, payload } = body;

    if (!url || !payload) {
      return NextResponse.json(
        { error: 'url e payload são obrigatórios' },
        { status: 400 }
      );
    }

    // Validar URL: apenas http(s) para evitar SSRF
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
    });
  } catch (error) {
    console.error('Erro ao disparar webhook:', error);
    return NextResponse.json(
      { error: 'Erro ao disparar webhook' },
      { status: 500 }
    );
  }
}
