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

export interface EstatisticasAtendimentosMensagens {
  mediaMensagensPorIA: number;
  tempoMedioAtendimentoHumanoMinutos: number;
  tempoMedioAtendimentoIAMinutos: number;
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

    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from('usuarios')
      .select('tipo')
      .eq('id', user.id)
      .single();

    if (usuarioError || !usuario || usuario.tipo !== 'administracao') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem visualizar estas estatísticas.' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const usuarioIdFiltro = url.searchParams.get('usuario_id')?.trim() || null;

    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 365);
    inicio.setHours(0, 0, 0, 0);
    const inicioISO = inicio.toISOString();

    const TAMANHO_PAGINA = 1000;
    const todasMensagens: Array<{ cliente_id: string | null; usuario_id: string | null; remetente: string | null; data_e_hora: string | null; created_at: string }> = [];
    let offset = 0;
    let temMais = true;

    const baseQuery = () => {
      let q = supabaseAdmin
        .from('mensagens')
        .select('cliente_id, usuario_id, remetente, data_e_hora, created_at')
        .gte('created_at', inicioISO);
      if (usuarioIdFiltro) q = q.eq('usuario_id', usuarioIdFiltro);
      return q;
    };

    while (temMais) {
      let res = await baseQuery()
        .order('data_e_hora', { ascending: true })
        .range(offset, offset + TAMANHO_PAGINA - 1);

      if (res.error) {
        res = await baseQuery()
          .order('created_at', { ascending: true })
          .range(offset, offset + TAMANHO_PAGINA - 1);
      }

      if (res.error) {
        console.error('Erro ao buscar mensagens:', res.error);
        return NextResponse.json(
          { mediaMensagensPorIA: 0, tempoMedioAtendimentoHumanoMinutos: 0, tempoMedioAtendimentoIAMinutos: 0 },
          { status: 200 }
        );
      }

      const pagina = (res.data || []) as Array<{ cliente_id: string | null; usuario_id: string | null; remetente: string | null; data_e_hora: string | null; created_at: string }>;
      todasMensagens.push(...pagina);
      temMais = pagina.length === TAMANHO_PAGINA;
      offset += TAMANHO_PAGINA;
    }

    const lista = todasMensagens;
    const rows = lista as Array<{ cliente_id: string | null; usuario_id: string | null; remetente: string | null; data_e_hora: string | null; created_at: string }>;

    function normalizarRemetente(r: string | null): 'cliente' | 'ia' | 'humano' | null {
      const s = (r || '').trim();
      if (!s) return null;
      const lower = s.toLowerCase();
      if (s === 'Cliente' || lower === 'cliente') return 'cliente';
      if (s === 'Ia' || lower === 'ia') return 'ia';
      if (s === 'Humano' || lower === 'humano' || s === 'Usuario' || lower === 'usuario' || lower === 'atendente') return 'humano';
      return null;
    }

    const porConversa = new Map<string, Array<{ tipo: 'cliente' | 'ia' | 'humano'; ts: number }>>();

    for (const row of rows) {
      if (!row.cliente_id || !row.usuario_id) continue;
      const tipo = normalizarRemetente(row.remetente);
      if (!tipo) continue;

      const ts = row.data_e_hora
        ? new Date(row.data_e_hora).getTime()
        : new Date(row.created_at).getTime();

      const key = `${row.cliente_id}:${row.usuario_id}`;
      if (!porConversa.has(key)) porConversa.set(key, []);
      porConversa.get(key)!.push({ tipo, ts });
    }

    let somaMensagensIA = 0;
    let qtdConversasComIA = 0;
    const deltasIA: number[] = [];
    const deltasHumano: number[] = [];

    for (const msgs of porConversa.values()) {
      const ordenadas = [...msgs].sort((a, b) => a.ts - b.ts);

      const mensagensIA = ordenadas.filter((m) => m.tipo === 'ia');
      somaMensagensIA += mensagensIA.length;
      if (mensagensIA.length > 0) qtdConversasComIA++;

      let ultimoClienteTs: number | null = null;
      for (const m of ordenadas) {
        if (m.tipo === 'cliente') {
          ultimoClienteTs = m.ts;
        } else if (m.tipo === 'ia' && ultimoClienteTs != null) {
          const delta = m.ts - ultimoClienteTs;
          if (delta >= 0) deltasIA.push(delta);
          ultimoClienteTs = null;
        } else if (m.tipo === 'humano' && ultimoClienteTs != null) {
          const delta = m.ts - ultimoClienteTs;
          if (delta >= 0) deltasHumano.push(delta);
          ultimoClienteTs = null;
        }
      }
    }

    const mediaIA = qtdConversasComIA > 0 ? somaMensagensIA / qtdConversasComIA : 0;
    const tempoIA = deltasIA.length > 0
      ? deltasIA.reduce((a, b) => a + b, 0) / deltasIA.length / 60000
      : 0;
    const tempoHumano = deltasHumano.length > 0
      ? deltasHumano.reduce((a, b) => a + b, 0) / deltasHumano.length / 60000
      : 0;

    const debug = url.searchParams.get('debug') === '1';
    const remetentesUnicos = [...new Set(rows.map((r) => r.remetente ?? '(null)'))];

    const body: Record<string, unknown> = {
      mediaMensagensPorIA: Math.round(mediaIA * 10) / 10,
      tempoMedioAtendimentoIAMinutos: Math.round(tempoIA * 10) / 10,
      tempoMedioAtendimentoHumanoMinutos: Math.round(tempoHumano * 10) / 10,
    };
    if (debug) {
      body._debug = { remetentesUnicos, qtdDeltasHumano: deltasHumano.length, qtdDeltasIA: deltasIA.length };
    }

    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    console.error('Erro ao buscar estatísticas:', err);
    return NextResponse.json(
      { mediaMensagensPorIA: 0, tempoMedioAtendimentoHumanoMinutos: 0, tempoMedioAtendimentoIAMinutos: 0 },
      { status: 200 }
    );
  }
}
