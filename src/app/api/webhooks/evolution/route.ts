import { NextRequest, NextResponse } from 'next/server';
import { processEvolutionWebhookMessage, processEvolutionConnectionStatus } from '@/lib/api/evolution';

/**
 * Webhook endpoint para receber eventos da Evolution API
 * POST /api/webhooks/evolution
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = body.event || body.type;

    switch (eventType) {
      case 'messages.upsert':
        // Mensagem recebida ou enviada
        if (body.data) {
          await processEvolutionWebhookMessage(body.data);
        }
        break;

      case 'connection.update':
        // Atualização de status de conexão
        if (body.data) {
          const { state, qr } = body.data;
          const status = mapConnectionStateToStatus(state);
          await processEvolutionConnectionStatus(
            body.instanceName || body.instance,
            status,
            qr
          );
        }
        break;

      case 'qrcode.updated':
        // QR Code atualizado
        if (body.data) {
          await processEvolutionConnectionStatus(
            body.instanceName || body.instance,
            'conectando',
            body.data.qr
          );
        }
        break;

      default:
        console.log('Evento não processado:', eventType);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function mapConnectionStateToStatus(state: string): 'conectado' | 'desconectado' | 'conectando' | 'erro' {
  switch (state) {
    case 'open':
      return 'conectado';
    case 'close':
      return 'desconectado';
    case 'connecting':
      return 'conectando';
    default:
      return 'erro';
  }
}







