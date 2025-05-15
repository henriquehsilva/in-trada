import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Layout, Copy, Download } from 'lucide-react';
import LayoutDefault from '../../components/layout/LayoutDefault';
import DragDropEditor from '../../components/editor/DragDropEditor';
import { nanoid } from 'nanoid';
import {
  obterEventoPorId
} from '../../services/eventoService';
import {
  obterModeloPainelPorId,
  criarModeloPainel,
  atualizarModeloPainel
} from '../../services/modeloService';
import { useAuth } from '../../contexts/AuthContext';
import { ComponenteEditor, Evento, ModeloPainel } from '../../models/types';

const camposParticipantePadrao = [
  'nome',
  'empresa',
  'email',
  'telefone',
  'categoria',
  'id'
];

const fontesWindows = [
  'Arial',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Lucida Console'
];

const EditorPainel: React.FC = () => {
  const { eventoId } = useParams<{ eventoId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [evento, setEvento] = useState<Evento | null>(null);
  const [modelo, setModelo] = useState<ModeloPainel | null>(null);
  const [modeloId, setModeloId] = useState<string | null>(null);
  const [nomeModelo, setNomeModelo] = useState('Novo Modelo de Painel');
  const [componentes, setComponentes] = useState<ComponenteEditor[]>([]);
  const [camposDisponiveis, setCamposDisponiveis] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error', texto: string } | null>(null);

  const tamanhoPainel = { largura: 800, altura: 600 };

  useEffect(() => {
    const carregarDados = async () => {
      if (!eventoId) return;

      try {
        const eventoDados = await obterEventoPorId(eventoId);
        if (eventoDados) {
          setEvento(eventoDados);

          const camposPersonalizados = eventoDados.camposPersonalizados?.map(campo => campo.nome) || [];
          setCamposDisponiveis([...camposParticipantePadrao, ...camposPersonalizados]);

          const modeloExistente: ModeloPainel = {
            id: nanoid(),
            eventoId,
            nome: 'Modelo Padrão',
            componentes: [
              {
                id: nanoid(),
                tipo: 'texto',
                propriedades: {
                  x: 20,
                  y: 20,
                  largura: 760,
                  altura: 60,
                  texto: 'Bem-vindo ao ' + eventoDados.nome,
                  estilos: {
                    corFonte: '#063a80',
                    tamanhoFonte: 32,
                    alinhamento: 'center',
                    negrito: true,
                    fonte: 'Arial'
                  }
                }
              },
              {
                id: nanoid(),
                tipo: 'divisao',
                propriedades: {
                  x: 20,
                  y: 100,
                  largura: 760,
                  altura: 2,
                  estilos: {
                    corFundo: '#e0e0e0'
                  }
                }
              },
              {
                id: nanoid(),
                tipo: 'texto',
                propriedades: {
                  x: 20,
                  y: 120,
                  largura: 760,
                  altura: 40,
                  texto: 'Faça seu credenciamento',
                  estilos: {
                    corFonte: '#666666',
                    tamanhoFonte: 24,
                    alinhamento: 'center',
                    fonte: 'Verdana'
                  }
                }
              },
              {
                id: nanoid(),
                tipo: 'qrcode',
                propriedades: {
                  x: 300,
                  y: 180,
                  largura: 200,
                  altura: 200
                }
              },
              {
                id: nanoid(),
                tipo: 'texto',
                propriedades: {
                  x: 20,
                  y: 400,
                  largura: 760,
                  altura: 30,
                  texto: 'Aponte a câmera do seu celular para o QR Code',
                  estilos: {
                    corFonte: '#666666',
                    tamanhoFonte: 18,
                    alinhamento: 'center',
                    fonte: 'Georgia'
                  }
                }
              }
            ],
            criadoPorId: currentUser?.uid || '',
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString()
          };

          setModelo(modeloExistente);
          setModeloId(modeloExistente.id);
          setNomeModelo(modeloExistente.nome);
          setComponentes(modeloExistente.componentes as ComponenteEditor[]);
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        setMensagem({
          tipo: 'error',
          texto: 'Erro ao carregar dados. Tente novamente mais tarde.'
        });
      } finally {
        setLoading(false);
      }
    };

    carregarDados();
  }, [eventoId, currentUser]);

  const handleSalvarModelo = async () => {
    if (!eventoId || !currentUser?.uid) return;

    setSalvando(true);

    try {
      if (modeloId) {
        await atualizarModeloPainel(modeloId, {
          nome: nomeModelo,
          componentes,
          eventoId
        });
      } else {
        const id = await criarModeloPainel({
          nome: nomeModelo,
          componentes,
          eventoId,
          criadoPorId: currentUser.uid
        });
        setModeloId(id);
      }

      setMensagem({
        tipo: 'success',
        texto: 'Modelo salvo com sucesso!'
      });

      setTimeout(() => setMensagem(null), 3000);
    } catch (err) {
      console.error('Erro ao salvar modelo:', err);
      setMensagem({
        tipo: 'error',
        texto: 'Erro ao salvar modelo. Tente novamente.'
      });
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <LayoutDefault title="Carregando...">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </LayoutDefault>
    );
  }

  if (!evento) {
    return (
      <LayoutDefault title="Evento não encontrado">
        <div className="bg-error-light text-error p-4 rounded-md">
          Evento não encontrado ou você não tem permissão para acessá-lo.
        </div>
      </LayoutDefault>
    );
  }

  return (
    <LayoutDefault title="Editor de Painel" backUrl={`/operador`}>
      {mensagem && (
        <div className={`mb-4 p-3 rounded-md ${mensagem.tipo === 'success' ? 'bg-success-light text-success' : 'bg-error-light text-error'}`}>
          {mensagem.texto}
        </div>
      )}

      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
          <div className="mb-4 sm:mb-0">
            <label htmlFor="modelo-nome" className="block text-sm font-medium text-gray-700 mb-1">
              Nome do Modelo
            </label>
            <input
              type="text"
              id="modelo-nome"
              value={nomeModelo}
              onChange={(e) => setNomeModelo(e.target.value)}
              className="input-field max-w-md"
            />
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handleSalvarModelo}
              disabled={salvando}
              className="btn btn-primary flex items-center"
            >
              <Save className="w-5 h-5 mr-2" />
              {salvando ? 'Salvando...' : 'Salvar Modelo'}
            </button>
          </div>
        </div>

        <div className="text-sm text-gray-600 mb-4">
          Evento: <span className="font-medium">{evento.nome}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <div className="lg:col-span-3">
          <DragDropEditor
            componentes={componentes}
            onSave={setComponentes}
            tamanhoCracha={tamanhoPainel}
            camposDisponiveis={camposDisponiveis}
          />
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Pré-visualização</h3>

          <div className="border border-gray-300 rounded-lg p-2 mb-4">
            <div
              style={{
                width: `${tamanhoPainel.largura * 0.25}px`,
                height: `${tamanhoPainel.altura * 0.25}px`,
                position: 'relative',
                transform: 'scale(0.25)',
                transformOrigin: 'top left',
                overflow: 'hidden'
              }}
            >
              <div className="absolute inset-0 bg-white border border-gray-300">
                <p className="text-center text-xs p-2">Pré-visualização reduzida</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm">Ações:</h4>
            <button className="btn btn-outline w-full flex items-center justify-center">
              <Copy className="w-4 h-4 mr-2" />
              Duplicar Modelo
            </button>
            <button className="btn btn-outline w-full flex items-center justify-center">
              <Download className="w-4 h-4 mr-2" />
              Exportar Modelo
            </button>
          </div>
        </div>
      </div>
    </LayoutDefault>
  );
};

export default EditorPainel;
