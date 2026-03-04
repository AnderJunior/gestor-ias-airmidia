import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppMessage } from '@/lib/twilio';
import { enviarMensagemZApi } from '@/lib/api/z-api';

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

    const body = await request.json();
    const clienteId = body.clienteId as string | undefined;
    const mensagem = typeof body.mensagem === 'string' ? body.mensagem.trim() : '';

    if (!clienteId) {
      return NextResponse.json(
        { error: 'clienteId é obrigatório' },
        { status: 400 }
      );
    }
    if (!mensagem) {
      return NextResponse.json(
        { error: 'mensagem é obrigatória' },
        { status: 400 }
      );
    }

    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from('clientes')
      .select('id, telefone, usuario_id')
      .eq('id', clienteId)
      .single();

    if (clienteError || !cliente) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      );
    }

    if (!cliente.telefone) {
      return NextResponse.json(
        { error: 'Cliente sem número de telefone cadastrado' },
        { status: 400 }
      );
    }

    // Buscar usuario e instance em paralelo para reduzir latency
    const [usuarioRes, instanceRes] = await Promise.all([
      supabaseAdmin.from('usuarios').select('api_envio_mensagens').eq('id', user.id).single(),
      supabaseAdmin.from('whatsapp_instances').select('z_api_instance_id, z_api_token').eq('usuario_id', user.id).not('z_api_instance_id', 'is', null).not('z_api_token', 'is', null).limit(1).maybeSingle(),
    ]);

    const apiEnvio = usuarioRes.data?.api_envio_mensagens || 'twilio';
    const instance = instanceRes.data;

    let messageSid: string | undefined;

    if (apiEnvio === 'z_api') {
      if (!instance?.z_api_instance_id || !instance?.z_api_token) {
        return NextResponse.json(
          { error: 'Instância Z-API não configurada. Configure nas configurações ou use a API Twilio.' },
          { status: 400 }
        );
      }

      const result = await enviarMensagemZApi(
        instance.z_api_instance_id,
        instance.z_api_token,
        cliente.telefone,
        mensagem
      );

      if ('error' in result) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      messageSid = result.messageId || result.zaapId;
    } else {
      messageSid = await sendWhatsAppMessage(cliente.telefone, mensagem);
    }

    const dataEHora = new Date().toISOString();
    const payload = {
      cliente_id: cliente.id,
      usuario_id: user.id,
      mensagem,
      remetente: 'humano',
      data_e_hora: dataEHora,
    };

    const { error: insertError } = await supabaseAdmin
      .from('mensagens')
      .insert(payload);

    if (insertError) {
      console.error('Erro ao salvar mensagem enviada no banco:', insertError);
      return NextResponse.json(
        {
          error: 'Falha ao registrar mensagem no histórico.',
          details: insertError.message,
          code: insertError.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, messageSid });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao enviar mensagem';
    const isTwilio = message.includes('Twilio') || message.includes('63016');
    return NextResponse.json(
      { error: message },
      { status: isTwilio ? 400 : 500 }
    );
  }
}
