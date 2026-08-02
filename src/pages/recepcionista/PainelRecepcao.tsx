import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QrCode, Search, UserPlus, CheckCircle, Printer, Edit, Settings, Pencil, Save, X, Loader2, Wifi, WifiOff, Tag } from 'lucide-react';
import LayoutDefault from '../../components/layout/LayoutDefault';
import QrCodeScanner from '../../components/qrcode/QrCodeScanner';
import { obterEventoPorId, atualizarEvento } from '../../services/eventoService';
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
import { buildQrValue } from '../../utils/qrcode';
import DonutChart from '../../components/DonutChart';
import { ChromePicker } from 'react-color';
import { doc, updateDoc, getDoc, collection, query as fsQuery, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import JsBarcode from 'jsbarcode';

/* ===================== QZ Tray: modo não assinado =====================
   Sem certificado/assinatura configurados, o QZ Tray rejeita a conexão
   e a impressão falha silenciosamente. Este é o setup oficial de "modo
   não assinado" (sem backend de assinatura): o usuário verá um aviso de
   "conexão não confiável" no QZ Tray na primeira vez e pode marcar
   "Remember this decision" para não ver novamente nesta máquina. */
qz.security.setCertificatePromise((resolve) => resolve());
qz.security.setSignaturePromise(() => (resolve) => resolve());

/* ===================== Helpers & Types ===================== */

const LABEL_CAMPO: Record<string, string> = {
  nome: 'Nome', empresa: 'Empresa', nomeCracha: 'Nome no crachá',
  empresaCracha: 'Empresa no crachá', cargo: 'Cargo',
  email1: 'E-mail', email2: 'E-mail 2', celular: 'Celular',
  telefone: 'Telefone', categoria: 'Categoria',
  cpf: 'CPF', rg: 'RG', cnpj: 'CNPJ', codigoCliente: 'Código cliente',
  opcao1: 'Opção 1', opcao2: 'Opção 2', opcao3: 'Opção 3', opcao4: 'Opção 4',
  opcao5: 'Opção 5', opcao6: 'Opção 6', opcao7: 'Opção 7', opcao8: 'Opção 8',
  opcao9: 'Opção 9', opcao10: 'Opção 10', observacao: 'Observação',
};

const CAMPOS_PADRAO_LISTA = [
  'nome','empresa','nomeCracha','empresaCracha','cargo',
  'email1','email2','celular','telefone','categoria',
  'cpf','rg','cnpj','codigoCliente',
  'opcao1','opcao2','opcao3','opcao4','opcao5',
  'opcao6','opcao7','opcao8','opcao9','opcao10','observacao',
];

const CAMPOS_VISIVEIS_DEFAULT = ['nome', 'empresa', 'email1', 'telefone', 'categoria'];

const OPCOES_KEYS = [
  'opcao1', 'opcao2', 'opcao3', 'opcao4', 'opcao5',
  'opcao6', 'opcao7', 'opcao8', 'opcao9', 'opcao10',
];

// Campos já cobertos por inputs fixos no formulário "Cadastrar Novo Participante"
// (email2, celular e empresaCracha NÃO têm input próprio nesse formulário — por padrão
// espelham email1/telefone/empresa — por isso ficam de fora deste set e podem virar
// campos extras editáveis quando marcados em "Campos visíveis")
const CAMPOS_FIXOS_FORM_NOVO = new Set([
  'nome', 'nomeCracha', 'empresa', 'cargo', 'email1', 'telefone', 'categoria',
]);

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

  // Valores dos campos extras (cpf, rg, cnpj, codigoCliente, opcao1..10, observacao)
  // exibidos no formulário de novo participante conforme "Campos visíveis"
  const [camposExtrasValues, setCamposExtrasValues] = useState<Record<string, string>>({});

  // 🔹 NOVO: categorias do evento (buscadas do banco, independentes do state de participantes)
  const [categoriasEvento, setCategoriasEvento] = useState<string[]>([]);

  // Campos visíveis configuráveis (persistidos por evento)
  const [camposVisiveis, setCamposVisiveis] = useState<string[]>(() => {
    if (!eventoId) return CAMPOS_VISIVEIS_DEFAULT;
    try {
      const saved = localStorage.getItem(`painel.campos.${eventoId}`);
      return saved ? JSON.parse(saved) : CAMPOS_VISIVEIS_DEFAULT;
    } catch { return CAMPOS_VISIVEIS_DEFAULT; }
  });
  const [showConfigurarCampos, setShowConfigurarCampos] = useState(false);

  // Edição dos nomes dos campos "Opção 1..10" (persistidos por evento)
  const [showEditarNomesCampos, setShowEditarNomesCampos] = useState(false);
  const [nomesOpcoesEdicao, setNomesOpcoesEdicao] = useState<Record<string, string>>({});
  const [salvandoNomesOpcoes, setSalvandoNomesOpcoes] = useState(false);

  // Renomeação inline de "Opção N" ao marcar no modal "Campos visíveis"
  const [nomesOpcoesInline, setNomesOpcoesInline] = useState<Record<string, string>>({});

  // Edição inline
  const [editandoInline, setEditandoInline] = useState(false);
  const [editValuesInline, setEditValuesInline] = useState<Record<string, any>>({});
  const [salvandoInline, setSalvandoInline] = useState(false);

  // QZ Tray (impressão direta)
  const [qzConectado, setQzConectado] = useState(false);
  const [impressoraPadrao, setImpressoraPadrao] = useState<string>(
    () => localStorage.getItem('impressora.padrao') || ''
  );
  const [impressorasDisponiveis, setImpressorasDisponiveis] = useState<string[]>([]);
  const [showSelecionarImpressora, setShowSelecionarImpressora] = useState(false);
  const [reconectandoQz, setReconectandoQz] = useState(false);

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

  // 🔹 NOVO: buscar TODAS as categorias do evento direto do Firestore (independente do state)
  useEffect(() => {
    if (!eventoId) return;
    (async () => {
      try {
        const ref = collection(db, 'participantes');
        const q = fsQuery(ref, where('eventoId', '==', eventoId));
        const qs = await getDocs(q);
        const setCats = new Set<string>();
        qs.forEach((d) => {
          const cat = normalizeCategory((d.data() as any)?.categoria || '');
          if (cat) setCats.add(cat);
        });
        setCategoriasEvento(Array.from(setCats).sort((a, b) => a.localeCompare(b)));
      } catch (e) {
        console.error('Erro ao carregar categorias do evento:', e);
      }
    })();
  }, [eventoId]);

  // ====== QZ Tray: tenta conectar ao iniciar ======
  const conectarQz = async () => {
    try {
      if (!qz.websocket.isActive()) {
        /* O QZ Tray espera o usuário responder ao aviso "Action Required" antes
           de confirmar a conexão. Se o aviso for ignorado/fechado sem resposta,
           a promise do qz-tray nunca resolve nem rejeita e o app fica preso
           "conectando" pra sempre, sem nenhum erro no console. Por isso força
           um timeout aqui e limpa a conexão travada para permitir nova tentativa. */
        await Promise.race([
          qz.websocket.connect({ retries: 3, delay: 1 }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Tempo esgotado aguardando autorização no QZ Tray')), 15000)
          ),
        ]);
      }
      setQzConectado(true);
    } catch (err) {
      console.error('Erro ao conectar ao QZ Tray:', err);
      setQzConectado(false);
      setMensagem({
        tipo: 'error',
        texto: 'Não foi possível conectar ao QZ Tray. Verifique se o aplicativo está aberto e autorize a conexão no aviso "Action Required" (marque "Remember this decision").',
      });
      try {
        if (qz.websocket.isActive()) await qz.websocket.disconnect();
      } catch {}
      return;
    }

    try {
      const result = await qz.printers.find('') as string | string[];
      const lista = Array.isArray(result) ? result : result ? [result] : [];
      setImpressorasDisponiveis(lista);
    } catch (err) {
      console.error('QZ Tray conectado, mas falhou ao listar impressoras:', err);
    }
  };

  useEffect(() => {
    conectarQz();
    return () => { try { if (qz.websocket.isActive()) qz.websocket.disconnect(); } catch {} };
  }, []);

  // ====== Agregações e memos ======
  const statusCounts = participantes.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(statusCounts).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count,
  }));

  // Mapa Categoria -> Cor (aqui pode continuar derivando da lista carregada)
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

      // usa codigoCliente (fallback id) no barcode
      const barcodeValue = (participanteSelecionado as any)?.codigoCliente || participanteSelecionado.id;

      // pré-gera QR por componente respeitando camposQrCode configurados
      const qrCache: Record<string, string> = {};
      for (const comp of modeloPadrao.componentes) {
        if (comp.tipo === 'qrcode') {
          const p: any = comp.propriedades || {};
          const qrValor = buildQrValue(
            participanteSelecionado as any,
            p.camposQrCode,
            p.separadorQrCode
          ) || String(barcodeValue);
          qrCache[comp.id] = await QRCode.toDataURL(qrValor);
        }
      }

      const larguraCm = modeloPadrao.larguraCm || 8;
      const alturaCm  = modeloPadrao.alturaCm  || 3;
      const cmToZplPx = (cm: number) => Math.round((cm / 2.54) * 203);
      const largura = cmToZplPx(larguraCm);
      const altura  = cmToZplPx(alturaCm);

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
                <img src="${qrCache[comp.id]}" width="${props.largura}" height="${props.altura}" />
              </div>
            `;
          }

          if (comp.tipo === 'barcode') {
            const idSvg = `barcode-${comp.id}`;
            return `
              <div style="${baseStyle}">
                <svg id="${idSvg}"
                    jsbarcode-value="${String(barcodeValue)}"
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

      if (qzConectado && impressoraPadrao) {
        const config = qz.configs.create(impressoraPadrao, {
          size: { width: larguraCm, height: alturaCm },
          units: 'cm',
          colorType: 'color',
        });
        await qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }]);
      } else {
        if (qzConectado && !impressoraPadrao) {
          setShowSelecionarImpressora(true);
          return;
        }
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) return;
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
      }

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
        email2: camposExtrasValues.email2 || emailRef.current?.value || '',
        celular: camposExtrasValues.celular || telefoneRef.current?.value || '',
        nomeCracha: nomeCrachaRef.current?.value || '',
        empresaCracha: camposExtrasValues.empresaCracha || empresaRef.current?.value || '',
        cargo: cargoRef.current?.value || '',
        observacao: camposExtrasValues.observacao || '',
        cpf: camposExtrasValues.cpf || '',
        rg: camposExtrasValues.rg || '',
        cnpj: camposExtrasValues.cnpj || '',
        codigoCliente: camposExtrasValues.codigoCliente || '',
        opcao1: camposExtrasValues.opcao1 || '',
        opcao2: camposExtrasValues.opcao2 || '',
        opcao3: camposExtrasValues.opcao3 || '',
        opcao4: camposExtrasValues.opcao4 || '',
        opcao5: camposExtrasValues.opcao5 || '',
        opcao6: camposExtrasValues.opcao6 || '',
        opcao7: camposExtrasValues.opcao7 || '',
        opcao8: camposExtrasValues.opcao8 || '',
        opcao9: camposExtrasValues.opcao9 || '',
        opcao10: camposExtrasValues.opcao10 || '',
        telefone: telefoneRef.current?.value || '',
        categoria: categoriaUpper,
        status: 'pendente',
        criadoPorId: currentUser.uid,
        camposPersonalizados: camposPersonalizadosValues,
        corCategoria: corParaCategoria,
      } as any;

      const participanteId = await criarParticipante(novoParticipante);

      // Usa o ID gerado como codigoCliente para garantir que o QR Code funcione no scan
      await updateDoc(doc(db, 'participantes', participanteId), { codigoCliente: participanteId });

      const participanteCriado: Participante = {
        ...novoParticipante,
        id: participanteId,
        codigoCliente: participanteId,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      } as any;

      setParticipantes((prev) => [participanteCriado, ...prev]);
      setParticipanteSelecionado(participanteCriado);
      setShowFormNovoParticipante(false);
      setMensagem({ tipo: 'success', texto: 'Participante cadastrado com sucesso! Realize o check-in.' });
      setCamposPersonalizadosValues({});
      setCamposExtrasValues({});
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

  /* ===================== Campos visíveis ===================== */

  const toggleCampoVisivel = (key: string, checked: boolean) => {
    const novos = checked
      ? [...camposVisiveis, key]
      : camposVisiveis.filter((c) => c !== key);
    setCamposVisiveis(novos);
    if (eventoId) localStorage.setItem(`painel.campos.${eventoId}`, JSON.stringify(novos));
  };

  const getFieldValueInPanel = (p: Participante, key: string): string => {
    if (key.startsWith('cp:')) {
      const id = key.slice(3);
      const val = (p as any).camposPersonalizados?.[id];
      return typeof val === 'boolean' ? (val ? 'Sim' : 'Não') : String(val ?? '');
    }
    return String((p as any)[key] ?? '');
  };

  const getLabelForKey = (key: string): string => {
    if (key.startsWith('cp:')) {
      const id = key.slice(3);
      return evento?.camposPersonalizados?.find((c) => c.id === id)?.nome || id;
    }
    return evento?.labelsOpcoes?.[key] || LABEL_CAMPO[key] || key;
  };

  /* ===================== Editar nomes dos campos "Opção N" ===================== */

  const abrirEditarNomesCampos = () => {
    const vals: Record<string, string> = {};
    OPCOES_KEYS.forEach((key) => {
      vals[key] = evento?.labelsOpcoes?.[key] || LABEL_CAMPO[key];
    });
    setNomesOpcoesEdicao(vals);
    setShowEditarNomesCampos(true);
  };

  const salvarNomesOpcoes = async () => {
    if (!eventoId || !evento) return;
    try {
      setSalvandoNomesOpcoes(true);
      await atualizarEvento(eventoId, { labelsOpcoes: nomesOpcoesEdicao });
      setEvento({ ...evento, labelsOpcoes: nomesOpcoesEdicao });
      setShowEditarNomesCampos(false);
      setMensagem({ tipo: 'success', texto: 'Nomes dos campos atualizados com sucesso!' });
      setTimeout(() => setMensagem(null), 3000);
    } catch (e) {
      console.error(e);
      setMensagem({ tipo: 'error', texto: 'Erro ao salvar nomes dos campos.' });
    } finally {
      setSalvandoNomesOpcoes(false);
    }
  };

  const salvarNomeOpcaoInline = async (key: string) => {
    if (!eventoId || !evento) return;
    const atual = evento.labelsOpcoes?.[key] || LABEL_CAMPO[key];
    const novoValor = (nomesOpcoesInline[key] ?? atual).trim() || LABEL_CAMPO[key];
    if (novoValor === atual) return;
    try {
      const novosLabels = { ...(evento.labelsOpcoes || {}), [key]: novoValor };
      await atualizarEvento(eventoId, { labelsOpcoes: novosLabels });
      setEvento({ ...evento, labelsOpcoes: novosLabels });
    } catch (e) {
      console.error('Erro ao renomear campo:', e);
      setMensagem({ tipo: 'error', texto: 'Erro ao salvar nome do campo.' });
    }
  };

  /* ===================== Edição inline ===================== */

  const iniciarEdicaoInline = () => {
    if (!participanteSelecionado) return;
    const vals: Record<string, any> = {};
    camposVisiveis.forEach((key) => { vals[key] = getFieldValueInPanel(participanteSelecionado, key); });
    setEditValuesInline(vals);
    setEditandoInline(true);
  };

  const cancelarEdicaoInline = () => {
    setEditandoInline(false);
    setEditValuesInline({});
  };

  const salvarEdicaoInline = async () => {
    if (!participanteSelecionado) return;
    try {
      setSalvandoInline(true);
      const updateObj: Record<string, any> = {};
      const novosCamposPersonalizados = { ...((participanteSelecionado as any).camposPersonalizados || {}) };
      let hasCustom = false;

      for (const [key, valor] of Object.entries(editValuesInline)) {
        if (key.startsWith('cp:')) {
          novosCamposPersonalizados[key.slice(3)] = valor;
          hasCustom = true;
        } else {
          updateObj[key] = valor;
        }
      }
      if (hasCustom) updateObj.camposPersonalizados = novosCamposPersonalizados;

      const ref = doc(db, 'participantes', participanteSelecionado.id);
      await updateDoc(ref, { ...updateObj, atualizadoEm: new Date().toISOString() });

      const atualizado = {
        ...participanteSelecionado,
        ...updateObj,
        camposPersonalizados: novosCamposPersonalizados,
      } as Participante;
      setParticipanteSelecionado(atualizado);
      setParticipantes((prev) => prev.map((p) => (p.id === atualizado.id ? atualizado : p)));
      cancelarEdicaoInline();
      setMensagem({ tipo: 'success', texto: 'Dados atualizados com sucesso!' });
      setTimeout(() => setMensagem(null), 3000);
    } catch (e) {
      console.error(e);
      setMensagem({ tipo: 'error', texto: 'Erro ao salvar alterações.' });
    } finally {
      setSalvandoInline(false);
    }
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
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-semibold">Cadastrar Novo Participante</h3>
                <button
                  type="button"
                  onClick={() => setShowConfigurarCampos(true)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  title="Configurar campos visíveis"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>

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

                {/* Campos extras conforme "Campos visíveis" (mesma configuração de Detalhes do Participante) */}
                {camposVisiveis.some((key) => !key.startsWith('cp:') && !CAMPOS_FIXOS_FORM_NOVO.has(key)) && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">Informações adicionais</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {camposVisiveis
                        .filter((key) => !key.startsWith('cp:') && !CAMPOS_FIXOS_FORM_NOVO.has(key))
                        .map((key) => (
                          <div key={key}>
                            <label htmlFor={key} className="block text-sm font-medium text-gray-700 mb-1">
                              {getLabelForKey(key)}
                            </label>
                            <input
                              id={key}
                              type="text"
                              value={camposExtrasValues[key] || ''}
                              onChange={(e) =>
                                setCamposExtrasValues((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                              className="input-field"
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                )}

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
              {/* Cabeçalho */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">Detalhes do Participante</h3>
                  <button
                    onClick={() => setShowConfigurarCampos(true)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    title="Configurar campos visíveis"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    onClick={abrirEditarNomesCampos}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    title="Editar nomes dos campos Opção"
                  >
                    <Tag className="w-4 h-4" />
                  </button>
                </div>
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

              {/* Campos configuráveis */}
              {camposVisiveis.length === 0 ? (
                <p className="text-sm text-gray-400 mb-6">
                  Nenhum campo selecionado.{' '}
                  <button onClick={() => setShowConfigurarCampos(true)} className="underline text-primary">
                    Configurar campos
                  </button>
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {camposVisiveis.map((key) => (
                    <div key={key}>
                      <p className="text-sm text-gray-500">{getLabelForKey(key)}</p>
                      {editandoInline ? (
                        key === 'categoria' ? (
                          <select
                            value={editValuesInline[key] ?? ''}
                            onChange={(e) =>
                              setEditValuesInline((prev) => ({ ...prev, [key]: normalizeCategory(e.target.value) }))
                            }
                            className="input-field text-sm mt-0.5 uppercase"
                          >
                            <option value="">Selecione uma categoria</option>
                            {categoriasEvento.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            value={editValuesInline[key] ?? ''}
                            onChange={(e) =>
                              setEditValuesInline((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            className="input-field text-sm mt-0.5"
                          />
                        )
                      ) : (
                        <p className="font-medium">
                          {getFieldValueInPanel(participanteSelecionado, key) || '-'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Botões de ação */}
              <div className="flex flex-wrap gap-2">
                {editandoInline ? (
                  <>
                    <button
                      onClick={salvarEdicaoInline}
                      disabled={salvandoInline}
                      className="btn btn-primary flex items-center"
                    >
                      {salvandoInline
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                        : <><Save className="w-4 h-4 mr-2" />Salvar Alterações</>}
                    </button>
                    <button onClick={cancelarEdicaoInline} className="btn btn-outline flex items-center">
                      <X className="w-4 h-4 mr-2" />Cancelar
                    </button>
                    <button
                      onClick={() =>
                        navigate(`/operador/participantes/${eventoId}/${participanteSelecionado.id}/editar`, {
                          state: { from: 'painel-recepcao' },
                        })
                      }
                      className="btn btn-outline flex items-center"
                    >
                      <Edit className="w-4 h-4 mr-2" />Editar Cadastro
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={iniciarEdicaoInline}
                      className="btn btn-outline flex items-center"
                    >
                      <Pencil className="w-4 h-4 mr-2" />Editar
                    </button>
                    <button
                      onClick={() =>
                        navigate(`/operador/participantes/${eventoId}/${participanteSelecionado.id}/editar`, {
                          state: { from: 'painel-recepcao' },
                        })
                      }
                      className="btn btn-outline flex items-center"
                    >
                      <Edit className="w-5 h-5 mr-2" />Editar Cadastro
                    </button>
                    {participanteSelecionado.status !== 'credenciado' && (
                      <button
                        onClick={handleCheckinComConfirmacao}
                        disabled={loading}
                        className="btn btn-primary flex items-center"
                      >
                        <CheckCircle className="w-5 h-5 mr-2" />
                        {loading ? 'Processando...' : 'Fazer Check-in'}
                      </button>
                    )}
                    <div className="flex items-center">
                      <button
                        onClick={handlePrintCredencial}
                        className="btn btn-outline flex items-center rounded-r-none border-r-0"
                      >
                        {qzConectado && impressoraPadrao
                          ? <Wifi className="w-5 h-5 mr-2 text-green-500" />
                          : <Printer className="w-5 h-5 mr-2" />}
                        Imprimir Credencial
                      </button>
                      <button
                        onClick={() => setShowSelecionarImpressora(true)}
                        className="btn btn-outline rounded-l-none px-2"
                        title="Configurar impressora"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
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
      {/* Modal: Configurar campos visíveis */}
      {showConfigurarCampos && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 pt-6 pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold">Campos visíveis</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Escolha quais dados aparecem nos detalhes do participante.
                </p>
              </div>
              <button
                onClick={() => setShowConfigurarCampos(false)}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-4 space-y-1 flex-1">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Campos padrão</p>
              {CAMPOS_PADRAO_LISTA.map((key) => {
                const checked = camposVisiveis.includes(key);
                const isOpcao = OPCOES_KEYS.includes(key);
                return (
                  <div key={key} className="rounded-lg hover:bg-gray-50">
                    <label className="flex items-center gap-3 p-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleCampoVisivel(key, e.target.checked)}
                        className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary"
                      />
                      <span className="text-sm text-gray-700">{getLabelForKey(key)}</span>
                    </label>
                    {isOpcao && checked && (
                      <div className="pl-9 pr-2 pb-2">
                        <input
                          type="text"
                          value={nomesOpcoesInline[key] ?? evento.labelsOpcoes?.[key] ?? LABEL_CAMPO[key]}
                          onChange={(e) =>
                            setNomesOpcoesInline((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          onBlur={() => salvarNomeOpcaoInline(key)}
                          placeholder={LABEL_CAMPO[key]}
                          className="input-field text-sm"
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {evento.camposPersonalizados && evento.camposPersonalizados.length > 0 && (
                <>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mt-4 mb-2">
                    Campos personalizados
                  </p>
                  {evento.camposPersonalizados.map((campo) => {
                    const key = `cp:${campo.id}`;
                    return (
                      <label
                        key={key}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={camposVisiveis.includes(key)}
                          onChange={(e) => toggleCampoVisivel(key, e.target.checked)}
                          className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary"
                        />
                        <span className="text-sm text-gray-700">{campo.nome}</span>
                        <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">
                          personalizado
                        </span>
                      </label>
                    );
                  })}
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
              <span className="text-sm text-gray-500">
                {camposVisiveis.length} campo(s) selecionado(s)
              </span>
              <button
                onClick={() => setShowConfigurarCampos(false)}
                className="btn btn-primary"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar nomes dos campos "Opção N" */}
      {showEditarNomesCampos && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 pt-6 pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold">Editar nomes dos campos</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Personalize os nomes exibidos para os campos "Opção 1" a "Opção 10" neste evento.
                </p>
              </div>
              <button
                onClick={() => setShowEditarNomesCampos(false)}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-4 space-y-3 flex-1">
              {OPCOES_KEYS.map((key) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-1">{LABEL_CAMPO[key]}</label>
                  <input
                    type="text"
                    value={nomesOpcoesEdicao[key] ?? ''}
                    onChange={(e) =>
                      setNomesOpcoesEdicao((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder={LABEL_CAMPO[key]}
                    className="input-field text-sm"
                  />
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setShowEditarNomesCampos(false)}
                className="btn btn-outline"
              >
                Cancelar
              </button>
              <button
                onClick={salvarNomesOpcoes}
                disabled={salvandoNomesOpcoes}
                className="btn btn-primary flex items-center"
              >
                {salvandoNomesOpcoes
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                  : <><Save className="w-4 h-4 mr-2" />Salvar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Configurar impressora */}
      {showSelecionarImpressora && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold">Impressora</h3>
                <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                  {qzConectado
                    ? <><Wifi className="w-3.5 h-3.5 text-green-500" />QZ Tray conectado</>
                    : <><WifiOff className="w-3.5 h-3.5 text-gray-400" />QZ Tray não disponível</>}
                </p>
              </div>
              <button
                onClick={() => setShowSelecionarImpressora(false)}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4">
              {!qzConectado ? (
                <>
                  <p className="text-sm text-gray-500 mb-3">
                    O QZ Tray não está em execução ou a conexão não foi autorizada. Instale e inicie o aplicativo, autorize a conexão no aviso do QZ Tray (marque "Remember this decision" para não ver novamente) e tente de novo.
                  </p>
                  <button
                    onClick={async () => {
                      setReconectandoQz(true);
                      await conectarQz();
                      setReconectandoQz(false);
                    }}
                    disabled={reconectandoQz}
                    className="btn btn-outline flex items-center"
                  >
                    {reconectandoQz
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Conectando...</>
                      : 'Tentar novamente'}
                  </button>
                </>
              ) : (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Impressora padrão
                  </label>
                  <select
                    value={impressoraPadrao}
                    onChange={(e) => {
                      setImpressoraPadrao(e.target.value);
                      localStorage.setItem('impressora.padrao', e.target.value);
                    }}
                    className="input-field"
                  >
                    <option value="">Usar diálogo do navegador</option>
                    {impressorasDisponiveis.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-2">
                    A impressora selecionada será usada em todos os eventos neste dispositivo.
                  </p>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowSelecionarImpressora(false)}
                className="btn btn-primary"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </LayoutDefault>
  );
};

export default PainelRecepcao;
