import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { clearUsuarioCache } from '@/lib/api/usuarios';

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

type ModoAtendimento = 'horario_comercial' | 'fora_horario_comercial';

const DIAS_SEMANA = [
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
  'sabado',
  'domingo',
] as const;

type DiaSemana = (typeof DIAS_SEMANA)[number];

interface HorarioDia {
  inicio: string;
  fim: string;
}

interface IaConfigPayload {
  modo: ModoAtendimento;
  horarios: Partial<Record<DiaSemana, HorarioDia | null>>;
}

function validarHorario(valor: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(valor);
}

function validarPayload(payload: any): payload is IaConfigPayload {
  if (!payload || (payload.modo !== 'horario_comercial' && payload.modo !== 'fora_horario_comercial')) {
    return false;
  }

  if (typeof payload.horarios !== 'object' || payload.horarios === null) {
    return false;
  }

  for (const dia of DIAS_SEMANA) {
    const valor = payload.horarios[dia];
    if (valor == null) continue;
    if (typeof valor !== 'object') return false;
    if (!validarHorario(valor.inicio) || !validarHorario(valor.fim)) {
      return false;
    }
  }

  return true;
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

    if (!validarPayload(body)) {
      return NextResponse.json(
        { error: 'Payload inválido para configuração da IA' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('usuarios')
      .update({
        ia_config: body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      console.error('Erro ao atualizar ia_config:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    clearUsuarioCache(user.id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao atualizar';
    console.error('Erro em /api/usuarios/ia-config:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

