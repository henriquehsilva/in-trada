import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Printer, Download, Copy, Edit, Trash2, Upload } from 'lucide-react';
import LayoutDefault from '../../components/layout/LayoutDefault';
import DragDropEditor from '../../components/editor/DragDropEditor';
import QRCode from 'qrcode.react';
import Barcode from 'react-barcode';
import { nanoid } from 'nanoid';
import { obterEventoPorId, listarEventosPorAdmin } from '../../services/eventoService';
import { obterModeloCrachaPorId, criarModeloCracha, atualizarModeloCracha } from '../../services/modeloService';
import { useAuth } from '../../contexts/AuthContext';
import { ComponenteEditor, Evento, ModeloCracha } from '../../models/types';
import CrachaPreviewToPrint from './CrachaPreviewToPrint';
import { getDocs, collection, query, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';

const camposParticipantePadrao = [
  'id','nome','empresa','nomeCracha','empresaCracha','cargo','email1','email2','celular','telefone','categoria','cpf','rg','cnpj','codigoCliente',
  'opcao1','opcao2','opcao3','opcao4','opcao5','opcao6','opcao7','opcao8','opcao9','opcao10','observacao'
];

// 🔹 Helper: pega os 6 primeiros dígitos do CPF
function getCpfPrefix(participante: any): string {
  if (!participante?.cpf) return '';
  const digits = participante.cpf.replace(/\D/g, '');
  return digits.slice(0, 6);
}

export const listarModelosCrachaPorEvento = async (eventoId: string): Promise<ModeloCracha[]> => {
  const modelosRef = collection(db, 'modelosCracha');
  const q = query(modelosRef, where('eventoId', '==', eventoId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<ModeloCracha, 'id'>),
  }));
};

export const listarTodosModelosCracha = async (): Promise<ModeloCracha[]> => {
  const modelosRef = collection(db, 'modelosCracha');
  const querySnapshot = await getDocs(modelosRef);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<ModeloCracha, 'id'>),
  }));
};

const fontesDisponiveisPadrao = ['Arial','Verdana','Times New Roman','Courier New','Georgia','Tahoma','Trebuchet MS'];

function sanitizeObjeto(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sanitizeObjeto);
  if (typeof obj === 'object' && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => [key, sanitizeObjeto(value)])
    );
  }
  return obj;
}

const EditorCrachas: React.FC = () => {
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

  const [modelosSalvos, setModelosSalvos] = useState<ModeloCracha[]>([]);
  const [fontesDisponiveis, setFontesDisponiveis] = useState<string[]>(fontesDisponiveisPadrao);

  const cmToZplPx = (cm: number) => Math.round((cm / 2.54) * 203);
  const tamanhoCracha = modelo?.larguraCm && modelo?.alturaCm
    ? { largura: cmToZplPx(modelo.larguraCm), altura: cmToZplPx(modelo.alturaCm) }
    : { largura: 400, altura: 250 };

  const [eventosDisponiveis, setEventosDisponiveis] = useState<Evento[]>([]);
  const [eventoSelecionadoId, setEventoSelecionadoId] = useState<string | null>(null);

  useEffect(() => {
    const carregarModelos = async () => {
      const modelos = await listarTodosModelosCracha();
      setModelosSalvos(modelos);
    };
    carregarModelos();
  }, []);

  useEffect(() => {
    const carregarDados = async () => {
      if (!eventoSelecionadoId) return;
      try {
        const eventoDados = await obterEventoPorId(eventoSelecionadoId);
        if (eventoDados) {
          setEvento(eventoDados);
          const camposPersonalizados = eventoDados.camposPersonalizados?.map(campo => campo.nome) || [];
          setCamposDisponiveis([...camposParticipantePadrao, ...camposPersonalizados]);

          const modeloTemporario: ModeloCracha = {
            id: '',
            eventoId: eventoSelecionadoId,
            nome: 'Modelo Padrão',
            componentes: [
              { id: nanoid(), tipo: 'texto', propriedades: { x:20,y:70,largura:360,altura:40,texto:eventoDados.nome,estilos:{ corFonte:'#063a80',tamanhoFonte:16,alinhamento:'center',negrito:true,fonte:'Arial' }}},
              { id: nanoid(), tipo: 'campo', propriedades: { x:20,y:120,largura:360,altura:40,campoVinculado:'nome',estilos:{ corFonte:'#000',tamanhoFonte:18,alinhamento:'center',negrito:true,fonte:'Arial' }}},
              { id: nanoid(), tipo: 'campo', propriedades: { x:20,y:170,largura:360,altura:30,campoVinculado:'empresa',estilos:{ corFonte:'#666',tamanhoFonte:14,alinhamento:'center',fonte:'Arial' }}},
              { id: nanoid(), tipo: 'qrcode', propriedades: { x:20,y:210,largura:60,altura:60 }},
              { id: nanoid(), tipo: 'campo', propriedades: { x:90,y:220,largura:290,altura:20,campoVinculado:'categoria',estilos:{ corFonte:'#fff',tamanhoFonte:12,alinhamento:'center',corFundo:'#ff914d',raio:4,fonte:'Arial' }}}
            ],
            larguraCm: 8,
            alturaCm: 3,
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
        setMensagem({ tipo: 'error', texto: 'Erro ao carregar dados.' });
      } finally { setLoading(false); }
    };
    carregarDados();
  }, [eventoSelecionadoId, currentUser]);

  useEffect(() => {
    const carregarEventos = async () => {
      if (!currentUser?.uid) return;
      const adminId = import.meta.env.VITE_ADMIN_USER_ID;
      const eventos = await listarEventosPorAdmin(adminId);
      setEventosDisponiveis(eventos);
      if (!eventoSelecionadoId && eventos.length > 0) setEventoSelecionadoId(eventos[0].id);
    };
    carregarEventos();
  }, [currentUser?.uid]);

  const participanteExemplo = {
    id:'P12345',nome:'João Silva',empresa:'Empresa Exemplo Ltda',nomeCracha:'J. Silva',empresaCracha:'Exemplo Ltda',
    cargo:'Gerente de Projetos',email1:'joao@exemplo.com',email2:'joaosilva@gmail.com',celular:'(11) 99999-1234',
    telefone:'(11) 98765-4321',categoria:'VIP',cpf:'123.456.789-00',rg:'12.345.678-9',cnpj:'12.345.678/0001-90',
    codigoCliente:'C123456',opcao1:'Sim',opcao2:'Não',opcao3:'Sim',opcao4:'opcao4',opcao5:'opcao5',
    opcao6:'opcao6',opcao7:'opcao7',opcao8:'opcao8',opcao9:'opcao9',opcao10:'opcao10',
    observacao:'Participante confirmado com credencial VIP'
  };

  return (
    <LayoutDefault title="Editor de Crachás" backUrl="/operador">
      {mensagem && (
        <div className={`mb-4 p-3 rounded-md ${mensagem.tipo==='success'?'bg-success-light text-success':'bg-error-light text-error'}`}>
          {mensagem.texto}
        </div>
      )}

      {/* 🔹 Novo: Seleção de Evento (acima dos campos) */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="w-full md:w-2/3">
            <label htmlFor="eventoSelect" className="block text-sm font-medium text-gray-700 mb-1">
              Evento do Crachá
            </label>
            <select
              id="eventoSelect"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={eventoSelecionadoId ?? ''}
              onChange={(e) => setEventoSelecionadoId(e.target.value || null)}
              disabled={loading || eventosDisponiveis.length === 0}
            >
              {loading && <option value="">Carregando eventos…</option>}
              {!loading && eventosDisponiveis.length === 0 && (
                <option value="">Nenhum evento disponível</option>
              )}
              {!loading && eventosDisponiveis.length > 0 && (
                <>
                  {eventosDisponiveis.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.nome}
                    </option>
                  ))}
                </>
              )}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Selecione o evento ao qual este modelo de crachá ficará associado.
            </p>
          </div>

          {/* Resumo rápido do evento selecionado (opcional) */}
          <div className="w-full md:w-1/3 bg-gray-50 border border-gray-200 rounded-md p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Resumo do Evento</p>
            {evento ? (
              <div className="mt-1 text-sm text-gray-700">
                <p className="font-semibold">{evento.nome}</p>
                {evento?.dataInicio && evento?.dataFim ? (
                  <p>
                    {new Date(evento.dataInicio).toLocaleDateString()} – {new Date(evento.dataFim).toLocaleDateString()}
                  </p>
                ) : (
                  <p>Datas não informadas</p>
                )}
                {evento?.local && <p className="truncate">Local: {evento.local}</p>}
              </div>
            ) : (
              <p className="mt-1 text-gray-500 text-sm">Nenhum evento selecionado.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-1 gap-6 mb-6">
        <div className="w-full">
          <DragDropEditor
            componentes={componentes}
            onSave={setComponentes}
            tamanhoCracha={tamanhoCracha}
            camposDisponiveis={camposDisponiveis}
            fontesDisponiveis={fontesDisponiveis}
          />
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Pré-visualização</h3>
          <div className="border border-gray-300 rounded-lg p-2 overflow-auto">
            <div
              style={{
                width:`${tamanhoCracha.largura}px`,
                height:`${tamanhoCracha.altura}px`,
                position:'relative',
                transform:'scale(0.6)',
                transformOrigin:'top left',
                margin:'0 auto',
                background:'#fff'
              }}
            >
              {componentes.map((comp) => {
                const props = comp.propriedades as any;
                const cpfPrefix = getCpfPrefix(participanteExemplo);
                return (
                  <div
                    key={comp.id}
                    style={{
                      position:'absolute',
                      top:props.y,
                      left:props.x,
                      width:props.largura,
                      height:props.altura,
                      display:'flex',
                      alignItems:'center',
                      justifyContent:'center'
                    }}
                  >
                    {comp.tipo==='qrcode' ? (
                      <QRCode value={cpfPrefix} size={props.altura}/>
                    ) : comp.tipo==='barcode' ? (
                      <Barcode value={cpfPrefix} width={1} height={props.altura||40} displayValue={false} background="transparent"/>
                    ) : (
                      props.campoVinculado ? (participanteExemplo as any)[props.campoVinculado] || '' : props.texto || ''
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 🔹 Lista de modelos salvos */}
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
                  <td className="px-4 py-2">
                    {modelo.nome} {modelo.padrao && <span className="text-sm text-primary font-semibold ml-2">(Padrão)</span>}
                  </td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <button
                      onClick={async()=>{ try{
                        await atualizarModeloCracha(modelo.id,{padrao:true});
                        const atualizados=await listarTodosModelosCracha();
                        setModelosSalvos(atualizados);
                        setMensagem({tipo:'success',texto:'Modelo definido como padrão.'});
                      }catch(err){console.error(err);setMensagem({tipo:'error',texto:'Erro ao definir modelo padrão.'});}}}
                      className="btn btn-outline text-xs"
                    >
                      Definir como Padrão
                    </button>
                    <button
                      onClick={async()=>{ try{
                        const modeloCompleto=await obterModeloCrachaPorId(modelo.id);
                        if(modeloCompleto){ setModeloId(modelo.id); setNomeModelo(modeloCompleto.nome); setComponentes(modeloCompleto.componentes);}
                      }catch(err){console.error(err);setMensagem({tipo:'error',texto:'Erro ao carregar modelo.'});}}}
                      className="text-blue-600 hover:text-blue-800"
                      title="Carregar modelo"
                    >
                      <Upload size={18}/>
                    </button>
                    <button
                      onClick={async()=>{ if(!window.confirm(`Excluir modelo "${modelo.nome}"?`))return;
                        try{ await deleteDoc(doc(db,'modelosCracha',modelo.id));
                          setModelosSalvos(prev=>prev.filter(m=>m.id!==modelo.id));
                          if(modeloId===modelo.id){ setModeloId(null); setNomeModelo('Novo Modelo de Crachá'); setComponentes([]);}
                          setMensagem({tipo:'success',texto:'Modelo excluído com sucesso.'});
                        }catch(err){console.error(err);setMensagem({tipo:'error',texto:'Erro ao excluir modelo.'});}}}
                      className="text-red-600 hover:text-red-800"
                      title="Excluir modelo"
                    >
                      <Trash2 size={18}/>
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
