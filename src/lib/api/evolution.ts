/**
 * Funções auxiliares para integração com Evolution API
 * Estas funções podem ser usadas para sincronizar dados da Evolution API
 */

import { updateWhatsAppInstanceStatus, sincronizarStatusInstancia, getWhatsAppInstanceByInstanceName } from './whatsapp';

// Configuração da Evolution API
const EVOLUTION_API_URL = (process.env.NEXT_PUBLIC_EVOLUTION_API_URL || 'https://apievo.airmidiadigital.com').replace(/\/$/, '');
const EVOLUTION_API_KEY = process.env.NEXT_PUBLIC_EVOLUTION_API_KEY || '52dc2fc8037182f46b1d9bbf89a5fe57';

/**
 * Interface para resposta de status da instância
 */
export interface EvolutionInstanceStatus {
  instance: {
    instanceName: string;
    status: 'open' | 'close' | 'connecting';
    qrcode?: {
      code?: string;
      base64?: string;
    };
    pairingCode?: string;
  };
}

/**
 * Interface para informações de conexão
 */
export interface EvolutionConnectionInfo {
  qrcode?: {
    code?: string;
    base64?: string;
  };
  pairingCode?: string;
  pairingCodeExpiration?: number;
}

/**
 * Processa uma mensagem recebida da Evolution API webhook
 * Identifica automaticamente o usuário pelo telefone conectado
 */
export async function processEvolutionWebhookMessage(data: {
  key: {
    remoteJid: string; // Telefone do remetente (ex: 5511999999999@s.whatsapp.net)
    fromMe: boolean; // Se a mensagem foi enviada pelo próprio número
  };
  message: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
  };
  messageTimestamp: number;
  instanceName: string; // Nome da instância na Evolution API
}) {
  try {
    // Extrair telefone do remetente (remover @s.whatsapp.net)
    const telefoneRemetente = data.key.remoteJid.split('@')[0];
    
    // Identificar telefone do usuário pela instância
    // Você precisará buscar o telefone_usuario pela instanceName
    // Por enquanto, vamos assumir que você tem uma forma de mapear instanceName -> telefone
    
    // Extrair conteúdo da mensagem
    const conteudo = data.message.conversation || data.message.extendedTextMessage?.text || '';
    
    if (!conteudo) {
      console.warn('Mensagem sem conteúdo:', data);
      return;
    }

    // Aqui você precisaria buscar o telefone_usuario baseado na instanceName
    // Por exemplo, buscar na tabela whatsapp_instances pelo evolution_api_instance_id ou instance_name
    // Por enquanto, vamos deixar isso como uma função auxiliar que você pode completar
    
    console.log('Processando mensagem da Evolution API:', {
      telefoneRemetente,
      instanceName: data.instanceName,
      conteudo,
    });

    // Exemplo de como processar (você precisará adaptar):
    // const telefoneUsuario = await getTelefoneByInstanceName(data.instanceName);
    // await createMensagemFromEvolutionAPI(
    //   telefoneRemetente,
    //   telefoneUsuario,
    //   conteudo,
    //   data.messageTimestamp.toString()
    // );
  } catch (error) {
    console.error('Error processing Evolution webhook:', error);
    throw error;
  }
}

/**
 * Atualiza status da conexão quando recebe eventos da Evolution API
 * Sincroniza com o Supabase
 */
export async function processEvolutionConnectionStatus(
  instanceName: string,
  status: 'conectado' | 'desconectado' | 'conectando' | 'erro',
  qrCode?: string,
  telefone?: string
) {
  try {
    let telefoneParaSincronizar = telefone;
    
    // Se não forneceu telefone, tentar buscar no Supabase
    if (!telefoneParaSincronizar) {
      const instance = await getWhatsAppInstanceByInstanceName(instanceName);
      telefoneParaSincronizar = instance?.telefone;
    }
    
    // Se ainda não tem telefone, tentar extrair do instanceName
    // Formato: primeiroNome + telefone (tudo minúsculo)
    if (!telefoneParaSincronizar) {
      // Tentar extrair números do final do instanceName
      const match = instanceName.match(/(\d+)$/);
      if (match) {
        telefoneParaSincronizar = match[1];
      }
    }
    
    if (!telefoneParaSincronizar) {
      console.warn('Não foi possível determinar o telefone para sincronizar:', instanceName);
      return;
    }
    
    console.log('Sincronizando status da conexão no Supabase:', {
      instanceName,
      telefone: telefoneParaSincronizar,
      status,
      hasQrCode: !!qrCode,
    });

    // Sincronizar com Supabase (sem usuarioId - será buscado de forma otimizada)
    await sincronizarStatusInstancia(
      instanceName,
      telefoneParaSincronizar,
      status,
      undefined, // usuarioId será buscado de forma otimizada
      qrCode
    );
  } catch (error) {
    console.error('Error processing Evolution connection status:', error);
    throw error;
  }
}

/**
 * Verifica o status de conexão de uma instância na Evolution API
 */
export async function verificarStatusConexao(instanceName: string): Promise<{
  conectado: boolean;
  status: 'open' | 'close' | 'connecting';
}> {
  try {
    const response = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Se não conseguir buscar, assumir que não está conectado
      return { conectado: false, status: 'close' };
    }

    const data = await response.json();
    
    // A resposta pode ser um array ou um objeto com array
    const instances = Array.isArray(data) ? data : (data.instances || []);
    
    // Buscar a instância específica
    const instance = instances.find((inst: any) => {
      const name = inst.instance?.instanceName || inst.instanceName || inst.name;
      return name === instanceName;
    });
    
    if (!instance) {
      return { conectado: false, status: 'close' };
    }

    const status = instance.instance?.status || instance.status || 'close';
    const isOpen = status === 'open' || status === 'OPEN' || status === 'connected';
    
    return {
      conectado: isOpen,
      status: isOpen ? 'open' : (status === 'connecting' || status === 'CONNECTING' ? 'connecting' : 'close'),
    };
  } catch (error) {
    console.error('Erro ao verificar status de conexão:', error);
    // Em caso de erro, assumir desconectado
    return { conectado: false, status: 'close' };
  }
}

/**
 * Cria uma instância na Evolution API se ela não existir
 * Retorna as informações de conexão (QR code) se a instância foi criada
 */
export async function criarInstanciaSeNaoExistir(instanceName: string): Promise<EvolutionConnectionInfo | null> {
  try {
    // Primeiro, verificar se a instância já existe
    const response = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      // A resposta pode ser um array ou um objeto com array
      const instances = Array.isArray(data) ? data : (data.instances || []);
      
      const existingInstance = instances.find((inst: any) => {
        const name = inst.instance?.instanceName || inst.instanceName || inst.name;
        return name === instanceName;
      });
      
      if (existingInstance) {
        // Instância já existe, retornar null para indicar que não foi criada agora
        return null;
      }
    }

    // Criar a instância - a Evolution API retorna o QR code na resposta
    const createResponse = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
      method: 'POST',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instanceName: instanceName,
        token: instanceName, // Token pode ser o mesmo que o instanceName
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }),
    });

    if (createResponse.ok) {
      const createData = await createResponse.json();
      // A criação pode retornar o QR code diretamente
      if (createData.qrcode || createData.qr || createData.pairingCode) {
        return {
          qrcode: createData.qrcode || createData.qr,
          pairingCode: createData.pairingCode || createData.paircode,
          pairingCodeExpiration: createData.pairingCodeExpiration || createData.paircodeExpiration,
        };
      }
      // Aguardar um pouco para a instância ser criada
      await new Promise(resolve => setTimeout(resolve, 1000));
      return null;
    } else if (createResponse.status === 409) {
      // Instância já existe
      return null;
    } else {
      const errorData = await createResponse.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.error || `Erro ao criar instância: ${createResponse.statusText}`;
      console.warn('Aviso ao criar instância:', errorMessage);
      return null;
    }
  } catch (error) {
    console.error('Erro ao criar instância:', error);
    return null;
  }
}

/**
 * Verifica se uma instância existe na Evolution API
 */
async function verificarSeInstanciaExiste(instanceName: string): Promise<boolean> {
  try {
    console.log(`Verificando se instância ${instanceName} existe...`);
    const response = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const instances = Array.isArray(data) ? data : (data.instances || []);
      
      console.log(`Total de instâncias encontradas: ${instances.length}`);
      
      const existe = instances.some((inst: any) => {
        const name = inst.instance?.instanceName || inst.instanceName || inst.name;
        const match = name === instanceName;
        if (match) {
          console.log(`Instância encontrada: ${name}`);
        }
        return match;
      });
      
      console.log(`Instância ${instanceName} existe: ${existe}`);
      return existe;
    } else {
      console.warn(`Erro ao buscar instâncias: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error('Erro ao verificar se instância existe:', error);
    return false;
  }
}

/**
 * Verifica o estado de conexão de uma instância usando connectionState
 */
export async function verificarConnectionState(instanceName: string): Promise<'open' | 'close' | 'connecting' | null> {
  try {
    const response = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const state = data.instance?.state || data.state;
      console.log(`Estado de conexão da instância ${instanceName}: ${state}`);
      return state || null;
    }
    return null;
  } catch (error) {
    console.error('Erro ao verificar connection state:', error);
    return null;
  }
}

/**
 * Verifica se uma instância existe usando connectionState (mais eficiente que fetchInstances)
 */
export async function verificarSeInstanciaExistePorConnectionState(instanceName: string): Promise<boolean> {
  try {
    const state = await verificarConnectionState(instanceName);
    // Se retornou um estado (mesmo que null em alguns casos), a instância existe
    // Se der erro 404, a instância não existe
    return state !== null;
  } catch (error: any) {
    // Se for 404, a instância não existe
    if (error?.status === 404 || error?.message?.includes('404')) {
      return false;
    }
    // Outros erros, assumir que não existe
    return false;
  }
}

/**
 * Faz logout de uma instância
 */
async function fazerLogoutInstancia(instanceName: string): Promise<boolean> {
  try {
    console.log(`Fazendo logout da instância ${instanceName}...`);
    const response = await fetch(`${EVOLUTION_API_URL}/instance/logout/${instanceName}`, {
      method: 'DELETE',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      console.log(`Logout realizado com sucesso para ${instanceName}`);
      // Aguardar um pouco após o logout
      await new Promise(resolve => setTimeout(resolve, 1000));
      return true;
    }
    return false;
  } catch (error) {
    console.error('Erro ao fazer logout da instância:', error);
    return false;
  }
}

/**
 * Reseta uma instância existente e retorna o QR code e código de pareamento
 */
async function resetarInstancia(instanceName: string): Promise<EvolutionConnectionInfo> {
  try {
    // Verificar o estado de conexão primeiro
    const connectionState = await verificarConnectionState(instanceName);
    
    let fezLogout = false;
    
    // Se estiver "connecting", fazer logout primeiro
    if (connectionState === 'connecting') {
      console.log('Instância está em estado "connecting", fazendo logout primeiro...');
      fezLogout = await fazerLogoutInstancia(instanceName);
    }
    
    // Se estiver "open", não precisa resetar
    if (connectionState === 'open') {
      throw new Error('Instância já está conectada (estado: open). Não é necessário resetar.');
    }
    
    // Se fez logout, não precisa fazer restart - buscar diretamente via endpoint de conexão
    if (fezLogout) {
      console.log('Logout realizado, buscando informações de conexão diretamente...');
      // Aguardar um pouco após o logout para a instância processar
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Buscar as informações via endpoint de conexão
      const connectResponse = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
        method: 'GET',
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (connectResponse.ok) {
        const data = await connectResponse.json();
        console.log('Resposta do endpoint connect após logout:', data);
        
        // Processar QR code
        let qrcodeData = null;
        let pairingCode = null;
        
        if (data.qrcode) {
          if (typeof data.qrcode === 'object') {
            if (data.qrcode.base64) {
              qrcodeData = { base64: limparBase64(data.qrcode.base64) };
            }
            // Buscar pairingCode dentro do objeto qrcode
            if (data.qrcode.pairingCode) {
              pairingCode = data.qrcode.pairingCode;
            }
          } else if (typeof data.qrcode === 'string') {
            qrcodeData = { base64: limparBase64(data.qrcode) };
          }
        } else if (data.qr) {
          if (typeof data.qr === 'object' && data.qr.base64) {
            qrcodeData = { base64: limparBase64(data.qr.base64) };
          } else if (typeof data.qr === 'string') {
            qrcodeData = { base64: limparBase64(data.qr) };
          }
        } else if (data.base64) {
          qrcodeData = { base64: limparBase64(data.base64) };
        }
        
        // Buscar pairingCode também no nível raiz (fallback)
        if (!pairingCode) {
          pairingCode = data.pairingCode || data.paircode || data.pairing_code;
        }
        
        // Se pairingCode for null ou não encontrado, tentar buscar nas instâncias existentes
        if (!pairingCode || pairingCode === null) {
          console.log('PairingCode não encontrado na resposta, buscando nas instâncias existentes...');
          try {
            const instancesResponse = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
              method: 'GET',
              headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json',
              },
            });

            if (instancesResponse.ok) {
              const instancesData = await instancesResponse.json();
              const instances = Array.isArray(instancesData) ? instancesData : (instancesData.instances || []);
              const instance = instances.find((inst: any) => {
                const name = inst.instance?.instanceName || inst.instanceName || inst.name;
                return name === instanceName;
              });

              if (instance) {
                const instanceData = instance.instance || instance;
                // Buscar pairingCode na instância
                if (instanceData.qrcode && typeof instanceData.qrcode === 'object' && instanceData.qrcode.pairingCode) {
                  pairingCode = instanceData.qrcode.pairingCode;
                } else {
                  pairingCode = instanceData.pairingCode || instanceData.paircode || instanceData.pairing_code;
                }
              }
            }
          } catch (err) {
            console.warn('Erro ao buscar pairingCode nas instâncias:', err);
          }
        }
        
        // Retornar mesmo se pairingCode for null - o QR code ainda funciona
        if (qrcodeData) {
          return {
            qrcode: qrcodeData,
            pairingCode: pairingCode || undefined,
            pairingCodeExpiration: data.pairingCodeExpiration || data.paircodeExpiration || data.pairing_code_expiration,
          };
        }
      }
    }
    
    // Se estiver "close" e não fez logout, fazer restart
    if (connectionState === 'close') {
      console.log(`Reiniciando instância ${instanceName}...`);
      const response = await fetch(`${EVOLUTION_API_URL}/instance/restart/${instanceName}`, {
        method: 'PUT',
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Aguardar um pouco para a instância processar o restart
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Buscar as informações atualizadas via endpoint de conexão
        const connectResponse = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
          method: 'GET',
          headers: {
            'apikey': EVOLUTION_API_KEY,
            'Content-Type': 'application/json',
          },
        });

        if (connectResponse.ok) {
          const data = await connectResponse.json();
          
          // Processar QR code
          let qrcodeData = null;
          let pairingCode = null;
          
          if (data.qrcode) {
            if (typeof data.qrcode === 'object') {
              if (data.qrcode.base64) {
                qrcodeData = { base64: limparBase64(data.qrcode.base64) };
              }
              // Buscar pairingCode dentro do objeto qrcode
              if (data.qrcode.pairingCode) {
                pairingCode = data.qrcode.pairingCode;
              }
            } else if (typeof data.qrcode === 'string') {
              qrcodeData = { base64: limparBase64(data.qrcode) };
            }
          } else if (data.qr) {
            if (typeof data.qr === 'object' && data.qr.base64) {
              qrcodeData = { base64: limparBase64(data.qr.base64) };
            } else if (typeof data.qr === 'string') {
              qrcodeData = { base64: limparBase64(data.qr) };
            }
          } else if (data.base64) {
            qrcodeData = { base64: limparBase64(data.base64) };
          }
          
          // Buscar pairingCode também no nível raiz (fallback)
          if (!pairingCode) {
            pairingCode = data.pairingCode || data.paircode || data.pairing_code;
          }
          
          return {
            qrcode: qrcodeData || undefined,
            pairingCode: pairingCode,
            pairingCodeExpiration: data.pairingCodeExpiration || data.paircodeExpiration || data.pairing_code_expiration,
          };
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erro ao reiniciar instância: ${response.statusText}`);
      }
    }

    throw new Error('Não foi possível resetar a instância. Estado desconhecido ou erro na requisição.');
  } catch (error: any) {
    console.error('Erro ao resetar instância:', error);
    throw error;
  }
}

/**
 * Limpa o base64 removendo prefixos duplicados
 */
function limparBase64(base64: string): string {
  if (!base64) return base64;
  
  // Remove o prefixo data:image/png;base64, se existir
  return base64.replace(/^data:image\/[^;]+;base64,/, '');
}

/**
 * Formata o número de telefone adicionando o prefixo 55 se necessário
 */
function formatarNumeroComPrefixo(telefone: string): string {
  // Remove todos os caracteres não numéricos
  const numeroLimpo = telefone.replace(/\D/g, '');
  
  // Se já começa com 55, retorna como está
  if (numeroLimpo.startsWith('55')) {
    return numeroLimpo;
  }
  
  // Adiciona o prefixo 55
  return `55${numeroLimpo}`;
}

/**
 * Obtém informações de conexão (QR Code e código de pareamento) de uma instância
 * Fluxo: Se a instância existe, faz logout e conecta. Se não existe, cria e traz os dados.
 */
export async function obterInformacoesConexao(instanceName: string, telefone?: string): Promise<EvolutionConnectionInfo> {
  try {
    // Verificar se a instância já existe usando connectionState (mais eficiente)
    const instanciaExiste = await verificarSeInstanciaExistePorConnectionState(instanceName);

    if (instanciaExiste) {
      // Se existe, fazer logout e conectar diretamente
      console.log(`Instância ${instanceName} já existe. Fazendo logout e conectando...`);
      
      // Fazer logout primeiro
      const logoutSuccess = await fazerLogoutInstancia(instanceName);
      if (!logoutSuccess) {
        console.warn('Não foi possível fazer logout, tentando conectar mesmo assim...');
      }
      
      // Aguardar um pouco após o logout
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Conectar diretamente usando endpoint de conexão
      const connectEndpoints = [
        `${EVOLUTION_API_URL}/instance/connect/${instanceName}`,
        `${EVOLUTION_API_URL}/${instanceName}/instance/connect`,
      ];

        for (const endpoint of connectEndpoints) {
          try {
            const response = await fetch(endpoint, {
              method: 'GET',
              headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json',
              },
            });

            if (response.ok) {
              const data = await response.json();
              
              // Processar QR code
              let qrcodeData = null;
              let pairingCode = null;
              
              if (data.qrcode) {
                if (typeof data.qrcode === 'object') {
                  if (data.qrcode.base64) {
                    qrcodeData = { base64: limparBase64(data.qrcode.base64) };
                  }
                  // Buscar pairingCode dentro do objeto qrcode
                  if (data.qrcode.pairingCode) {
                    pairingCode = data.qrcode.pairingCode;
                  }
                } else if (typeof data.qrcode === 'string') {
                  qrcodeData = { base64: limparBase64(data.qrcode) };
                }
              } else if (data.qr) {
                if (typeof data.qr === 'object' && data.qr.base64) {
                  qrcodeData = { base64: limparBase64(data.qr.base64) };
                } else if (typeof data.qr === 'string') {
                  qrcodeData = { base64: limparBase64(data.qr) };
                }
              } else if (data.base64) {
                qrcodeData = { base64: limparBase64(data.base64) };
              }
              
              // Buscar pairingCode também no nível raiz (fallback)
              if (!pairingCode) {
                pairingCode = data.pairingCode || data.paircode || data.pairing_code;
              }
              
              if (qrcodeData || pairingCode) {
                const result = {
                  qrcode: qrcodeData || undefined,
                  pairingCode: pairingCode,
                  pairingCodeExpiration: data.pairingCodeExpiration || data.paircodeExpiration || data.pairing_code_expiration,
                };
                
                // Sincronizar com Supabase
                if (telefone) {
                  try {
                    const qrCodeString = qrcodeData?.base64 ? `data:image/png;base64,${qrcodeData.base64}` : undefined;
                    await sincronizarStatusInstancia(instanceName, telefone, 'conectando', undefined, qrCodeString);
                  } catch (syncError) {
                    console.error('Erro ao sincronizar com Supabase:', syncError);
                  }
                }
                
                return result;
              }
            }
          } catch (err) {
            continue;
          }
        }
        
        // Se chegou aqui, não conseguiu obter QR code
        throw new Error('Instância existe mas não foi possível obter o QR code. A instância pode já estar conectada ou precisa ser resetada manualmente.');
    } else {
      // Se não existe, criar a instância
      console.log(`Instância ${instanceName} não existe. Criando...`);
      
      // Preparar o body da criação
      const createBody: any = {
        instanceName: instanceName,
        token: instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      };
      
      // Se o telefone foi fornecido, adicionar o campo number com prefixo 55
      if (telefone) {
        const numeroFormatado = formatarNumeroComPrefixo(telefone);
        createBody.number = numeroFormatado;
        console.log(`Adicionando número ${numeroFormatado} à instância`);
      }
      
      const createResponse = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
        method: 'POST',
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createBody),
      });

      // Verificar se a criação foi bem-sucedida (200, 201 ou mesmo 409 se já existir)
      const createStatus = createResponse.status;
      const isSuccess = createStatus === 200 || createStatus === 201 || createStatus === 409;

      if (isSuccess) {
        // A resposta da criação pode já conter o QR code
        try {
          const createData = await createResponse.json();
          console.log('Resposta de criação:', createData);
          
          // Processar QR code - pode vir em diferentes formatos
          let qrcodeData = null;
          let pairingCode = null;
          
          if (createData.qrcode) {
            // Se qrcode é um objeto
            if (typeof createData.qrcode === 'object') {
              // Buscar base64 dentro do objeto qrcode
              if (createData.qrcode.base64) {
                qrcodeData = { base64: limparBase64(createData.qrcode.base64) };
              }
              // Buscar pairingCode dentro do objeto qrcode
              if (createData.qrcode.pairingCode) {
                pairingCode = createData.qrcode.pairingCode;
              }
            } else if (typeof createData.qrcode === 'string') {
              // Se qrcode é uma string base64 direta
              qrcodeData = { base64: limparBase64(createData.qrcode) };
            }
          } else if (createData.qr) {
            // Se qr é um objeto com base64
            if (typeof createData.qr === 'object' && createData.qr.base64) {
              qrcodeData = { base64: limparBase64(createData.qr.base64) };
            } else if (typeof createData.qr === 'string') {
              // Se qr é uma string base64 direta
              qrcodeData = { base64: limparBase64(createData.qr) };
            }
          } else if (createData.base64) {
            // Se base64 vem direto
            qrcodeData = { base64: limparBase64(createData.base64) };
          }
          
          // Buscar pairingCode também no nível raiz (fallback)
          if (!pairingCode) {
            pairingCode = createData.pairingCode || createData.paircode || createData.pairing_code;
          }
          
          if (qrcodeData || pairingCode) {
            console.log('QR code encontrado na resposta de criação', {
              hasQrcode: !!qrcodeData,
              hasPairingCode: !!pairingCode,
              pairingCode: pairingCode,
            });
            const result = {
              qrcode: qrcodeData || undefined,
              pairingCode: pairingCode,
              pairingCodeExpiration: createData.pairingCodeExpiration || createData.paircodeExpiration || createData.pairing_code_expiration,
            };
            
            // Sincronizar com Supabase
            if (telefone) {
              try {
                const qrCodeString = qrcodeData?.base64 ? `data:image/png;base64,${qrcodeData.base64}` : undefined;
                await sincronizarStatusInstancia(instanceName, telefone, 'conectando', undefined, qrCodeString);
              } catch (syncError) {
                console.error('Erro ao sincronizar com Supabase:', syncError);
              }
            }
            
            return result;
          }
        } catch (e) {
          // Se não conseguiu parsear JSON, continuar
          console.log('Resposta de criação não contém JSON válido, buscando QR code...', e);
        }

        // Aguardar um pouco para a instância ser criada e processada
        console.log('Aguardando instância ser criada...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Tentar múltiplas vezes buscar o QR code (pode demorar um pouco)
        for (let tentativa = 0; tentativa < 3; tentativa++) {
          console.log(`Tentativa ${tentativa + 1} de buscar QR code...`);
          
          // Buscar as informações da instância criada
          const instancesResponse = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
            method: 'GET',
            headers: {
              'apikey': EVOLUTION_API_KEY,
              'Content-Type': 'application/json',
            },
          });

          if (instancesResponse.ok) {
            const instancesData = await instancesResponse.json();
            const instances = Array.isArray(instancesData) ? instancesData : (instancesData.instances || []);
            const instance = instances.find((inst: any) => {
              const name = inst.instance?.instanceName || inst.instanceName || inst.name;
              return name === instanceName;
            });

            if (instance) {
              const instanceData = instance.instance || instance;
              
              // Processar QR code
              let qrcodeData = null;
              let pairingCode = null;
              
              if (instanceData.qrcode) {
                if (typeof instanceData.qrcode === 'object') {
                  if (instanceData.qrcode.base64) {
                    qrcodeData = { base64: limparBase64(instanceData.qrcode.base64) };
                  }
                  // Buscar pairingCode dentro do objeto qrcode
                  if (instanceData.qrcode.pairingCode) {
                    pairingCode = instanceData.qrcode.pairingCode;
                  }
                } else if (typeof instanceData.qrcode === 'string') {
                  qrcodeData = { base64: limparBase64(instanceData.qrcode) };
                }
              } else if (instanceData.qr) {
                if (typeof instanceData.qr === 'object' && instanceData.qr.base64) {
                  qrcodeData = { base64: limparBase64(instanceData.qr.base64) };
                } else if (typeof instanceData.qr === 'string') {
                  qrcodeData = { base64: limparBase64(instanceData.qr) };
                }
              } else if (instanceData.base64) {
                qrcodeData = { base64: limparBase64(instanceData.base64) };
              }
              
              // Buscar pairingCode também no nível raiz (fallback)
              if (!pairingCode) {
                pairingCode = instanceData.pairingCode || instanceData.paircode || instanceData.pairing_code;
              }
              
              if (qrcodeData || pairingCode) {
                console.log('QR code encontrado nas instâncias', {
                  hasQrcode: !!qrcodeData,
                  hasPairingCode: !!pairingCode,
                });
                const result = {
                  qrcode: qrcodeData || undefined,
                  pairingCode: pairingCode,
                  pairingCodeExpiration: instanceData.pairingCodeExpiration || instanceData.paircodeExpiration || instanceData.pairing_code_expiration,
                };
                
                // Sincronizar com Supabase
                if (telefone) {
                  try {
                    const qrCodeString = qrcodeData?.base64 ? `data:image/png;base64,${qrcodeData.base64}` : undefined;
                    await sincronizarStatusInstancia(instanceName, telefone, 'conectando', undefined, qrCodeString);
                  } catch (syncError) {
                    console.error('Erro ao sincronizar com Supabase:', syncError);
                  }
                }
                
                return result;
              }
            }
          }

          // Tentar endpoint de conexão
          const connectEndpoints = [
            `${EVOLUTION_API_URL}/instance/connect/${instanceName}`,
            `${EVOLUTION_API_URL}/${instanceName}/instance/connect`,
          ];

          for (const endpoint of connectEndpoints) {
            try {
              const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                  'apikey': EVOLUTION_API_KEY,
                  'Content-Type': 'application/json',
                },
              });

              if (response.ok) {
                const data = await response.json();
                const qrcode = data.qrcode || data.qr || data.base64;
                const pairingCode = data.pairingCode || data.paircode || data.pairing_code;
                
                if (qrcode || pairingCode) {
                  console.log('QR code encontrado no endpoint de conexão');
                  const result = {
                    qrcode: qrcode,
                    pairingCode: pairingCode,
                    pairingCodeExpiration: data.pairingCodeExpiration || data.paircodeExpiration || data.pairing_code_expiration,
                  };
                  
                  // Sincronizar com Supabase
                  if (telefone) {
                    try {
                      const qrCodeString = typeof qrcode === 'string' ? qrcode : (qrcode?.base64 ? `data:image/png;base64,${qrcode.base64}` : undefined);
                      await sincronizarStatusInstancia(instanceName, telefone, 'conectando', undefined, qrCodeString);
                    } catch (syncError) {
                      console.error('Erro ao sincronizar com Supabase:', syncError);
                    }
                  }
                  
                  return result;
                }
              }
            } catch (err) {
              continue;
            }
          }

          // Se não encontrou, aguardar mais um pouco antes da próxima tentativa
          if (tentativa < 2) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
      } else {
        const errorData = await createResponse.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `Erro ao criar instância: ${createResponse.statusText} (Status: ${createStatus})`;
        console.error('Erro ao criar instância:', errorMessage);
        throw new Error(errorMessage);
      }
    }

    // Se chegou aqui, não conseguiu obter o QR code após criar
    throw new Error('Instância criada, mas não foi possível obter o QR code. A instância pode estar sendo processada. Tente novamente em alguns segundos.');
  } catch (error: any) {
    console.error('Erro ao obter informações de conexão:', error);
    // Se o erro já tem uma mensagem clara, usar ela. Caso contrário, criar uma genérica
    if (error.message && !error.message.includes('Erro ao obter informações de conexão')) {
      throw error;
    }
    throw new Error(error.message || 'Erro ao obter informações de conexão. Verifique se a instância existe na Evolution API.');
  }
}

/**
 * Gera um novo QR Code para uma instância
 */
export async function gerarNovoQRCode(instanceName: string, telefone?: string): Promise<EvolutionConnectionInfo> {
  try {
    // Verificar o estado de conexão primeiro
    const connectionState = await verificarConnectionState(instanceName);
    
    let fezLogout = false;
    
    // Se estiver "connecting", fazer logout primeiro
    if (connectionState === 'connecting') {
      console.log('Instância está em estado "connecting", fazendo logout primeiro...');
      fezLogout = await fazerLogoutInstancia(instanceName);
    }
    
    // Se fez logout, não precisa fazer restart - buscar diretamente via endpoint de conexão
    if (fezLogout) {
      console.log('Logout realizado, buscando informações de conexão diretamente...');
      // Aguardar um pouco após o logout para a instância processar
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Buscar as informações via endpoint de conexão
      const connectResponse = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
        method: 'GET',
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (connectResponse.ok) {
        const data = await connectResponse.json();
        console.log('Resposta do endpoint connect após logout (gerarNovoQRCode):', data);
        
        // Processar QR code e pairingCode
        let qrcodeData = null;
        let pairingCode = null;
        
        if (data.qrcode) {
          if (typeof data.qrcode === 'object') {
            if (data.qrcode.base64) {
              qrcodeData = { base64: limparBase64(data.qrcode.base64) };
            }
            // Buscar pairingCode dentro do objeto qrcode
            if (data.qrcode.pairingCode) {
              pairingCode = data.qrcode.pairingCode;
            }
          } else if (typeof data.qrcode === 'string') {
            qrcodeData = { base64: limparBase64(data.qrcode) };
          }
        } else if (data.qr) {
          if (typeof data.qr === 'object' && data.qr.base64) {
            qrcodeData = { base64: limparBase64(data.qr.base64) };
          } else if (typeof data.qr === 'string') {
            qrcodeData = { base64: limparBase64(data.qr) };
          }
        } else if (data.base64) {
          qrcodeData = { base64: limparBase64(data.base64) };
        }
        
        // Buscar pairingCode também no nível raiz (fallback)
        if (!pairingCode) {
          pairingCode = data.pairingCode || data.paircode || data.pairing_code;
        }
        
        // Se pairingCode for null ou não encontrado, tentar buscar nas instâncias existentes
        if (!pairingCode || pairingCode === null) {
          console.log('PairingCode não encontrado na resposta, buscando nas instâncias existentes...');
          try {
            const instancesResponse = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
              method: 'GET',
              headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json',
              },
            });

            if (instancesResponse.ok) {
              const instancesData = await instancesResponse.json();
              const instances = Array.isArray(instancesData) ? instancesData : (instancesData.instances || []);
              const instance = instances.find((inst: any) => {
                const name = inst.instance?.instanceName || inst.instanceName || inst.name;
                return name === instanceName;
              });

              if (instance) {
                const instanceData = instance.instance || instance;
                // Buscar pairingCode na instância
                if (instanceData.qrcode && typeof instanceData.qrcode === 'object' && instanceData.qrcode.pairingCode) {
                  pairingCode = instanceData.qrcode.pairingCode;
                } else {
                  pairingCode = instanceData.pairingCode || instanceData.paircode || instanceData.pairing_code;
                }
              }
            }
          } catch (err) {
            console.warn('Erro ao buscar pairingCode nas instâncias:', err);
          }
        }
        
        // Retornar mesmo se pairingCode for null - o QR code ainda funciona
        if (qrcodeData) {
          console.log('QR code e pairing code obtidos via endpoint de conexão após logout', {
            hasQrcode: !!qrcodeData,
            hasPairingCode: !!pairingCode,
          });
          return {
            qrcode: qrcodeData,
            pairingCode: pairingCode || undefined,
            pairingCodeExpiration: data.pairingCodeExpiration || data.paircodeExpiration || data.pairing_code_expiration,
          };
        }
      }
    }
    
    // Se estiver "close" e não fez logout, tentar fazer restart
    if (connectionState === 'close') {
      console.log(`Tentando reiniciar instância ${instanceName}...`);
      const restartEndpoint = `${EVOLUTION_API_URL}/instance/restart/${instanceName}`;
      
      try {
        const response = await fetch(restartEndpoint, {
          method: 'PUT',
          headers: {
            'apikey': EVOLUTION_API_KEY,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          // Aguardar um pouco para a instância processar o restart
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Buscar as informações via endpoint de conexão
          const connectResponse = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
            method: 'GET',
            headers: {
              'apikey': EVOLUTION_API_KEY,
              'Content-Type': 'application/json',
            },
          });

          if (connectResponse.ok) {
            const data = await connectResponse.json();
            console.log('Resposta do endpoint connect após restart:', data);
            
            // Processar QR code e pairingCode
            let qrcodeData = null;
            let pairingCode = null;
            
            if (data.qrcode) {
              if (typeof data.qrcode === 'object') {
                if (data.qrcode.base64) {
                  qrcodeData = { base64: limparBase64(data.qrcode.base64) };
                }
                if (data.qrcode.pairingCode) {
                  pairingCode = data.qrcode.pairingCode;
                }
              } else if (typeof data.qrcode === 'string') {
                qrcodeData = { base64: limparBase64(data.qrcode) };
              }
            } else if (data.qr) {
              if (typeof data.qr === 'object' && data.qr.base64) {
                qrcodeData = { base64: limparBase64(data.qr.base64) };
              } else if (typeof data.qr === 'string') {
                qrcodeData = { base64: limparBase64(data.qr) };
              }
            } else if (data.base64) {
              qrcodeData = { base64: limparBase64(data.base64) };
            }
            
            if (!pairingCode) {
              pairingCode = data.pairingCode || data.paircode || data.pairing_code;
            }
            
            // Se pairingCode for null ou não encontrado, tentar buscar nas instâncias existentes
            if (!pairingCode || pairingCode === null) {
              console.log('PairingCode não encontrado na resposta após restart, buscando nas instâncias existentes...');
              try {
                const instancesResponse = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
                  method: 'GET',
                  headers: {
                    'apikey': EVOLUTION_API_KEY,
                    'Content-Type': 'application/json',
                  },
                });

                if (instancesResponse.ok) {
                  const instancesData = await instancesResponse.json();
                  const instances = Array.isArray(instancesData) ? instancesData : (instancesData.instances || []);
                  const instance = instances.find((inst: any) => {
                    const name = inst.instance?.instanceName || inst.instanceName || inst.name;
                    return name === instanceName;
                  });

                  if (instance) {
                    const instanceData = instance.instance || instance;
                    // Buscar pairingCode na instância
                    if (instanceData.qrcode && typeof instanceData.qrcode === 'object' && instanceData.qrcode.pairingCode) {
                      pairingCode = instanceData.qrcode.pairingCode;
                    } else {
                      pairingCode = instanceData.pairingCode || instanceData.paircode || instanceData.pairing_code;
                    }
                  }
                }
              } catch (err) {
                console.warn('Erro ao buscar pairingCode nas instâncias:', err);
              }
            }
            
            // Retornar mesmo se pairingCode for null - o QR code ainda funciona
            if (qrcodeData) {
              return {
                qrcode: qrcodeData,
                pairingCode: pairingCode || undefined,
                pairingCodeExpiration: data.pairingCodeExpiration || data.paircodeExpiration || data.pairing_code_expiration,
              };
            }
          }
        } else if (response.status === 404) {
          // Se restart retornar 404, tentar buscar diretamente via endpoint de conexão
          console.log('Restart retornou 404, tentando buscar diretamente via endpoint de conexão...');
        }
      } catch (err) {
        console.log('Erro ao fazer restart, tentando buscar diretamente via endpoint de conexão...', err);
      }
    }
    
    // Se não conseguiu via restart ou logout, tentar buscar diretamente via endpoint de conexão
    console.log('Buscando informações de conexão diretamente...');
    const connectResponse = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (connectResponse.ok) {
      const data = await connectResponse.json();
      console.log('Resposta do endpoint connect (fallback final):', data);
      
      // Processar QR code e pairingCode
      let qrcodeData = null;
      let pairingCode = null;
      
      if (data.qrcode) {
        if (typeof data.qrcode === 'object') {
          if (data.qrcode.base64) {
            qrcodeData = { base64: limparBase64(data.qrcode.base64) };
          }
          if (data.qrcode.pairingCode) {
            pairingCode = data.qrcode.pairingCode;
          }
        } else if (typeof data.qrcode === 'string') {
          qrcodeData = { base64: limparBase64(data.qrcode) };
        }
      } else if (data.qr) {
        if (typeof data.qr === 'object' && data.qr.base64) {
          qrcodeData = { base64: limparBase64(data.qr.base64) };
        } else if (typeof data.qr === 'string') {
          qrcodeData = { base64: limparBase64(data.qr) };
        }
      } else if (data.base64) {
        qrcodeData = { base64: limparBase64(data.base64) };
      }
      
      if (!pairingCode) {
        pairingCode = data.pairingCode || data.paircode || data.pairing_code;
      }
      
      // Se pairingCode for null ou não encontrado, tentar buscar nas instâncias existentes
      if (!pairingCode || pairingCode === null) {
        console.log('PairingCode não encontrado na resposta (fallback final), buscando nas instâncias existentes...');
        try {
          const instancesResponse = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
            method: 'GET',
            headers: {
              'apikey': EVOLUTION_API_KEY,
              'Content-Type': 'application/json',
            },
          });

          if (instancesResponse.ok) {
            const instancesData = await instancesResponse.json();
            const instances = Array.isArray(instancesData) ? instancesData : (instancesData.instances || []);
            const instance = instances.find((inst: any) => {
              const name = inst.instance?.instanceName || inst.instanceName || inst.name;
              return name === instanceName;
            });

            if (instance) {
              const instanceData = instance.instance || instance;
              // Buscar pairingCode na instância
              if (instanceData.qrcode && typeof instanceData.qrcode === 'object' && instanceData.qrcode.pairingCode) {
                pairingCode = instanceData.qrcode.pairingCode;
              } else {
                pairingCode = instanceData.pairingCode || instanceData.paircode || instanceData.pairing_code;
              }
            }
          }
        } catch (err) {
          console.warn('Erro ao buscar pairingCode nas instâncias:', err);
        }
      }
      
      // Retornar mesmo se pairingCode for null - o QR code ainda funciona
      if (qrcodeData) {
        console.log('QR code e pairing code obtidos via endpoint de conexão', {
          hasQrcode: !!qrcodeData,
          hasPairingCode: !!pairingCode,
        });
        return {
          qrcode: qrcodeData,
          pairingCode: pairingCode || undefined,
          pairingCodeExpiration: data.pairingCodeExpiration || data.paircodeExpiration || data.pairing_code_expiration,
        };
      }
    }
    
    // Como último recurso, chamar obterInformacoesConexao
    return await obterInformacoesConexao(instanceName, telefone);
  } catch (error: any) {
    console.error('Erro ao gerar novo QR Code:', error);
    throw new Error(error.message || 'Erro ao gerar novo QR Code. Tente novamente.');
  }
}

/**
 * Gera o nome da instância baseado no nome do usuário e telefone
 * Formato: primeiroNome + telefone (tudo minúsculo)
 */
export function gerarNomeInstancia(nome: string | null, telefone: string): string {
  const primeiroNome = nome ? nome.trim().split(/\s+/)[0] : 'usuario';
  const telefoneLimpo = telefone.replace(/\D/g, '');
  return `${primeiroNome}${telefoneLimpo}`.toLowerCase();
}

/**
 * Verifica se o telefone do usuário está conectado no Supabase
 * Usa o nome do usuário + telefone para gerar o instanceName
 */
export async function verificarConexaoUsuarioSupabase(nome: string | null, telefone: string): Promise<{
  conectado: boolean;
  status: 'conectado' | 'desconectado' | 'conectando' | 'erro';
}> {
  if (!telefone) {
    return { conectado: false, status: 'desconectado' };
  }

  // Gerar nome da instância: primeiro nome + telefone, tudo minúsculo
  const instanceName = gerarNomeInstancia(nome, telefone);
  
  try {
    const { verificarStatusConexaoSupabase } = await import('./whatsapp');
    return await verificarStatusConexaoSupabase(instanceName);
  } catch (error) {
    console.error('Erro ao verificar conexão do usuário no Supabase:', error);
    // Em caso de erro, assumir desconectado
    return { conectado: false, status: 'desconectado' };
  }
}

/**
 * Verifica se o telefone do usuário está conectado
 * Usa o nome do usuário + telefone para gerar o instanceName
 * @deprecated Use verificarConexaoUsuarioSupabase quando o modal não estiver aberto
 */
export async function verificarConexaoUsuario(nome: string | null, telefone: string): Promise<{
  conectado: boolean;
  status: 'open' | 'close' | 'connecting';
}> {
  if (!telefone) {
    return { conectado: false, status: 'close' };
  }

  // Gerar nome da instância: primeiro nome + telefone, tudo minúsculo
  const instanceName = gerarNomeInstancia(nome, telefone);
  
  try {
    return await verificarStatusConexao(instanceName);
  } catch (error) {
    console.error('Erro ao verificar conexão do usuário:', error);
    // Em caso de erro, assumir desconectado
    return { conectado: false, status: 'close' };
  }
}

