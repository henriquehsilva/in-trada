import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, Printer, Download, Copy } from 'lucide-react';
import LayoutDefault from '../../components/layout/LayoutDefault';
import DragDropEditor from '../../components/editor/DragDropEditor';
import QRCode from 'qrcode.react';
import Barcode from 'react-barcode';
import { nanoid } from 'nanoid';
import { obterEventoPorId } from '../../services/eventoService';
import { obterModeloCrachaPorId, criarModeloCracha, atualizarModeloCracha } from '../../services/modeloService';
import { useAuth } from '../../contexts/AuthContext';
import { ComponenteEditor, Evento, ModeloCracha } from '../../models/types';
import CrachaPreviewToPrint from './CrachaPreviewToPrint';
import { getDocs, collection, query, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Pencil, Trash2, Upload } from 'lucide-react';

const camposParticipantePadrao = [
  'nome', 
  'empresa', 
  'email', 
  'telefone', 
  'categoria', 
  'id'
];

export const listarModelosCrachaPorEvento = async (eventoId: string): Promise<ModeloCracha[]> => {
  const modelosRef = collection(db, 'modelosCracha');
  const q = query(modelosRef, where('eventoId', '==', eventoId));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<ModeloCracha, 'id'>),
  }));
};

const EditorCrachas: React.FC = () => {
  const { eventoId } = useParams<{ eventoId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [evento, setEvento] = useState<Evento | null>(null);
  const [modelo, setModelo] = useState<ModeloCracha | null>(null);
  const [modeloId, setModeloId] = useState<string | null>(null);
  const [nomeModelo, setNomeModelo] = useState('Novo Modelo de Crachá');
  const [componentes, setComponentes] = useState<ComponenteEditor[]>([]);
  const [camposDisponiveis, setCamposDisponiveis] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error', texto: string } | null>(null);
  const [erro, setErro] = useState('');

  const tamanhoCracha = { largura: 400, altura: 250 };
  const [modelosSalvos, setModelosSalvos] = useState<ModeloCracha[]>([]);

  useEffect(() => {
    const carregarModelos = async () => {
      if (!eventoId) return;
      try {
        const modelos = await listarModelosCrachaPorEvento(eventoId);
        setModelosSalvos(modelos);
      } catch (err) {
        console.error('Erro ao carregar modelos:', err);
        setMensagem({ tipo: 'error', texto: 'Erro ao carregar os modelos salvos.' });
      }
    };
    carregarModelos();
  }, [eventoId]);

  useEffect(() => {
    const carregarDados = async () => {
      if (!eventoId) return;
      try {
        const eventoDados = await obterEventoPorId(eventoId);
        if (eventoDados) {
          setEvento(eventoDados);

          const camposPersonalizados = eventoDados.camposPersonalizados?.map(campo => campo.nome) || [];
          setCamposDisponiveis([...camposParticipantePadrao, ...camposPersonalizados]);

          const modeloTemporario: ModeloCracha = {
            id: '',
            eventoId,
            nome: 'Modelo Padrão',
            componentes: [
              {
                id: nanoid(),
                tipo: 'barcode',
                propriedades: {
                  x: 20,
                  y: 20,
                  largura: 200,
                  altura: 40,
                  campoVinculado: 'id'
                }
              },
              {
                id: nanoid(),
                tipo: 'texto',
                propriedades: {
                  x: 20,
                  y: 70,
                  largura: 360,
                  altura: 40,
                  texto: eventoDados.nome,
                  estilos: {
                    corFonte: '#063a80',
                    tamanhoFonte: 16,
                    alinhamento: 'center',
                    negrito: true
                  }
                }
              },
              {
                id: nanoid(),
                tipo: 'campo',
                propriedades: {
                  x: 20,
                  y: 120,
                  largura: 360,
                  altura: 40,
                  campoVinculado: 'nome',
                  estilos: {
                    corFonte: '#000000',
                    tamanhoFonte: 18,
                    alinhamento: 'center',
                    negrito: true
                  }
                }
              },
              {
                id: nanoid(),
                tipo: 'campo',
                propriedades: {
                  x: 20,
                  y: 170,
                  largura: 360,
                  altura: 30,
                  campoVinculado: 'empresa',
                  estilos: {
                    corFonte: '#666666',
                    tamanhoFonte: 14,
                    alinhamento: 'center'
                  }
                }
              },
              {
                id: nanoid(),
                tipo: 'qrcode',
                propriedades: {
                  x: 20,
                  y: 210,
                  largura: 60,
                  altura: 60
                }
              },
              {
                id: nanoid(),
                tipo: 'campo',
                propriedades: {
                  x: 90,
                  y: 220,
                  largura: 290,
                  altura: 20,
                  campoVinculado: 'categoria',
                  estilos: {
                    corFonte: '#ffffff',
                    tamanhoFonte: 12,
                    alinhamento: 'center',
                    corFundo: '#ff914d',
                    raio: 4
                  }
                }
              }
            ],
            criadoPorId: currentUser?.uid || '',
            criadoEm: '',
            atualizadoEm: ''
          };          
          
          setModelo(modeloTemporario);
          setModeloId(null);
          setNomeModelo(modeloTemporario.nome);
          setComponentes(modeloTemporario.componentes);
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        setMensagem({ tipo: 'error', texto: 'Erro ao carregar dados. Tente novamente mais tarde.' });
      } finally {
        setLoading(false);
      }
    };
    carregarDados();
  }, [eventoId, currentUser]);

  const handleSalvarModelo = async () => {
    if (!eventoId || !currentUser?.uid) return;
    setSalvando(true);
    setErro('');
    setMensagem(null);
  
    try {
      // Se já houver um modelo salvo, atualiza
      if (modeloId) {
        await atualizarModeloCracha(modeloId, {
          nome: nomeModelo,
          componentes,
          eventoId          
        });
      } else {
        // Cria novo modelo no Firestore
        const novoModelo: Omit<ModeloCracha, 'id'> = {
          nome: nomeModelo,
          eventoId,
          componentes,
          criadoPorId: currentUser.uid,
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString()
        };
  
        const novoId = await criarModeloCracha(novoModelo);
        setModeloId(novoId);

        const modelosAtualizados = await listarModelosCrachaPorEvento(eventoId);
        setModelosSalvos(modelosAtualizados);
      }
  
      setMensagem({ tipo: 'success', texto: 'Modelo salvo com sucesso!' });
      setTimeout(() => setMensagem(null), 3000);
    } catch (err) {
      console.error('Erro ao salvar modelo:', err);
      setMensagem({ tipo: 'error', texto: 'Erro ao salvar modelo.' });
    } finally {
      setSalvando(false);
    }
  };
  
  const participanteExemplo = {
    id: 'P12345', nome: 'João Silva', empresa: 'Empresa Exemplo Ltda',
    email: 'joao@exemplo.com', telefone: '(11) 98765-4321', categoria: 'VIP'
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=600,height=400');
    if (!printWindow) return;
  
    const canvas = document.querySelector('#cracha-preview canvas') as HTMLCanvasElement | null;
    const qrDataUrl = canvas?.toDataURL() || '';
    
    const htmlComponente = componentes.map(comp => {
      const props = comp.propriedades;
      const valor = props.campoVinculado
        ? participanteExemplo[props.campoVinculado as keyof typeof participanteExemplo] || ''
        : props.texto || '';
    
      if (comp.tipo === 'qrcode') {
        return `
          <div style="
            position: absolute;
            top: ${props.y}px;
            left: ${props.x}px;
            width: ${props.largura}px;
            height: ${props.altura}px;
          ">
            <img src="${qrDataUrl}" width="${props.largura}" height="${props.altura}" />
          </div>
        `;
      }
          
      return `
        <div style="
          position: absolute;
          top: ${props.y}px;
          left: ${props.x}px;
          width: ${props.largura}px;
          height: ${props.altura}px;
          font-size: ${props.estilos?.tamanhoFonte || 14}px;
          font-weight: ${props.estilos?.negrito ? 'bold' : 'normal'};
          text-align: ${props.estilos?.alinhamento || 'left'};
          color: ${props.estilos?.corFonte || '#000'};
          background-color: ${props.estilos?.corFundo || 'transparent'};
          border-radius: ${props.estilos?.raio || 0}px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        ">
          ${valor}
        </div>
      `;
    }).join('');
  
    const html = `
      <html>
        <head>
          <title>Impressão de Crachá</title>
          <style>
            @page {
              size: ${tamanhoCracha.largura}px ${tamanhoCracha.altura}px;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
            }
          </style>
        </head>
        <body>
          <div style="
            position: relative;
            width: ${tamanhoCracha.largura}px;
            height: ${tamanhoCracha.altura}px;
            background: white;
          ">
            ${htmlComponente}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => window.close(), 200);
            };
          </script>
        </body>
      </html>
    `;
  
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <LayoutDefault title="Editor de Crachás" backUrl="/operador">
      {mensagem && (
        <div className={`mb-4 p-3 rounded-md ${mensagem.tipo === 'success' ? 'bg-success-light text-success' : 'bg-error-light text-error'}`}>
          {mensagem.texto}
        </div>
      )}

      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
          <div className="mb-4 sm:mb-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Modelo</label>
            <input
              type="text"
              value={nomeModelo}
              onChange={(e) => setNomeModelo(e.target.value)}
              className="input-field max-w-md"
            />
          </div>
          <div className="flex space-x-2">
            <button onClick={handleSalvarModelo} disabled={salvando} className="btn btn-primary flex items-center">
              <Save className="w-5 h-5 mr-2" /> {salvando ? 'Salvando...' : 'Salvar Modelo'}
            </button>
            <button onClick={handlePrint} className="btn btn-outline flex items-center">
              <Printer className="w-5 h-5 mr-2" /> Imprimir
            </button>          
          </div>
        </div>
        <div className="text-sm text-gray-600 mb-4">Evento: <span className="font-medium">{evento?.nome}</span></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <div className="lg:col-span-3">
          <DragDropEditor
            componentes={componentes}
            onSave={setComponentes}
            tamanhoCracha={tamanhoCracha}
            camposDisponiveis={camposDisponiveis}
          />
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Pré-visualização</h3>
          <div className="border border-gray-300 rounded-lg p-2 overflow-auto">
            <div
              style={{
                width: `${tamanhoCracha.largura}px`,
                height: `${tamanhoCracha.altura}px`,
                position: 'relative',
                transform: 'scale(0.6)',
                transformOrigin: 'top left',
                margin: '0 auto',
                background: '#fff'
              }}
            >
              {componentes.map((comp) => {
                const props = comp.propriedades;
                const valor = props.campoVinculado
                  ? participanteExemplo[props.campoVinculado as keyof typeof participanteExemplo] || ''
                  : props.texto || '';
                return (
                  <div
                    key={comp.id}
                    style={{
                      position: 'absolute',
                      top: props.y,
                      left: props.x,
                      width: props.largura,
                      height: props.altura,
                      fontSize: props.estilos?.tamanhoFonte,
                      fontFamily: props.estilos?.fonte || 'Arial',
                      fontWeight: props.estilos?.negrito ? 'bold' : 'normal',
                      fontStyle: props.estilos?.italico ? 'italic' : 'normal',
                      textDecoration: props.estilos?.sublinhado ? 'underline' : 'none',
                      textAlign: props.estilos?.alinhamento,
                      color: props.estilos?.corFonte,
                      backgroundColor: props.estilos?.corFundo,
                      borderRadius: props.estilos?.raio,
                      borderWidth: props.estilos?.bordaLargura || 0,
                      borderColor: props.estilos?.bordaCor || 'transparent',
                      borderStyle: props.estilos?.bordaLargura ? 'solid' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden'
                    }}
                  >
                        {comp.tipo === 'qrcode' ? (
                      <QRCode value={JSON.stringify(participanteExemplo)} size={props.altura} />
                    ) : comp.tipo === 'barcode' ? (
                      <Barcode
                        value={valor}
                        width={1}
                        height={props.altura || 40}
                        displayValue={false}
                        background="transparent"
                      />
                    ) : (
                      valor
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="space-y-2 mt-4">
            <button className="btn btn-outline w-full flex items-center justify-center">
              <Copy className="w-4 h-4 mr-2" /> Duplicar Modelo
            </button>
            <button className="btn btn-outline w-full flex items-center justify-center">
              <Download className="w-4 h-4 mr-2" /> Exportar Modelo
            </button>
          </div>
        </div>
      </div>
      <div id="cracha-preview" style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <CrachaPreviewToPrint
          componentes={componentes}
          participante={participanteExemplo}
          tamanho={tamanhoCracha}
        />
      </div>
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <h3 className="text-lg font-semibold mb-4">Modelos Salvos</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-bold text-gray-600">Nome</th>
                <th className="px-4 py-2 text-right font-bold text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {modelosSalvos.map((modelo) => (
                <tr key={modelo.id}>
                  <td className="px-4 py-2">{modelo.nome}</td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <button
                      title="Usar modelo"
                      onClick={() => {
                        setModeloId(modelo.id);
                        setNomeModelo(modelo.nome);
                        setComponentes(modelo.componentes);
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Upload size={18} />
                    </button>
                    <button
                      title="Excluir modelo"
                      onClick={async () => {
                        if (!window.confirm(`Deseja excluir o modelo "${modelo.nome}"?`)) return;
                        try {
                          await deleteDoc(doc(db, 'modelosCracha', modelo.id));
                          setModelosSalvos((prev) => prev.filter((m) => m.id !== modelo.id));
                          if (modeloId === modelo.id) {
                            setModeloId(null);
                            setNomeModelo('Novo Modelo de Crachá');
                            setComponentes([]);
                          }
                          setMensagem({ tipo: 'success', texto: 'Modelo excluído com sucesso.' });
                        } catch (err) {
                          console.error('Erro ao excluir modelo:', err);
                          setMensagem({ tipo: 'error', texto: 'Erro ao excluir modelo.' });
                        }
                      }}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>      
    </LayoutDefault>
  );
};

export default EditorCrachas;