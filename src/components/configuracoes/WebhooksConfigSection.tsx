'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { getWebhooks, criarWebhook, atualizarWebhook, excluirWebhook, WebhookApi, WebhookAcoes } from '@/lib/api/webhooks';
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react';

const TIPOS_ENTIDADES = [
  { 
    id: 'tarefas', 
    label: 'Tarefas', 
    acoes: [
      'criar_tarefa',
      'atualizar_status_tarefa',
      'atualizar_nome_tarefa',
      'atualizar_data_vencimento_tarefa',
      'excluir_tarefa',
      'atribuicao_novo_responsavel'
    ] 
  },
  { 
    id: 'clientes', 
    label: 'Clientes', 
    acoes: [
      'criar_cliente',
      'atualizar_status_cliente',
      'excluir_cliente',
      'ativar_desativar_cliente',
      'atribuicao_novo_responsavel'
    ] 
  },
] as const;

type TipoEntidade = typeof TIPOS_ENTIDADES[number]['id'];

interface WebhookFormData {
  nome: string;
  webhook_url: string;
  acoes: WebhookAcoes;
  ativo: boolean;
}

export function WebhooksConfigSection() {
  const [webhooks, setWebhooks] = useState<WebhookApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [webhookEditando, setWebhookEditando] = useState<WebhookApi | null>(null);
  const [formData, setFormData] = useState<WebhookFormData>({
    nome: '',
    webhook_url: '',
    acoes: {},
    ativo: true,
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    carregarWebhooks();
  }, []);

  const carregarWebhooks = async () => {
    try {
      setLoading(true);
      const dados = await getWebhooks();
      setWebhooks(dados);
    } catch (error) {
      console.error('Erro ao carregar webhooks:', error);
      setErro('Erro ao carregar webhooks. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const abrirModalNovo = () => {
    setWebhookEditando(null);
    setFormData({
      nome: '',
      webhook_url: '',
      acoes: {},
      ativo: true,
    });
    setErro(null);
    setMostrarModal(true);
  };

  const abrirModalEditar = (webhook: WebhookApi) => {
    setWebhookEditando(webhook);
    setFormData({
      nome: webhook.nome,
      webhook_url: webhook.webhook_url,
      acoes: webhook.acoes || {},
      ativo: webhook.ativo,
    });
    setErro(null);
    setMostrarModal(true);
  };

  const fecharModal = () => {
    setMostrarModal(false);
    setWebhookEditando(null);
    setFormData({
      nome: '',
      webhook_url: '',
      acoes: {},
      ativo: true,
    });
    setErro(null);
  };

  const toggleAcao = (tipo: TipoEntidade, acao: string) => {
    setFormData((prev) => {
      const novasAcoes = { ...prev.acoes };
      const acoesDoTipo = novasAcoes[tipo] || [];
      
      if (acoesDoTipo.includes(acao)) {
        novasAcoes[tipo] = acoesDoTipo.filter((a) => a !== acao);
      } else {
        novasAcoes[tipo] = [...acoesDoTipo, acao];
      }

      // Remover tipo se não tiver mais ações
      if (novasAcoes[tipo]?.length === 0) {
        delete novasAcoes[tipo];
      }

      return { ...prev, acoes: novasAcoes };
    });
  };

  const handleSalvar = async () => {
    if (!formData.nome.trim()) {
      setErro('O nome é obrigatório');
      return;
    }

    if (!formData.webhook_url.trim()) {
      setErro('A URL do webhook é obrigatória');
      return;
    }

    // Validar URL
    try {
      new URL(formData.webhook_url);
    } catch {
      setErro('URL inválida');
      return;
    }

    // Verificar se pelo menos uma ação foi selecionada
    const temAcoes = Object.values(formData.acoes).some((acoes) => acoes && acoes.length > 0);
    if (!temAcoes) {
      setErro('Selecione pelo menos uma ação');
      return;
    }

    try {
      setSalvando(true);
      setErro(null);

      if (webhookEditando) {
        await atualizarWebhook(webhookEditando.id, formData);
      } else {
        await criarWebhook(formData);
      }

      await carregarWebhooks();
      fecharModal();
    } catch (error: any) {
      console.error('Erro ao salvar webhook:', error);
      setErro(error.message || 'Erro ao salvar webhook. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (webhookId: string) => {
    if (!confirm('Tem certeza que deseja excluir este webhook?')) {
      return;
    }

    try {
      await excluirWebhook(webhookId);
      await carregarWebhooks();
    } catch (error: any) {
      console.error('Erro ao excluir webhook:', error);
      alert(error.message || 'Erro ao excluir webhook. Tente novamente.');
    }
  };

  const toggleAtivo = async (webhook: WebhookApi) => {
    try {
      await atualizarWebhook(webhook.id, { ativo: !webhook.ativo });
      await carregarWebhooks();
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      alert(error.message || 'Erro ao atualizar status. Tente novamente.');
    }
  };

  const acaoEstaSelecionada = (tipo: TipoEntidade, acao: string) => {
    return formData.acoes[tipo]?.includes(acao) || false;
  };

  return (
    <div className="w-full space-y-6">
      <Card title="Configuração de Webhooks" className="w-full">
        <div className="space-y-4 -mt-5">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Configure webhooks para receber notificações quando ações específicas ocorrerem no sistema.
            </p>
            <Button 
              onClick={abrirModalNovo} 
              variant="primary"
              className="flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-5 h-5" />
              Nova API
            </Button>
          </div>

          {loading ? (
            <p className="text-gray-500 text-center py-8">Carregando...</p>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Nenhum webhook configurado ainda.</p>
              <p className="text-sm mt-2">Clique em "Nova API" para criar um.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {webhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-gray-900">{webhook.nome}</h4>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            webhook.ativo
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {webhook.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3 break-all">{webhook.webhook_url}</p>
                      
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(webhook.acoes || {}).map(([tipo, acoes]) => {
                          const tipoLabel = TIPOS_ENTIDADES.find((t) => t.id === tipo)?.label || tipo;
                          return (
                            <div key={tipo} className="flex items-center gap-1">
                              <span className="text-xs font-medium text-gray-700">{tipoLabel}:</span>
                              <span className="text-xs text-gray-600">
                                {Array.isArray(acoes) ? acoes.map(a => 
                                  a === 'ativar_desativar_cliente' 
                                    ? 'ativar/desativar cliente' 
                                    : a.replace(/_/g, ' ')
                                ).join(', ') : ''}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => toggleAtivo(webhook)}
                        className={`p-2 rounded-lg transition-colors ${
                          webhook.ativo
                            ? 'hover:bg-green-50 text-green-600'
                            : 'hover:bg-gray-50 text-gray-600'
                        }`}
                        title={webhook.ativo ? 'Desativar' : 'Ativar'}
                      >
                        {webhook.ativo ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => abrirModalEditar(webhook)}
                        className="p-2 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleExcluir(webhook.id)}
                        className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Modal de Criar/Editar Webhook */}
      <Modal
        isOpen={mostrarModal}
        onClose={fecharModal}
        title={webhookEditando ? 'Editar Webhook' : 'Nova API'}
        closeOnClickOutside={!salvando}
        size="lg"
      >
        <div className="space-y-6">
          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{erro}</p>
            </div>
          )}

          <Input
            label="Nome"
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            placeholder="Ex: Webhook de Produção"
            disabled={salvando}
          />

          <Input
            label="URL do Webhook"
            value={formData.webhook_url}
            onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
            placeholder="https://exemplo.com/webhook"
            type="url"
            disabled={salvando}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Ações por Tipo de Função
            </label>
            <div className="space-y-4">
              {TIPOS_ENTIDADES.map((tipo) => (
                <div key={tipo.id} className="border border-gray-200 rounded-lg p-4">
                  <h5 className="font-medium text-gray-900 mb-3">{tipo.label}</h5>
                  <div className="grid grid-cols-2 gap-2">
                    {tipo.acoes.map((acao) => {
                      const selecionada = acaoEstaSelecionada(tipo.id, acao);
                      return (
                        <label
                          key={acao}
                          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                            selecionada
                              ? 'bg-primary-50 border border-primary-200'
                              : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selecionada}
                            onChange={() => toggleAcao(tipo.id, acao)}
                            disabled={salvando}
                            className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                          />
                          <span className="text-sm text-gray-700">
                            {acao === 'ativar_desativar_cliente' 
                              ? 'ativar/desativar cliente' 
                              : acao.replace(/_/g, ' ')}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ativo"
              checked={formData.ativo}
              onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
              disabled={salvando}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <label htmlFor="ativo" className="text-sm text-gray-700 cursor-pointer">
              Ativo (webhook será acionado quando as ações selecionadas ocorrerem)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              onClick={fecharModal}
              variant="secondary"
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSalvar}
              disabled={salvando}
            >
              {salvando ? 'Salvando...' : webhookEditando ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
