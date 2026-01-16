/**
 * Verifica se uma URL é do WhatsApp e deve ser bloqueada
 * URLs do WhatsApp (pps.whatsapp.net) retornam 403 quando carregadas de localhost
 * @param url - URL da imagem
 * @returns true se a URL é do WhatsApp e deve ser bloqueada
 */
export function isWhatsAppUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  // Detectar URLs do WhatsApp
  return url.includes('pps.whatsapp.net') || 
         url.includes('whatsapp.net') ||
         url.includes('fbcdn.net'); // Facebook CDN também usado pelo WhatsApp
}

/**
 * Filtra URLs do WhatsApp, retornando undefined para URLs bloqueadas
 * Isso evita completamente tentar carregar imagens do WhatsApp que retornariam 403
 * @param url - URL da imagem
 * @returns URL válida ou undefined se for URL do WhatsApp
 */
export function filterWhatsAppUrl(url: string | null | undefined): string | undefined {
  if (!url || typeof url !== 'string') {
    return undefined;
  }
  
  // Bloquear URLs do WhatsApp
  if (isWhatsAppUrl(url)) {
    return undefined;
  }
  
  return url;
}




