// EditorCrachas.tsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Edit, Trash2, Upload } from 'lucide-react';
import LayoutDefault from '../../components/layout/LayoutDefault';
import DragDropEditor from '../../components/editor/DragDropEditor';
import QRCode from 'qrcode.react';
import Barcode from 'react-barcode';
import { buildQrValue } from '../../utils/qrcode';
import { nanoid } from 'nanoid';
import { obterEventoPorId, listarEventosPorAdmin } from '../../services/eventoService';
import { obterModeloCrachaPorId, criarModeloCracha, atualizarModeloCracha } from '../../services/modeloService';
import { useAuth } from '../../contexts/AuthContext';
import { ComponenteEditor, Evento, ModeloCracha } from '../../models/types';
import CrachaPreviewToPrint from './CrachaPreviewToPrint';
import { getDocs, collection, query, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

const fontesDisponiveisPadrao = [
  'Arial','Verdana','Times New Roman','Courier New','Georgia','Tahoma','Trebuchet MS'
];

// 🆕 helpers para fontes customizadas (persistência simples no navegador)
const LS_KEY_FONTS = 'editorCrachas.customFonts'; // { [family]: dataURL }

async function registerFont(family: string, dataUrl: string) {
  // registra a fonte na sessão do browser
  const font = new FontFace(family, `url(${dataUrl})`);
  await font.load();
  (document as any).fonts.add(font);
}

async function loadSavedFonts(): Promise<Record<string,string>> {
  try {
    const raw = localStorage.getItem(LS_KEY_FONTS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveFont(family: string, dataUrl: string) {
  const all = JSON.parse(localStorage.getItem(LS_KEY_FONTS) || '{}');
  all[family] = dataUrl;
  localStorage.setItem(LS_KEY_FONTS, JSON.stringify(all));
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

const camposParticipantePadrao = [
  'id','nome','empresa','nomeCracha','empresaCracha','cargo','email1','email2','celular','telefone','categoria','cpf','rg','cnpj','codigoCliente',
  'opcao1','opcao2','opcao3','opcao4','opcao5','opcao6','opcao7','opcao8','opcao9','opcao10','observacao'
];

function getCpfPrefix(participante: any): string {
  if (!participante?.cpf) return '';
  const digits = participante.cpf.replace(/\D/g, '');
  return digits.slice(0, 6);
}

export const listarModelosCrachaPorEvento = async (eventoId: string): Promise<ModeloCracha[]> => {
  const modelosRef = collection(db, 'modelosCracha');
  const qy = query(modelosRef, where('eventoId', '==', eventoId));
  const qs = await getDocs(qy);
  return qs.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<ModeloCracha, 'id'>),
  }));
};

export const listarTodosModelosCracha = async (): Promise<ModeloCracha[]> => {
  const modelosRef = collection(db, 'modelosCracha');
  const qs = await getDocs(modelosRef);
  return qs.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<ModeloCracha, 'id'>),
  }));
};

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

type ModeloCrachaCreate = Omit<ModeloCracha, 'id' | 'criadoEm' | 'atualizadoEm'>;
type CreateReturn = string | { id: string } | null | undefined;
const hasId = (x: unknown): x is { id: string } =>
  typeof x === 'object' && x !== null && 'id' in (x as any) && typeof (x as any).id === 'string';

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

  // 🆕 input escondido para upload de fonte
  const fontInputRef = useRef<HTMLInputElement | null>(null);

  const cmToZplPx = (cm: number) => Math.round((cm / 2.54) * 203);
  const tamanhoCracha = modelo?.larguraCm && modelo?.alturaCm
    ? { largura: cmToZplPx(modelo.larguraCm), altura: cmToZplPx(modelo.alturaCm) }
    : { largura: 400, altura: 250 };

  const [eventosDisponiveis, setEventosDisponiveis] = useState<Evento[]>([]);
  const [eventoSelecionadoId, setEventoSelecionadoId] = useState<string | null>(null);

  const eventosById = useMemo<Record<string, string>>(
    () => Object.fromEntries(eventosDisponiveis.map(ev => [ev.id, ev.nome])),
    [eventosDisponiveis]
  );

  // 🆕 restaurar fontes salvas do localStorage
  useEffect(() => {
    (async () => {
      const saved = await loadSavedFonts();
      const families = Object.keys(saved);
      if (families.length) {
        for (const fam of families) {
          try {
            await registerFont(fam, saved[fam]);
          } catch (e) {
            console.warn('Falha ao registrar fonte salva:', fam, e);
          }
        }
        setFontesDisponiveis(prev => Array.from(new Set([...prev, ...families])));
      }
    })();
  }, []);

  // 🆕 handler de upload de fonte
  const onClickUploadFont = () => fontInputRef.current?.click();

  const onChangeFontFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite re-selecionar o mesmo arquivo depois
    if (!file) return;

    const extOk = /\.(ttf|otf)$/i.test(file.name);
    if (!extOk) {
      setMensagem({ tipo: 'error', texto: 'Formato inválido. Envie .ttf ou .otf.' });
      return;
    }

    try {
      // nome da família = nome do arquivo sem extensão
      const family = file.name.replace(/\.(ttf|otf)$/i, '');
      const dataUrl = await fileToDataURL(file);
      await registerFont(family, dataUrl);
      saveFont(family, dataUrl);
      setFontesDisponiveis(prev => Array.from(new Set([...prev, family])));
      setMensagem({ tipo: 'success', texto: `Fonte "${family}" adicionada e pronta para uso.` });
    } catch (err: any) {
      console.error(err);
      setMensagem({ tipo: 'error', texto: 'Falha ao carregar a fonte.' });
    }
  };

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
          const camposPersonalizados = eventoDados.camposPersonalizados?.map((c:any) => c.nome) || [];
          setCamposDisponiveis([...camposParticipantePadrao, ...camposPersonalizados]);

          const modeloPadraoId = (eventoDados as any)?.modeloCrachaPadraoId as string | undefined;

          if (modeloPadraoId) {
            const modeloPadrao = await obterModeloCrachaPorId(modeloPadraoId);
            if (modeloPadrao) {
              setModeloId(modeloPadrao.id);
              setNomeModelo(modeloPadrao.nome);
              setComponentes(modeloPadrao.componentes);
              setModelo(modeloPadrao);
            } else {
              const modeloTemporario = criarModeloTemporario(eventoSelecionadoId, eventoDados, currentUser?.uid);
              hidratarTemporario(modeloTemporario);
            }
          } else {
            const modeloTemporario = criarModeloTemporario(eventoSelecionadoId, eventoDados, currentUser?.uid);
            hidratarTemporario(modeloTemporario);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        setMensagem({ tipo: 'error', texto: 'Erro ao carregar dados.' });
      } finally { setLoading(false); }
    };
    carregarDados();
  }, [eventoSelecionadoId, currentUser]);

  const criarModeloTemporario = (eventoId: string, eventoDados: any, userId?: string | null): ModeloCracha => ({
    id: '',
    eventoId,
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
    criadoPorId: userId || '',
    criadoEm: '',
    atualizadoEm: ''
  });

  const hidratarTemporario = (modeloTemporario: ModeloCracha) => {
    setModelo(modeloTemporario);
    setModeloId(null);
    setNomeModelo(modeloTemporario.nome);
    setComponentes(modeloTemporario.componentes);
  };

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

  const definirModeloComoPadrao = async (modeloIdAlvo: string, eventoIdAlvo: string) => {
    const modelosDoEvento = await listarModelosCrachaPorEvento(eventoIdAlvo);
    await Promise.all(
      modelosDoEvento
        .filter(m => (m as any).padrao && m.id !== modeloIdAlvo)
        .map(m => atualizarModeloCracha(m.id, { padrao: false }))
    );

    await atualizarModeloCracha(modeloIdAlvo, { padrao: true, eventoId: eventoIdAlvo });
    await updateDoc(doc(db, 'eventos', eventoIdAlvo), { modeloCrachaPadraoId: modeloIdAlvo });

    const atualizados = await listarTodosModelosCracha();
    setModelosSalvos(atualizados);

    const modeloPadrao = await obterModeloCrachaPorId(modeloIdAlvo);
    if (modeloPadrao) {
      setModeloId(modeloPadrao.id);
      setNomeModelo(modeloPadrao.nome);
      setComponentes(modeloPadrao.componentes);
      setModelo(modeloPadrao);
    }
  };

  const montarPayloadModeloCreate = (): ModeloCrachaCreate => {
    if (!eventoSelecionadoId) throw new Error('Selecione um evento antes de salvar.');
    const nomeSeguro = (nomeModelo || '').trim() || 'Modelo sem nome';
    return {
      nome: nomeSeguro,
      eventoId: eventoSelecionadoId,
      componentes: sanitizeObjeto(componentes) as ComponenteEditor[],
      larguraCm: modelo?.larguraCm ?? 8,
      alturaCm: modelo?.alturaCm ?? 3,
      criadoPorId: currentUser?.uid || '',
      padrao: false,
    } as ModeloCrachaCreate;
  };

  const montarPayloadModeloUpdate = (): Partial<ModeloCracha> => {
    if (!eventoSelecionadoId) throw new Error('Selecione um evento antes de atualizar.');
    const nomeSeguro = (nomeModelo || '').trim() || 'Modelo sem nome';
    return {
      nome: nomeSeguro,
      eventoId: eventoSelecionadoId,
      componentes: sanitizeObjeto(componentes) as ComponenteEditor[],
      larguraCm: modelo?.larguraCm ?? 8,
      alturaCm: modelo?.alturaCm ?? 3,
      atualizadoEm: new Date().toISOString(),
    };
  };

  const handleSalvarComoNovo = async () => {
    try {
      setSalvando(true);
      const payload = montarPayloadModeloCreate();
      const res = (await criarModeloCracha(payload)) as CreateReturn;

      const novoId: string | null =
        typeof res === 'string' ? res : hasId(res) ? res.id : null;

      const atualizados = await listarTodosModelosCracha();
      setModelosSalvos(atualizados);

      if (novoId) {
        const created = (atualizados as ModeloCracha[]).find((m) => m.id === novoId);
        if (created) {
          setModeloId(created.id);
          setNomeModelo(created.nome);
          setModelo(created);
        }
      }
      setMensagem({ tipo: 'success', texto: 'Modelo criado com sucesso.' });
    } catch (err:any) {
      console.error(err);
      setMensagem({ tipo: 'error', texto: err?.message || 'Erro ao criar novo modelo.' });
    } finally {
      setSalvando(false);
    }
  };

  const handleAtualizarModelo = async () => {
    if (!modeloId) {
      setMensagem({ tipo: 'error', texto: 'Nenhum modelo selecionado para atualizar.' });
      return;
    }
    try {
      setSalvando(true);
      const payload = montarPayloadModeloUpdate();
      await atualizarModeloCracha(modeloId, payload);
      const atualizados = await listarTodosModelosCracha();
      setModelosSalvos(atualizados);
      setMensagem({ tipo: 'success', texto: 'Modelo atualizado com sucesso.' });
    } catch (err:any) {
      console.error(err);
      setMensagem({ tipo: 'error', texto: err?.message || 'Erro ao atualizar modelo.' });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <LayoutDefault title="Editor de Crachás" backUrl="/operador">
      {mensagem && (
        <div className={`mb-4 p-3 rounded-md ${mensagem.tipo==='success'?'bg-success-light text-success':'bg-error-light text-error'}`}>
          {mensagem.texto}
        </div>
      )}

      {/* 🔹 Upload de fonte .ttf/.otf */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Fontes disponíveis no editor</p>
            <p className="text-xs text-gray-500">
              Padrões: {fontesDisponiveisPadrao.join(', ')}. &nbsp;
              Customizadas: {fontesDisponiveis.filter(f => !fontesDisponiveisPadrao.includes(f)).join(', ') || '—'}
            </p>
          </div>
          <div>
            <input
              ref={fontInputRef}
              type="file"
              accept=".ttf,.otf"
              className="hidden"
              onChange={onChangeFontFile}
            />
            <button
              type="button"
              onClick={onClickUploadFont}
              className="inline-flex items-center px-3 py-2 rounded-md text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
              title="Enviar arquivo de fonte (.ttf/.otf) para usar no editor"
            >
              <Upload size={16} className="mr-2" />
              Adicionar Fonte (.ttf/.otf)
            </button>
          </div>
        </div>
      </div>

      {/* 🔹 Seleção de Evento */}
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

      {/* 🔹 Bloco: salvar/atualizar modelo */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label htmlFor="nomeModelo" className="block text-sm font-medium text-gray-700 mb-1">
              Nome do Modelo
            </label>
            <input
              id="nomeModelo"
              type="text"
              value={nomeModelo}
              onChange={(e)=>setNomeModelo(e.target.value)}
              placeholder="Ex.: Crachá VIP - Frente"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Dica: use nomes claros (ex.: “Crachá Padrão · 8x3cm · Evento X”).
            </p>
          </div>

        <div className="flex gap-2 p-4 mb-1">
            <button
              onClick={handleSalvarComoNovo}
              disabled={salvando || !eventoSelecionadoId}
              className="inline-flex items-center justify-center px-3 py-2 rounded-md text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 w-1/2"
              title="Cria um novo modelo a partir do layout atual"
            >
              <Save size={16} className="mr-2" />
              Salvar como novo
            </button>
            <button
              onClick={handleAtualizarModelo}
              disabled={salvando || !modeloId || !eventoSelecionadoId}
              className="inline-flex items-center justify-center px-3 py-2 rounded-md text-sm font-semibold bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-60 w-1/2"
              title="Atualiza o modelo atualmente selecionado"
            >
              <Edit size={16} className="mr-2" />
              Atualizar modelo
            </button>
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
            fontesDisponiveis={fontesDisponiveis} // 👈 inclui as fontes customizadas
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

                const qrValue = comp.tipo === 'qrcode'
                  ? buildQrValue(participanteExemplo as any, props.camposQrCode, props.separadorQrCode)
                  : (participanteExemplo as any)?.codigoCliente?.toString?.() ||
                    (participanteExemplo as any)?.id?.toString?.() || '';

                // conteúdo por tipo
                const content =
                  comp.tipo === 'qrcode'
                    ? <QRCode value={qrValue || 'QR Code'} size={props.altura}/>
                    : comp.tipo === 'barcode'
                      ? <Barcode value={qrValue} width={1} height={props.altura||40} displayValue={false} background="transparent"/>
                      : (props.campoVinculado ? (participanteExemplo as any)[props.campoVinculado] || '' : props.texto || '');

                // aplica a family se existir em estilos.fonte
                const family = props?.estilos?.fonte ? String(props.estilos.fonte) : undefined;

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
                      justifyContent:'center',
                      fontFamily: family
                    }}
                  >
                    {content}
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
                <th className="px-4 py-2 text-left font-bold text-gray-600">Evento</th>
                <th className="px-4 py-2 text-right font-bold text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {modelosSalvos.map((m: ModeloCracha) => {
                const nomeEvento = m.eventoId ? (eventosById[m.eventoId] ?? 'Desconhecido') : '—';
                const isPadrao = (m as any).padrao === true;
                return (
                  <tr key={m.id}>
                    <td className="px-4 py-2">
                      {m.nome}{' '}
                      {isPadrao && (
                        <span className="text-xs text-emerald-700 font-semibold ml-2">
                          (Padrão do evento)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {nomeEvento}
                    </td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <button
                        onClick={async()=>{ 
                          if(!eventoSelecionadoId){
                            setMensagem({tipo:'error',texto:'Selecione um evento antes de definir um modelo padrão.'});
                            return;
                          }
                          try{
                            await definirModeloComoPadrao(m.id, eventoSelecionadoId);
                            setMensagem({tipo:'success',texto:'Modelo definido como padrão e carregado no preview.'});
                          }catch(err){
                            console.error(err);
                            setMensagem({tipo:'error',texto:'Erro ao definir modelo padrão para o evento.'});
                          }
                        }}
                        className="btn btn-outline text-xs"
                        title="Definir como padrão do evento selecionado"
                      >
                        Definir como Padrão
                      </button>
                      <button
                        onClick={async()=>{ try{
                          const modeloCompleto=await obterModeloCrachaPorId(m.id);
                          if(modeloCompleto){
                            setModeloId(m.id);
                            setNomeModelo(modeloCompleto.nome);
                            setComponentes(modeloCompleto.componentes);
                            setModelo(modeloCompleto);
                            setMensagem({tipo:'success',texto:`Modelo "${modeloCompleto.nome}" carregado para edição.`});
                          }
                        }catch(err){console.error(err);setMensagem({tipo:'error',texto:'Erro ao carregar modelo.'});}}}
                        className="text-blue-600 hover:text-blue-800"
                        title="Carregar modelo para edição"
                      >
                        <Upload size={18}/>
                      </button>
                      <button
                        onClick={async()=>{ if(!window.confirm(`Excluir modelo "${m.nome}"?`))return;
                          try{ await deleteDoc(doc(db,'modelosCracha',m.id));
                            setModelosSalvos(prev=>prev.filter(x=>x.id!==m.id));
                            if(modeloId===m.id){ setModeloId(null); setNomeModelo('Novo Modelo de Crachá'); setComponentes([]); }
                            setMensagem({tipo:'success',texto:'Modelo excluído com sucesso.'});
                          }catch(err){console.error(err);setMensagem({tipo:'error',texto:'Erro ao excluir modelo.'});}}}
                        className="text-red-600 hover:text-red-800"
                        title="Excluir modelo"
                      >
                        <Trash2 size={18}/>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Observação: cada <strong>evento</strong> pode ter <strong>apenas um</strong> modelo marcado como <em>padrão</em>. Ao definir um novo padrão para um evento, o anterior é desmarcado automaticamente. O padrão do evento é carregado automaticamente no editor.
        </p>
      </div>
    </LayoutDefault>
  );
};

export default EditorCrachas;
