import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { clearInstancesCache } from '@/lib/api/whatsapp';

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
 * Webhook endpoint para receber eventos da Z-API (conexão/desconexão)
 * POST /api/webhooks/z-api
 *
 * Configure no painel Z-API:
 * - Connected: https://seu-dominio.com/api/webhooks/z-api
 * - Disconnected: https://seu-dominio.com/api/webhooks/z-api
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const eventType = body.type as string | undefined;
    const instanceId = (body.instanceId ?? body.instance_id) as string | undefined;
    const phone = body.phone as string | undefined;

    if (!instanceId) {
      console.warn('[Z-API Webhook] Evento sem instanceId:', JSON.stringify({ type: eventType, keys: Object.keys(body) }));
      return NextResponse.json({ success: true });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const normalizarTelefone = (tel: string) => {
      const n = tel.replace(/\D/g, '');
      return n.startsWith('55') ? n : `55${n}`;
    };

    /** Atualiza status e retorna true se encontrou e atualizou. Fallback: z_api_instance_id -> instance_name -> phone */
    const atualizarPorInstanceId = async (status: 'conectado' | 'desconectado', extraFields: Record<string, unknown> = {}) => {
      const updateData = { status, updated_at: new Date().toISOString(), ...extraFields };
      if (status === 'conectado') (updateData as Record<string, unknown>).qr_code = null;

      let { data, error } = await supabaseAdmin
        .from('whatsapp_instances')
        .update(updateData)
        .eq('z_api_instance_id', instanceId)
        .select('id, usuario_id')
        .maybeSingle();

      if (!error && data) {
        return { data, error: null };
      }

      // Fallback: buscar por instance_name (Z-API às vezes usa o nome como instanceId)
      const { data: byName } = await supabaseAdmin
        .from('whatsapp_instances')
        .select('id, usuario_id')
        .eq('instance_name', instanceId)
        .maybeSingle();

      if (byName) {
        const updateWithZApiId = status === 'conectado' || status === 'desconectado'
          ? { ...updateData, z_api_instance_id: instanceId }
          : updateData;
        const res = await supabaseAdmin
          .from('whatsapp_instances')
          .update(updateWithZApiId)
          .eq('id', byName.id)
          .select('id, usuario_id')
          .single();
        return { data: res.data, error: res.error };
      }

      // Fallback: buscar por telefone (apenas ConnectedCallback envia phone)
      if (phone) {
        const telefoneNorm = normalizarTelefone(phone);
        let { data: byPhone } = await supabaseAdmin
          .from('whatsapp_instances')
          .select('id, usuario_id')
          .eq('telefone', telefoneNorm)
          .maybeSingle();

        if (!byPhone) {
          const phoneDigits = phone.replace(/\D/g, '');
          const altFormat = phoneDigits.startsWith('55') ? phoneDigits.slice(2) : `55${phoneDigits}`;
          const { data: byPhoneAlt } = await supabaseAdmin
            .from('whatsapp_instances')
            .select('id, usuario_id')
            .eq('telefone', altFormat)
            .maybeSingle();
          byPhone = byPhoneAlt;
        }

        if (byPhone) {
          const res = await supabaseAdmin
            .from('whatsapp_instances')
            .update({
              ...updateData,
              z_api_instance_id: instanceId,
            } as Record<string, unknown>)
            .eq('id', byPhone.id)
            .select('id, usuario_id')
            .single();
          return { data: res.data, error: res.error };
        }
      }

      console.warn('[Z-API Webhook] Instância não encontrada:', { eventType, instanceId });
      return { data: null, error: new Error('Instância não encontrada') };
    };

    if (eventType === 'ConnectedCallback') {
      const { data, error } = await atualizarPorInstanceId('conectado');
      if (!error && data?.usuario_id) {
        clearInstancesCache(data.usuario_id);
      }
    } else if (eventType === 'DisconnectedCallback') {
      const { data, error } = await atualizarPorInstanceId('desconectado');
      if (!error && data?.usuario_id) {
        clearInstancesCache(data.usuario_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing Z-API webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
