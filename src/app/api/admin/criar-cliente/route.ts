import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Função para obter cliente Supabase com anon key
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Variáveis de ambiente do Supabase não configuradas');
  }
  
  return createClient(supabaseUrl, supabaseAnonKey);
}

// Função para obter cliente Supabase admin
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Variáveis de ambiente do Supabase não configuradas');
  }
  
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabaseClient = getSupabaseClient();
    const supabaseAdmin = getSupabaseAdmin();
    // Verificar autenticação do usuário
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Extrair token do header
    const token = authHeader.replace('Bearer ', '');
    
    // Verificar token e obter usuário
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verificar se o usuário é administrador
    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from('usuarios')
      .select('tipo')
      .eq('id', user.id)
      .single();

    if (usuarioError || !usuario || usuario.tipo !== 'administracao') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem criar clientes.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { nome, telefone_ia, tipo_marcacao, email, senha } = body;

    // Validações
    if (!nome || !telefone_ia || !tipo_marcacao || !email || !senha) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      );
    }

    // Criar usuário no Supabase Auth
    const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true, // Confirmar email automaticamente
    });

    if (createAuthError) {
      console.error('Erro ao criar usuário no Auth:', createAuthError);
      return NextResponse.json(
        { error: createAuthError.message || 'Erro ao criar usuário' },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Usuário não foi criado' },
        { status: 500 }
      );
    }

    // Criar registro na tabela usuarios
    const { data: usuarioData, error: createUsuarioError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        id: authData.user.id,
        nome,
        telefone_ia,
        tipo_marcacao,
        tipo: 'cliente',
        fase: 'teste',
        ativo: true,
      })
      .select()
      .single();

    if (createUsuarioError) {
      // Se falhar ao criar registro, tentar deletar o usuário criado no Auth
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      console.error('Erro ao criar registro na tabela usuarios:', createUsuarioError);
      return NextResponse.json(
        { error: createUsuarioError.message || 'Erro ao criar registro do usuário' },
        { status: 500 }
      );
    }

    // Criar registro na tabela whatsapp_instances para o novo cliente
    // NOTA: Isso apenas cria o registro na tabela, NÃO cria instância na Evolution API
    try {
      // Gerar nome da instância baseado no nome e telefone
      // Formato: primeiroNome + telefone (tudo minúsculo, apenas números)
      const primeiroNome = nome.trim().split(/\s+/)[0] || 'usuario';
      const telefoneLimpo = telefone_ia.replace(/\D/g, '');
      const instanceName = `${primeiroNome}${telefoneLimpo}`.toLowerCase();

      // Verificar se já existe uma instância com este telefone
      const { data: existingInstance } = await supabaseAdmin
        .from('whatsapp_instances')
        .select('id')
        .eq('telefone', telefone_ia)
        .single();

      if (existingInstance) {
        console.warn(`Já existe uma instância com o telefone ${telefone_ia}`);
        // Não falhar, apenas avisar
      } else {
        // Criar registro na tabela whatsapp_instances
        // NOTA: Isso apenas cria o registro na tabela, NÃO cria instância na Evolution API
        const insertData: any = {
          usuario_id: authData.user.id,
          telefone: telefone_ia,
          instance_name: instanceName,
          evolution_api_instance_id: instanceName,
          status: 'desconectado',
        };

        // Tentar inserir com qr_code como null primeiro (se o campo permitir)
        // Se falhar, tentar com string vazia
        let instanceData;
        let instanceError;

        // Primeira tentativa: com qr_code null
        const { data: data1, error: error1 } = await supabaseAdmin
          .from('whatsapp_instances')
          .insert({
            ...insertData,
            qr_code: null,
          })
          .select()
          .single();

        if (error1 && (error1.message?.includes('null') || error1.message?.includes('NOT NULL'))) {
          // Se falhar por causa de NOT NULL, tentar com string vazia
          const { data: data2, error: error2 } = await supabaseAdmin
            .from('whatsapp_instances')
            .insert({
              ...insertData,
              qr_code: '',
            })
            .select()
            .single();
          
          instanceData = data2;
          instanceError = error2;
        } else {
          instanceData = data1;
          instanceError = error1;
        }

        if (instanceError) {
          console.error('Erro ao criar registro na tabela whatsapp_instances:', instanceError);
          console.error('Detalhes do erro:', JSON.stringify(instanceError, null, 2));
          console.error('Dados tentados:', JSON.stringify(insertData, null, 2));
          // Retornar o erro para que o usuário saiba o que aconteceu
          return NextResponse.json(
            { 
              error: 'Cliente criado, mas houve erro ao criar registro WhatsApp. Erro: ' + instanceError.message,
              usuario: usuarioData,
              details: instanceError
            },
            { status: 201 }
          );
        } else {
          console.log('Registro WhatsApp criado com sucesso na tabela:', instanceData);
        }
      }
    } catch (instanceError: any) {
      console.error('Erro ao criar registro WhatsApp:', instanceError);
      console.error('Stack trace:', instanceError.stack);
      // Retornar aviso mas não falhar completamente
      return NextResponse.json(
        { 
          error: 'Cliente criado, mas houve erro ao criar registro WhatsApp. Erro: ' + (instanceError.message || 'Erro desconhecido'),
          usuario: usuarioData
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      { 
        success: true, 
        usuario: usuarioData,
        message: 'Cliente criado com sucesso'
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Erro ao criar cliente:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

