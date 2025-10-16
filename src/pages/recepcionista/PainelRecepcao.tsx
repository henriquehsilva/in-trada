import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QrCode, Search, UserPlus, CheckCircle, Printer, Edit } from 'lucide-react';
import LayoutDefault from '../../components/layout/LayoutDefault';
import QrCodeScanner from '../../components/qrcode/QrCodeScanner';
import { obterEventoPorId } from '../../services/eventoService';
import {
  obterParticipantesPorEvento,
  buscarParticipantes,
  fazerCheckin,
  criarParticipante,
} from '../../services/participanteService';
import { useAuth } from '../../contexts/AuthContext';
import { Evento, Participante } from '../../models/types';
import { Dialog } from '@headlessui/react';
import qz from 'qz-tray';
import { obterModelosCrachaPorEvento } from '../../services/modeloService';
import { ModeloCracha } from '../../models/types';
import QRCode from 'qrcode';
import DonutChart from '../../components/DonutChart';
import { ChromePicker } from 'react-color';
import { doc, updateDoc, getDoc, collection, query as fsQuery, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import JsBarcode from 'jsbarcode';

/* ===================== Helpers & Types ===================== */

type Usuario = {
  role?: string;
  [k: string]: any;
};

const normalizeCategory = (s: string) => (s || '').trim().toUpperCase();

/** Gera uma cor estável a partir do nome da categoria (pastel) */
const stableColorFromString = (str: string) => {
  if (!str) return '#cccccc';
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 75%)`;
};

/* ====== Impressão: suporte a fontes customizadas carregadas no Editor ====== */

const LS_KEY_FONTS = 'editorCrachas.customFonts'; // { [family]: dataURL }
const STD_FONTS = new Set([
  'Arial','Verdana','Times New Roman','Courier New','Georgia','Tahoma','Trebuchet MS',
  'sans-serif','serif','monospace'
]);

function getUsedFontFamilies(componentes: any[]): string[] {
  const set = new Set<string>();
  for (const c of componentes) {
    const fam = c?.propriedades?.estilos?.fonte;
    if (fam && typeof fam === 'string') set.add(fam);
  }
  return Array.from(set);
}

/** ⬇️ NOVA: gera @font-face (400 e 700) a partir do localStorage (dataURL) */
function buildFontFaceCSS(usedFamilies: string[]): string {
  const saved = JSON.parse(localStorage.getItem(LS_KEY_FONTS) || '{}') as Record<string,string>;
  const faces: string[] = [];
  for (const fam of usedFamilies) {
    if (STD_FONTS.has(fam)) continue;
    const dataUrl = saved[fam];
    if (!dataUrl) continue;
    const fmt = dataUrl.includes('font/otf') || /\.otf/i.test(dataUrl) ? 'opentype' : 'truetype';
    faces.push(`
@font-face{
  font-family:'${fam}';
  src:url('${dataUrl}') format('${fmt}');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face{
  font-family:'${fam}';
  src:url('${dataUrl}') format('${fmt}');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}`);
  }
  return faces.join('\n');
}

/* ===================== Componente ===================== */

const PainelRecepcao: React.FC = () => {
  const navigate = useNavigate();
  const { eventoId } = useParams<{ eventoId: string }>();
  const { currentUser } = useAuth();

  const [evento, setEvento] = useState<Evento | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [participanteSelecionado, setParticipanteSelecionado] = useState<Participante | null>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [termoBusca, setTermoBusca] = useState('');
  const [showFormNovoParticipante, setShowFormNovoParticipante] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error' | 'info'; texto: string } | null>(null);
  const [confirmarImpressao, setConfirmarImpressao] = useState(false);

  // ====== Refs novo participante ======
  const nomeRef = useRef<HTMLInputElement>(null);
  const nomeCrachaRef = useRef<HTMLInputElement>(null);
  const empresaRef = useRef<HTMLInputElement>(null);
  const cargoRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const telefoneRef = useRef<HTMLInputElement>(null);
  const categoriaSelectRef = useRef<HTMLSelectElement>(null);

  const [categoriaCor, setCategoriaCor] = useState<string>('');
  const [editandoCorId, setEditandoCorId] = useState<string | null>(null);
  const [coresEdicao, setCoresEdicao] = useState<Record<string, string>>({});

  const [usuario, setUsuario] = useState<Usuario | null>(null);

  // Campos personalizados do formulário
  const [camposPersonalizadosValues, setCamposPersonalizadosValues] = useState<Record<string, any>>({});

  // ====== Carrega usuário ======
  useEffect(() => {
    const carregarUsuario = async () => {
      if (!currentUser?.uid) return;
      const docRef = doc(db, 'usuarios', currentUser.uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) setUsuario(snap.data() as Usuario);
    };
    carregarUsuario();
  }, [currentUser]);

  const isOperador = usuario?.role === 'operador';

  const obterModeloPadrao = async (eventoId: string): Promise<ModeloCracha | null> => {
    const modelos = await obterModelosCrachaPorEvento(eventoId);
    return modelos.find((m) => m.padrao) || null;
  };

  // ====== Carrega evento + participantes ======
  useEffect(() => {
    const carregarDados = async () => {
      if (!eventoId) return;
      try {
        const eventoDados = await obterEventoPorId(eventoId);
        if (eventoDados) {
          setEvento(eventoDados);
          const participantesDados = await obterParticipantesPorEvento(eventoId);
          setParticipantes(
            participantesDados.map((p) => ({
              ...p,
              categoria: normalizeCategory(p.categoria),
            })),
          );
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        setMensagem({ tipo: 'error', texto: 'Erro ao carregar dados. Tente novamente mais tarde.' });
      } finally {
        setLoading(false);
      }
    };
    carregarDados();
  }, [eventoId]);

  // ====== Agregações e memos ======
  const statusCounts = participantes.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(statusCounts).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count,
  }));

  // Mapa Categoria -> Cor
  const categoriaColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of participantes) {
      const cat = normalizeCategory(p.categoria);
      if (cat && p.corCategoria && !map[cat]) {
        map[cat] = p.corCategoria;
      }
    }
    return map;
  }, [participantes]);

  // Lista de categorias únicas do evento
  const categoriasEvento = useMemo(() => {
    const setCats = new Set<string>();
    for (const p of participantes) {
      const cat = normalizeCategory(p.categoria);
      if (cat) setCats.add(cat);
    }
    return Array.from(setCats).sort((a, b) => a.localeCompare(b));
  }, [participantes]);

  // ===================== Ações =====================

  const handleSearch = async () => {
    if (!eventoId || !termoBusca.trim()) return;
    try {
      setLoading(true);
      const resultados = await buscarParticipantes(eventoId, termoBusca);
      setParticipantes(resultados.map((p) => ({ ...p, categoria: normalizeCategory(p.categoria) })));
      setMensagem(resultados.length === 0 ? { tipo: 'info', texto: 'Nenhum participante encontrado. Deseja cadastrar um novo?' } : null);
    } catch (err) {
      console.error('Erro ao buscar participantes:', err);
      setMensagem({ tipo: 'error', texto: 'Erro ao buscar participantes. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  // Busca EXCLUSIVAMENTE por eventoId + codigoCliente (sem JSON, sem fallback por id)
  const handleQrCodeScan = async (data: string) => {
    try {
      const codigoCliente = String(data ?? '').trim();
      if (!codigoCliente) {
        setMensagem({ tipo: 'error', texto: 'QR Code vazio.' });
        return;
      }

      let participante: Participante | null =
        participantes.find(
          (p) =>
            p.eventoId === eventoId &&
            String(p.codigoCliente ?? '').trim() === codigoCliente
        ) || null;

      if (!participante && eventoId) {
        const ref = collection(db, 'participantes');

        // tenta como string
        let q = fsQuery(
          ref,
          where('eventoId', '==', eventoId),
          where('codigoCliente', '==', codigoCliente)
        );
        let qs = await getDocs(q);

        // se vier gravado como number no Firestore, tenta também number
        if (qs.empty && /^\d+$/.test(codigoCliente)) {
          q = fsQuery(
            ref,
            where('eventoId', '==', eventoId),
            where('codigoCliente', '==', Number(codigoCliente))
          );
          qs = await getDocs(q);
        }

        if (!qs.empty) {
          const d = qs.docs[0];
          participante = { id: d.id, ...(d.data() as any) } as Participante;
        }
      }

      if (participante) {
        const normalizado = {
          ...participante,
          categoria: normalizeCategory(participante.categoria),
        } as Participante;

        setParticipanteSelecionado(normalizado);
        setShowQrScanner(false);
        setMensagem(
          normalizado.status === 'credenciado'
            ? { tipo: 'info', texto: 'Participante já realizou check-in anteriormente.' }
            : { tipo: 'success', texto: 'Participante encontrado! Realize o check-in.' }
        );
      } else {
        setMensagem({
          tipo: 'error',
          texto: `Nenhum participante com codigoCliente "${codigoCliente}" neste evento.`,
        });
      }
    } catch (err) {
      console.error('Erro ao processar QR Code:', err);
      setMensagem({ tipo: 'error', texto: 'Erro ao processar QR Code. Tente novamente.' });
    }
  };

  const handleSelectParticipante = (participante: Participante) => {
    setParticipanteSelecionado({ ...participante, categoria: normalizeCategory(participante.categoria) });
    setMensagem((participante as any).observacao?.trim() ? { tipo: 'info', texto: `Observação: ${(participante as any).observacao}` } : null);
  };

  const handleCheckin = async () => {
    if (!participanteSelecionado) return;
    try {
      setLoading(true);
      await fazerCheckin(participanteSelecionado.id);
      const participanteAtualizado = { ...participanteSelecionado, status: 'credenciado' as const };
      setParticipanteSelecionado(participanteAtualizado);
      setParticipantes((prev) => prev.map((p) => (p.id === participanteAtualizado.id ? participanteAtualizado : p)));
      setMensagem({ tipo: 'success', texto: 'Check-in realizado com sucesso!' });
      setTimeout(() => setMensagem(null), 3000);
    } catch (err) {
      console.error('Erro ao fazer check-in:', err);
      setMensagem({ tipo: 'error', texto: 'Erro ao fazer check-in. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckinComConfirmacao = () => setConfirmarImpressao(true);

  const confirmarCheckin = async (imprimir: boolean) => {
    setConfirmarImpressao(false);
    await handleCheckin();
    if (imprimir) handlePrintCredencial();
  };

  const atualizarParticipante = async (id: string, dados: Partial<Participante>) => {
    const ref = doc(db, 'participantes', id);
    const updatePayload: any = { ...dados, atualizadoEm: new Date().toISOString() };
    if (!('corCategoria' in dados)) updatePayload.corCategoria = '#cccccc';
    await updateDoc(ref, updatePayload);
  };

  /* ===================== IMPRESSÃO (mantém fontes e usa codigoCliente) ===================== */
  const handlePrintCredencial = async () => {
    if (!participanteSelecionado || !evento) return;
    try {
      const modelos = await obterModelosCrachaPorEvento(evento.id);
      const modeloPadrao = modelos.find((m) => m.padrao);
      if (!modeloPadrao) {
        setMensagem({ tipo: 'error', texto: 'Nenhum modelo de crachá padrão definido para este evento.' });
        return;
      }

      // usa codigoCliente (fallback id) no QR e barcode
      const qrValue = (participanteSelecionado as any)?.codigoCliente || participanteSelecionado.id;
      const qrCodeDataUrl = await QRCode.toDataURL(String(qrValue));

      const cmToZplPx = (cm: number) => Math.round((cm / 2.54) * 203);
      const largura = cmToZplPx(modeloPadrao.larguraCm || 8);
      const altura  = cmToZplPx(modeloPadrao.alturaCm || 3);

      const usedFamilies = getUsedFontFamilies(modeloPadrao.componentes);
      const fontFaceCSS  = buildFontFaceCSS(usedFamilies);

      const htmlComponente = modeloPadrao.componentes
        .map((comp) => {
          const props: any = comp.propriedades || {};
          const estilos: any = props.estilos || {};
          const valor = props.campoVinculado
            ? (participanteSelecionado as any)[props.campoVinculado] ?? ''
            : (props.texto ?? '');

          // ⬇️ estilo base com fonte custom, weight coerente, line-height e pre-wrap
          const baseStyle = `
            position:absolute; top:${props.y}px; left:${props.x}px;
            width:${props.largura}px; height:${props.altura}px;
            display:flex; align-items:center; justify-content:center; overflow:hidden;
            ${estilos?.tamanhoFonte ? `font-size:${estilos.tamanhoFonte}px;` : ''}
            ${estilos?.negrito ? 'font-weight:700;' : 'font-weight:400;'}
            ${estilos?.alinhamento ? `text-align:${estilos.alinhamento};` : ''}
            ${estilos?.corFonte ? `color:${estilos.corFonte};` : ''}
            ${estilos?.corFundo ? `background-color:${estilos.corFundo};` : ''}
            ${estilos?.raio ? `border-radius:${estilos.raio}px;` : ''}
            line-height:1.1; white-space:pre-wrap;
            ${estilos?.fonte ? `font-family:'${String(estilos.fonte)}', ${STD_FONTS.has(estilos.fonte) ? estilos.fonte : 'sans-serif'};` : ''}
          `;

          if (comp.tipo === 'qrcode') {
            return `
              <div style="${baseStyle}">
                <img src="${qrCodeDataUrl}" width="${props.largura}" height="${props.altura}" />
              </div>
            `;
          }

          if (comp.tipo === 'barcode') {
            const idSvg = `barcode-${comp.id}`;
            return `
              <div style="${baseStyle}">
                <svg id="${idSvg}"
                    jsbarcode-value="${String(qrValue)}"
                    jsbarcode-format="CODE128"
                    jsbarcode-width="2"
                    jsbarcode-height="${props.altura || 40}"
                    jsbarcode-displayvalue="false">
                </svg>
              </div>
            `;
          }

          // texto/campo
          return `<div style="${baseStyle}">${valor}</div>`;
        })
        .join('');

      const html = `
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Imprimir Crachá</title>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
            <style>
              @page { size: ${largura}px ${altura}px; margin: 0; }
              html, body { margin: 0; padding: 0; }
              * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } /* força cores em print */
              ${fontFaceCSS}
            </style>
          </head>
          <body>
            <div id="root" style="position:relative; width:${largura}px; height:${altura}px;">
              ${htmlComponente}
            </div>
            <script>
              (async function(){
                try {
                  if (document.fonts && document.fonts.ready) { await document.fonts.ready; }
                  await new Promise(r => setTimeout(r, 150));
                  if (typeof JsBarcode !== 'undefined') {
                    JsBarcode("svg[id^='barcode-']").init();
                  }
                  await new Promise(r => setTimeout(r, 80));
                  window.print();
                  setTimeout(() => window.close(), 350);
                } catch(e) {
                  console.error('print error', e);
                  window.print();
                  setTimeout(() => window.close(), 500);
                }
              })();
            </script>
          </body>
        </html>
      `;

      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) return;
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();

      setMensagem({ tipo: 'success', texto: 'Credencial enviada para impressão!' });
    } catch (err) {
      console.error('Erro ao imprimir:', err);
      setMensagem({ tipo: 'error', texto: 'Erro ao imprimir credencial.' });
    }
  };

  const handleCadastrarParticipante = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventoId || !currentUser?.uid) return;
    try {
      setLoading(true);
      const catRaw = categoriaSelectRef.current?.value || '';
      const categoriaUpper = normalizeCategory(catRaw);
      const corExistente = participantes.find(
        (p) => p.eventoId === eventoId && normalizeCategory(p.categoria) === categoriaUpper && p.corCategoria,
      )?.corCategoria;
      const corParaCategoria = corExistente || categoriaCor || stableColorFromString(categoriaUpper);

      const novoParticipante: Omit<Participante, 'id' | 'criadoEm' | 'atualizadoEm'> = {
        eventoId,
        nome: nomeRef.current?.value || '',
        empresa: empresaRef.current?.value || '',
        email1: emailRef.current?.value || '',
        email2: emailRef.current?.value || '',
        celular: telefoneRef.current?.value || '',
        nomeCracha: nomeCrachaRef.current?.value || '',
        empresaCracha: empresaRef.current?.value || '',
        cargo: cargoRef.current?.value || '',
        observacao: '',
        cpf: '',
        rg: '',
        cnpj: '',
        codigoCliente: '',
        opcao1: '',
        opcao2: '',
        opcao3: '',
        opcao4: '',
        opcao5: '',
        opcao6: '',
        opcao7: '',
        opcao8: '',
        opcao9: '',
        opcao10: '',
        telefone: telefoneRef.current?.value || '',
        categoria: categoriaUpper,
        status: 'pendente',
        criadoPorId: currentUser.uid,
        camposPersonalizados: camposPersonalizadosValues,
        corCategoria: corParaCategoria,
      } as any;

      const participanteId = await criarParticipante(novoParticipante);
      const participanteCriado: Participante = {
        ...novoParticipante,
        id: participanteId,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      } as any;

      setParticipantes((prev) => [participanteCriado, ...prev]);
      setParticipanteSelecionado(participanteCriado);
      setShowFormNovoParticipante(false);
      setMensagem({ tipo: 'success', texto: 'Participante cadastrado com sucesso! Realize o check-in.' });
      setCamposPersonalizadosValues({});
    } catch (err) {
      console.error('Erro ao cadastrar participante:', err);
      setMensagem({ tipo: 'error', texto: 'Erro ao cadastrar participante. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCampoPersonalizadoChange = (id: string, valor: any) => {
    setCamposPersonalizadosValues((prev) => ({ ...prev, [id]: valor }));
  };

  /* ===================== UI ===================== */

  if (loading && !evento) {
    return (
      <LayoutDefault title="Carregando...">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </LayoutDefault>
    );
  }

  if (!evento) {
    return (
      <LayoutDefault title="Evento não encontrado">
        <div className="bg-error-light text-error p-4 rounded-md">Evento não encontrado ou você não tem permissão para acessá-lo.</div>
      </LayoutDefault>
    );
  }

  return (
    <LayoutDefault title={`Recepção: ${evento.nome}`} backUrl="/recepcionista">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1: Busca e Lista */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-semibold mb-3">Buscar Participante</h3>

            <div className="flex mb-3">
              <input
                type="text"
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Nome, email ou empresa"
                className="input-field flex-grow mr-2"
              />
              <button onClick={handleSearch} className="btn btn-primary flex items-center justify-center">
                <Search className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setShowQrScanner(!showQrScanner)} className="btn btn-outline flex items-center justify-center">
                <QrCode className="w-5 h-5 mr-2" />
                {showQrScanner ? 'Fechar Scanner' : 'Ler QR Code'}
              </button>

              <button onClick={() => setShowFormNovoParticipante(!showFormNovoParticipante)} className="btn btn-outline flex items-center justify-center">
                <UserPlus className="w-5 h-5 mr-2" />
                {showFormNovoParticipante ? 'Cancelar' : 'Novo'}
              </button>
            </div>
          </div>

          {showQrScanner && (
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="font-semibold mb-3">Scanner QR Code</h3>
              <QrCodeScanner onScan={handleQrCodeScan} />
            </div>
          )}

          {mensagem && (
            <div
              className={`p-3 rounded-md ${
                mensagem.tipo === 'success'
                  ? 'bg-success-light text-success'
                  : mensagem.tipo === 'error'
                  ? 'bg-error-light text-error'
                  : 'bg-warning-light text-warning'
              }`}
            >
              {mensagem.texto}
            </div>
          )}

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-semibold mb-3">Participantes</h3>

            {participantes.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhum participante encontrado.</p>
            ) : (
              <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                {participantes.map((participante) => (
                  <div
                    key={participante.id}
                    className={`py-3 cursor-pointer hover:bg-gray-50 ${participanteSelecionado?.id === participante.id ? 'bg-gray-50' : ''}`}
                    onClick={() => handleSelectParticipante(participante)}
                  >
                    <div>
                      <label className="text-sm text-gray-500 block mb-1">{normalizeCategory(participante.categoria)}</label>
                      {isOperador && (
                        <div className="flex items-center gap-3">
                          <div
                            className="w-6 h-6 rounded-full border cursor-pointer"
                            style={{ backgroundColor: participante.corCategoria || '#ccc' }}
                            onClick={() => setEditandoCorId(participante.id)}
                            title="Clique para editar a cor"
                          />
                          {editandoCorId === participante.id && (
                            <div className="z-50 relative">
                              <ChromePicker
                                color={coresEdicao[participante.id] || participante.corCategoria || '#cccccc'}
                                onChangeComplete={(color) => {
                                  setCoresEdicao((prev) => ({ ...prev, [participante.id]: color.hex }));
                                }}
                              />

                              <button
                                className="mt-2 btn btn-primary"
                                onClick={async () => {
                                  setEditandoCorId(null);
                                  const novaCor = coresEdicao[participante.id] || participante.corCategoria || '#cccccc';
                                  const categoriaAlvo = normalizeCategory(participante.categoria);
                                  const eventoAlvo = participante.eventoId;

                                  const participantesMesmoGrupo = participantes.filter(
                                    (p) => normalizeCategory(p.categoria) === categoriaAlvo && p.eventoId === eventoAlvo,
                                  );

                                  await Promise.all(
                                    participantesMesmoGrupo.map((p) => atualizarParticipante(p.id, { corCategoria: novaCor })),
                                  );

                                  setParticipantes((prev) =>
                                    prev.map((p) =>
                                      normalizeCategory(p.categoria) === categoriaAlvo && p.eventoId === eventoAlvo
                                        ? { ...p, corCategoria: novaCor, categoria: normalizeCategory(p.categoria) }
                                        : { ...p, categoria: normalizeCategory(p.categoria) },
                                    ),
                                  );

                                  setMensagem({ tipo: 'success', texto: 'Cor atualizada para todos os participantes da mesma categoria!' });
                                }}
                              >
                                Salvar cor
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{participante.nome}</h4>
                        <p className="text-sm text-gray-600">{participante.empresa}</p>
                        <p className="text-xs text-gray-500">{participante.email1}</p>
                      </div>
                      <div>
                        <span
                          className={`inline-block px-2 py-1 text-xs rounded-full ${
                            participante.status === 'credenciado'
                              ? 'bg-success-light text-success'
                              : participante.status === 'confirmado'
                              ? 'bg-primary-100 text-primary'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {participante.status === 'credenciado'
                            ? 'Credenciado'
                            : participante.status === 'confirmado'
                            ? 'Confirmado'
                            : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Coluna 2: Formulário de Novo Participante ou Detalhes */}
        <div className="lg:col-span-2">
          {showFormNovoParticipante ? (
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="font-semibold mb-4">Cadastrar Novo Participante</h3>

              <form onSubmit={handleCadastrarParticipante}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
                    <input type="text" ref={nomeRef} required className="input-field" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome Crachá</label>
                    <input type="text" ref={nomeCrachaRef} className="input-field" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
                    <input type="text" ref={empresaRef} className="input-field" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                    <input type="text" ref={cargoRef} className="input-field" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input type="email" ref={emailRef} required className="input-field" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                    <input type="tel" ref={telefoneRef} className="input-field" />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoria * (selecionar existente — MAIÚSCULO)</label>
                    <select
                      ref={categoriaSelectRef}
                      required
                      className="input-field uppercase"
                      onChange={(e) => {
                        const upper = normalizeCategory(e.target.value);
                        const corExistente = categoriaColorMap[upper];
                        setCategoriaCor(corExistente || stableColorFromString(upper));
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Selecione uma categoria</option>
                      {categoriasEvento.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      A categoria será salva em MAIÚSCULO. Se já houver cor definida para a mesma categoria neste evento, ela será reutilizada automaticamente.
                    </p>
                  </div>
                </div>

                {/* Campos personalizados do evento */}
                {evento.camposPersonalizados && evento.camposPersonalizados.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">Informações adicionais</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {evento.camposPersonalizados.map((campo) => (
                        <div key={campo.id}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {campo.nome} {campo.obrigatorio ? '*' : ''}
                          </label>

                          {campo.tipo === 'texto' && (
                            <input
                              type="text"
                              value={camposPersonalizadosValues[campo.id] || ''}
                              onChange={(e) => handleCampoPersonalizadoChange(campo.id, e.target.value)}
                              required={campo.obrigatorio}
                              className="input-field"
                            />
                          )}

                          {campo.tipo === 'numero' && (
                            <input
                              type="number"
                              value={camposPersonalizadosValues[campo.id] || ''}
                              onChange={(e) => handleCampoPersonalizadoChange(campo.id, e.target.value)}
                              required={campo.obrigatorio}
                              className="input-field"
                            />
                          )}

                          {campo.tipo === 'data' && (
                            <input
                              type="date"
                              value={camposPersonalizadosValues[campo.id] || ''}
                              onChange={(e) => handleCampoPersonalizadoChange(campo.id, e.target.value)}
                              required={campo.obrigatorio}
                              className="input-field"
                            />
                          )}

                          {campo.tipo === 'selecao' && campo.opcoes && (
                            <select
                              value={camposPersonalizadosValues[campo.id] || ''}
                              onChange={(e) => handleCampoPersonalizadoChange(campo.id, e.target.value)}
                              required={campo.obrigatorio}
                              className="input-field"
                            >
                              <option value="">Selecione uma opção</option>
                              {campo.opcoes.map((opcao, index) => (
                                <option key={index} value={opcao}>{opcao}</option>
                              ))}
                            </select>
                          )}

                          {campo.tipo === 'checkbox' && (
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id={`campo-${campo.id}`}
                                checked={camposPersonalizadosValues[campo.id] || false}
                                onChange={(e) => handleCampoPersonalizadoChange(campo.id, e.target.checked)}
                                required={campo.obrigatorio}
                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                              />
                              <label htmlFor={`campo-${campo.id}`} className="ml-2 block text-sm text-gray-900">
                                Sim
                              </label>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button type="button" onClick={() => setShowFormNovoParticipante(false)} className="btn btn-outline mr-2">
                    Cancelar
                  </button>
                  <button type="submit" disabled={loading} className="btn btn-primary">
                    {loading ? 'Salvando...' : 'Cadastrar e Credenciar'}
                  </button>
                </div>
              </form>
            </div>
          ) : participanteSelecionado ? (
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold">Detalhes do Participante</h3>
                <span
                  className={`inline-block px-2 py-1 text-xs rounded-full ${
                    participanteSelecionado.status === 'credenciado'
                      ? 'bg-success-light text-success'
                      : participanteSelecionado.status === 'confirmado'
                      ? 'bg-primary-100 text-primary'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {participanteSelecionado.status === 'credenciado'
                    ? 'Credenciado'
                    : participanteSelecionado.status === 'confirmado'
                    ? 'Confirmado'
                    : 'Pendente'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">Nome</p>
                  <p className="font-medium">{participanteSelecionado.nome}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Empresa</p>
                  <p className="font-medium">{participanteSelecionado.empresa || '-'}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{participanteSelecionado.email1}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Telefone</p>
                  <p className="font-medium">{participanteSelecionado.telefone || '-'}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Categoria</p>
                  <p className="font-medium flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full border" style={{ backgroundColor: participanteSelecionado.corCategoria || '#ccc' }} />
                    {normalizeCategory(participanteSelecionado.categoria)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">ID</p>
                  <p className="font-medium">{participanteSelecionado.id}</p>
                </div>
              </div>

              {/* Informações personalizadas */}
              {participanteSelecionado.camposPersonalizados &&
                Object.keys(participanteSelecionado.camposPersonalizados).length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-medium mb-2">Informações adicionais</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(participanteSelecionado.camposPersonalizados).map(([key, value]) => {
                        const campo = evento.camposPersonalizados?.find((c) => c.id === key);
                        return (
                          <div key={key}>
                            <p className="text-sm text-gray-500">{campo?.nome || key}</p>
                            <p className="font-medium">{typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : (value as any) || '-'}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    navigate(`/operador/participantes/${eventoId}/${participanteSelecionado.id}/editar`, {
                      state: { from: 'painel-recepcao' },
                    })
                  }
                  className="btn btn-outline flex items-center"
                  title="Editar participante"
                >
                  <Edit className="w-5 h-5 mr-2" /> Editar Participante
                </button>

                {participanteSelecionado.status !== 'credenciado' && (
                  <button onClick={handleCheckinComConfirmacao} disabled={loading} className="btn btn-primary flex items-center">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    {loading ? 'Processando...' : 'Fazer Check-in'}
                  </button>
                )}

                <button onClick={handlePrintCredencial} className="btn btn-outline flex items-center">
                  <Printer className="w-5 h-5 mr-2" />
                  Imprimir Credencial
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="text-center py-12">
                <QrCode className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="font-semibold text-lg mb-2">Nenhum participante selecionado</h3>
                <p className="text-gray-500 mb-4">Selecione um participante da lista ou use as opções abaixo:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button onClick={() => setShowQrScanner(true)} className="btn btn-outline flex items-center">
                    <QrCode className="w-5 h-5 mr-2" />
                    Ler QR Code
                  </button>

                  <button onClick={() => setShowFormNovoParticipante(true)} className="btn btn-primary flex items-center">
                    <UserPlus className="w-5 h-5 mr-2" />
                    Cadastrar Novo
                  </button>
                </div>
              </div>
            </div>
          )}

          {confirmarImpressao && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
              <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
                <h2 className="text-lg font-semibold mb-4">Deseja imprimir a credencial?</h2>
                <div className="flex justify-end gap-4">
                  <button onClick={() => confirmarCheckin(false)} className="btn btn-outline">
                    Não
                  </button>
                  <button onClick={() => confirmarCheckin(true)} className="btn btn-primary">
                    Sim
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </LayoutDefault>
  );
};

export default PainelRecepcao;
