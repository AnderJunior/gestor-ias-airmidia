/**
 * Funções para integração com Z-API
 * Documentação: https://developer.z-api.io/
 */

const Z_API_BASE_URL = (process.env.Z_API_BASE_URL || 'https://api.z-api.io').replace(/\/$/, '');
const Z_API_CLIENT_TOKEN = process.env.Z_API_CLIENT_TOKEN || '';

export interface ZApiStatusResponse {
  connected: boolean;
  smartphoneConnected?: boolean;
  error?: string;
}

export interface ZApiQRCodeResponse {
  base64: string;
}

/**
 * Monta os headers para requisições à Z-API
 */
function getZApiHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (Z_API_CLIENT_TOKEN) {
    (headers as Record<string, string>)['Client-Token'] = Z_API_CLIENT_TOKEN;
  }
  return headers;
}

/**
 * Verifica o status de conexão de uma instância Z-API
 */
export async function verificarStatusZApi(
  instanceId: string,
  token: string
): Promise<ZApiStatusResponse> {
  if (!instanceId || !token) {
    return { connected: false, error: 'Instance ID e token são obrigatórios' };
  }

  try {
    const url = `${Z_API_BASE_URL}/instances/${instanceId}/token/${token}/status`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getZApiHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        connected: false,
        error: errorData.error || `Erro ao verificar status: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      connected: data.connected === true,
      smartphoneConnected: data.smartphoneConnected,
      error: data.error,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao conectar com Z-API';
    console.error('Erro ao verificar status Z-API:', error);
    return { connected: false, error: message };
  }
}

/**
 * Obtém o QR Code em base64 para exibição no modal de conexão
 */
export async function obterQRCodeZApi(
  instanceId: string,
  token: string
): Promise<{ base64: string } | { error: string }> {
  if (!instanceId || !token) {
    return { error: 'Instance ID e token são obrigatórios' };
  }

  try {
    const url = `${Z_API_BASE_URL}/instances/${instanceId}/token/${token}/qr-code/image`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getZApiHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        error: errorData.error || `Erro ao obter QR code: ${response.status}`,
      };
    }

    const contentType = response.headers.get('content-type');
    let base64: string;

    if (contentType?.includes('application/json')) {
      const data = await response.json();
      base64 = data.base64 || data.value || data;
    } else {
      const text = await response.text();
      base64 = text.replace(/^data:image\/[^;]+;base64,/, '');
    }

    if (typeof base64 !== 'string' || !base64) {
      return { error: 'Resposta inválida da Z-API' };
    }

    return { base64 };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao conectar com Z-API';
    console.error('Erro ao obter QR code Z-API:', error);
    return { error: message };
  }
}

/**
 * Envia mensagem de texto via Z-API
 * @param instanceId - ID da instância na Z-API
 * @param token - Token da instância
 * @param phone - Número do destinatário (ex: 5511999999999)
 * @param message - Texto da mensagem
 */
export async function enviarMensagemZApi(
  instanceId: string,
  token: string,
  phone: string,
  message: string
): Promise<{ messageId?: string; zaapId?: string } | { error: string }> {
  if (!instanceId || !token) {
    return { error: 'Instance ID e token são obrigatórios' };
  }
  if (!phone || !message) {
    return { error: 'Telefone e mensagem são obrigatórios' };
  }

  const phoneDigits = phone.replace(/\D/g, '');
  const phoneFormatted = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`;

  try {
    const url = `${Z_API_BASE_URL}/instances/${instanceId}/token/${token}/send-text`;
    const response = await fetch(url, {
      method: 'POST',
      headers: getZApiHeaders(),
      body: JSON.stringify({
        phone: phoneFormatted,
        message,
        delayMessage: 0,
        delayTyping: 0,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        error: errorData.error || errorData.message || `Erro ao enviar mensagem: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      messageId: data.messageId || data.id,
      zaapId: data.zaapId,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro ao conectar com Z-API';
    console.error('Erro ao enviar mensagem Z-API:', error);
    return { error: msg };
  }
}

/**
 * Desconecta uma instância Z-API
 */
export async function desconectarZApi(
  instanceId: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  if (!instanceId || !token) {
    return { success: false, error: 'Instance ID e token são obrigatórios' };
  }

  try {
    const url = `${Z_API_BASE_URL}/instances/${instanceId}/token/${token}/disconnect`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getZApiHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Erro ao desconectar: ${response.status}`,
      };
    }

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao conectar com Z-API';
    console.error('Erro ao desconectar Z-API:', error);
    return { success: false, error: message };
  }
}
