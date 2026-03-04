import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_FROM; // ex: whatsapp:+14155238886

/**
 * Normaliza número para formato E.164 com prefixo whatsapp:
 * Remove espaços e caracteres não numéricos; adiciona + se não tiver.
 */
export function formatWhatsAppTo(to: string): string {
  const digits = to.replace(/\D/g, '');
  const withPlus = digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
  return `whatsapp:${withPlus}`;
}

/**
 * Envia uma mensagem de texto WhatsApp via Twilio.
 * @param to - Número do destinatário (pode ser 5511999999999 ou +5511999999999)
 * @param body - Texto da mensagem
 * @returns Sid da mensagem Twilio (ex: SM...)
 */
export async function sendWhatsAppMessage(to: string, body: string): Promise<string> {
  if (!accountSid || !authToken) {
    throw new Error('Twilio não configurado: TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN são obrigatórios.');
  }
  if (!fromNumber) {
    throw new Error('Twilio não configurado: TWILIO_WHATSAPP_FROM é obrigatório (ex: whatsapp:+14155238886).');
  }

  const client = twilio(accountSid, authToken);
  const toFormatted = formatWhatsAppTo(to);

  const message = await client.messages.create({
    body,
    from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
    to: toFormatted,
  });

  return message.sid;
}
