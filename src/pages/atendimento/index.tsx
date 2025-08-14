import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Search, QrCode, Printer, CheckCircle2, BadgeCheck, Loader2, X, AlertTriangle } from 'lucide-react';
import QrCodeScanner from '../../components/qrcode/QrCodeScanner';
import { useAuth } from '../../contexts/AuthContext';
import { Evento, Participante } from '../../models/types';
import { obterEventoPorId } from '../../services/eventoService';
import { buscarParticipantes, fazerCheckin, obterParticipantePorId, obterParticipantesPorEvento } from '../../services/participanteService';
import { obterModelosCrachaPorEvento } from '../../services/modeloService';
import QRCode from 'qrcode';
import { db } from '../../firebase/config';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';

/**
 * Tela de Autoatendimento (Kiosk)
 * - Busca só é disparada quando o usuário pressiona Enter ou Tab
 * - Lista ampla com ações grandes (Check-in e Imprimir Etiqueta)
 * - Etiqueta: impressão apenas 1x (transação Firestore)
 * - FAB de QR Code
 */

const STATUS_LABEL: Record<string, string> = {
  credenciado: 'Credenciado',
  confirmado: 'Confirmado',
  pendente: 'Pendente',
};

const AutoAtendimento: React.FC = () => {
  const navigate = useNavigate();
  const { eventoId: eventoIdParam } = useParams<{ eventoId: string }>();
  const [searchParams] = useSearchParams();
  const { currentUser } = useAuth();

  const eventId = eventoIdParam ?? searchParams.get('eventoId') ?? undefined;

  const [evento, setEvento] = useState<Evento | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [baseParticipantes, setBaseParticipantes] = useState<Participante[]>([]);
  const [termo, setTermo] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'success' | 'error' | 'info'; texto: string } | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [confirmando, setConfirmando] = useState<Participante | null>(null);

  // ref para manter o foco no search
  const searchRef = useRef<HTMLInputElement>(null);

  // ===== Carregar evento + lista inicial =====
  useEffect(() => {
    const run = async () => {
      if (!eventId) {
        setCarregando(false);
        setMsg({ tipo: 'info', texto: 'Informe o evento na URL (ex.: /autoatendimento/:eventoId) ou ?eventoId=ID.' });
        return;
      }
      try {
        setCarregando(true);
        const ev = await obterEventoPorId(eventId);
        setEvento(ev);
        const lista = await obterParticipantesPorEvento(eventId);
        setBaseParticipantes(lista);
        setParticipantes(lista);
      } catch (e) {
        console.error(e);
        setMsg({ tipo: 'error', texto: 'Erro ao carregar dados do evento.' });
      } finally {
        setCarregando(false);
      }
    };
    run();
  }, [eventId]);

  // ===== Dispara busca apenas em Enter/Tab =====
  const executarBusca = async () => {
    if (!eventId) return;
    const q = termo.trim().toLowerCase();
    if (!q) {
      setParticipantes(baseParticipantes);
      setMsg(null);
      return;
    }
    try {
      setBuscando(true);
      const remotos = await buscarParticipantes(eventId, q);
      const fallback = baseParticipantes.filter((p) => {
        const arr = [p.nome, p.empresa, (p as any).email1, (p as any).email2, p.id].map((v) => (v || '').toString().toLowerCase());
        return arr.some((v) => v.includes(q));
      });
      const res = remotos?.length ? remotos : fallback;
      setParticipantes(res);
      setMsg(res.length ? null : { tipo: 'info', texto: 'Nenhum participante encontrado.' });
    } catch (e) {
      console.error(e);
      setMsg({ tipo: 'error', texto: 'Falha na busca. Tente novamente.' });
    } finally {
      setBuscando(false);
    }
  };

  // ===== Ações =====
  const podeImprimir = (p: Participante) => !(p as any).etiquetaImpressaEm;

  const reservarImpressao = async (p: Participante) => {
    if (!currentUser?.uid) throw new Error('Usuário não autenticado.');
    const ref = doc(db, 'participantes', p.id);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Participante não encontrado');
      const dados = snap.data() as any;
      if (dados.etiquetaImpressaEm) throw new Error('Etiqueta já foi impressa.');
      tx.update(ref, { etiquetaImpressaEm: serverTimestamp(), etiquetaImpressaPorId: currentUser.uid });
    });
    // Reflete localmente
    setParticipantes((prev) => prev.map((x) => (x.id === p.id ? ({ ...x, etiquetaImpressaEm: new Date().toISOString() } as any) : x)));
    setBaseParticipantes((prev) => prev.map((x) => (x.id === p.id ? ({ ...x, etiquetaImpressaEm: new Date().toISOString() } as any) : x)));
  };

  const handleImprimir = async (p: Participante) => {
    try {
      await reservarImpressao(p);
      await imprimirCracha(p);
      setMsg({ tipo: 'success', texto: 'Etiqueta enviada para impressão!' });
    } catch (e: any) {
      console.error(e);
      setMsg({ tipo: 'error', texto: e?.message || 'Erro ao imprimir etiqueta.' });
    }
  };

  const handleCheckin = async (p: Participante) => {
    try {
      await fazerCheckin(p.id);
      const up = { ...p, status: 'credenciado' as const };
      setParticipantes((prev) => prev.map((x) => (x.id === p.id ? up : x)));
      setBaseParticipantes((prev) => prev.map((x) => (x.id === p.id ? up : x)));
      setMsg({ tipo: 'success', texto: 'Check-in realizado!' });
    } catch (e) {
      console.error(e);
      setMsg({ tipo: 'error', texto: 'Erro no check-in.' });
    }
  };

  const onScan = async (raw: string) => {
    try {
      let id = raw;
      try { id = JSON.parse(raw)?.id || raw; } catch {}
      const p = await obterParticipantePorId(id);
      if (!p) return setMsg({ tipo: 'error', texto: 'QR Code inválido.' });
      setParticipantes([p]);
      setTermo('');
      setMsg(p.status === 'credenciado' ? { tipo: 'info', texto: 'Participante já credenciado.' } : { tipo: 'success', texto: 'Participante localizado!' });
    } catch (e) {
      console.error(e);
      setMsg({ tipo: 'error', texto: 'Falha ao ler QR Code.' });
    } finally {
      setShowScanner(false);
    }
  };

  // ===== Impressão (gera HTML e chama window.print) =====
  const imprimirCracha = async (participante: Participante) => {
    if (!evento) return;
    const modelos = await obterModelosCrachaPorEvento(evento.id);
    const modeloPadrao = modelos.find((m) => m.padrao);
    if (!modeloPadrao) throw new Error('Modelo padrão não definido.');

    const qr = await QRCode.toDataURL(JSON.stringify(participante));
    const cmToZplPx = (cm: number) => Math.round((cm / 2.54) * 203);
    const largura = cmToZplPx(modeloPadrao.larguraCm || 8);
    const altura = cmToZplPx(modeloPadrao.alturaCm || 3);

    const htmlComponente = (modeloPadrao.componentes || []).map((comp: any) => {
      const props = comp.propriedades || {};
      const valor = props.campoVinculado ? (participante as any)[props.campoVinculado] || '' : props.texto || '';
      if (comp.tipo === 'qrcode') {
        return `<div style="position:absolute;top:${props.y}px;left:${props.x}px;width:${props.largura}px;height:${props.altura}px;"><img src="${qr}" width="${props.largura}" height="${props.altura}"/></div>`;
      }
      if (comp.tipo === 'barcode') {
        return `<div style="position:absolute;top:${props.y}px;left:${props.x}px;"><svg id="barcode-${props.campoVinculado}" jsbarcode-value="${valor}" jsbarcode-format="CODE128" jsbarcode-width="2" jsbarcode-height="${props.altura}" jsbarcode-displayvalue="false"></svg></div>`;
      }
      return `<div style="position:absolute;top:${props.y}px;left:${props.x}px;width:${props.largura}px;height:${props.altura}px;font-size:${props.estilos?.tamanhoFonte || 14}px;font-weight:${props.estilos?.negrito ? 'bold' : 'normal'};font-family:${props.estilos?.fonte || 'Arial'};text-align:${props.estilos?.alinhamento || 'left'};color:${props.estilos?.corFonte || '#000'};background-color:${props.estilos?.corFundo || 'transparent'};border-radius:${props.estilos?.raio || 0}px;display:flex;align-items:center;justify-content:center;overflow:hidden;">${valor}</div>`;
    }).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Imprimir</title><script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script><style>@page{size:${largura}px ${altura}px;margin:0}body{margin:0;padding:0}</style></head><body><div style="position:relative;width:${largura}px;height:${altura}px;">${htmlComponente}</div><script>window.onload=function(){if(window.JsBarcode){JsBarcode("svg[id^='barcode-']").init()}window.print();setTimeout(()=>window.close(),300)}</script></body></html>`;
    const w = window.open('', '_blank', 'width=800,height=600');
    if (!w) throw new Error('Pop-up bloqueado.');
    w.document.write(html);
    w.document.close();
  };

  // ===== Header / Input =====
  const Header = () => (
    <div className="sticky top-0 z-20 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold truncate">{evento ? evento.nome : 'Autoatendimento'}</h1>
          {evento && (
            <button
              onClick={() => setShowScanner(true)}
              className="hidden md:inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50"
              title="Ler QR Code"
            >
              <QrCode className="w-5 h-5"/> <span>QR Code</span>
            </button>
          )}
        </div>
        {/* Campo de busca grande */}
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400"/>
            <input
              ref={searchRef}
              autoFocus
              value={termo}
              onChange={(e) => {
                setTermo(e.target.value);
                // garante que o foco permaneça mesmo após re-render
                requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  executarBusca().finally(() => {
                    const el = searchRef.current;
                    if (el) {
                      el.focus({ preventScroll: true });
                      const end = el.value.length;
                      try { el.setSelectionRange(end, end); } catch {}
                    }
                  });
                }
              }}
              placeholder="Digite e pressione Enter ou Tab para buscar..."
              className="w-full pl-14 pr-12 py-4 rounded-2xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 text-lg"
            />
            {!!termo && (
              <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setTermo('');
                setParticipantes(baseParticipantes);
                setMsg(null);
                searchRef.current?.focus({ preventScroll: true });
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-gray-100"
              title="Limpar"
            >
              <X className="w-5 h-5 text-gray-500"/>
            </button>
            )}
          </div>
          <div className="mt-2 text-sm text-gray-500 flex items-center gap-2 min-h-[1.25rem]">
            {buscando && (<><Loader2 className="w-4 h-4 animate-spin"/> <span>Buscando...</span></>)}
            {!buscando && participantes.length > 0 && (<span>{participantes.length} resultado(s)</span>)}
          </div>
        </div>
      </div>
    </div>
  );

  const Linha = ({ p }: { p: Participante }) => (
    <div className="group rounded-2xl bg-white border border-gray-100 p-4 md:p-5 shadow-sm hover:shadow transition">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: (p as any).corCategoria || '#9CA3AF' }} />
            <span className="text-xs uppercase tracking-wide text-gray-500">{p.categoria}</span>
          </div>
          <h3 className="mt-1 text-lg md:text-xl font-semibold truncate">{p.nome}</h3>
          <div className="mt-1 text-sm text-gray-600 truncate">{p.empresa || '—'} • {(p as any).email1 || '—'}</div>
          {(p as any).etiquetaImpressaEm && (
            <div className="mt-2 inline-flex items-center text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full">
              <BadgeCheck className="w-4 h-4 mr-1"/> Etiqueta impressa
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2.5 py-1 text-xs rounded-full border ${p.status==='credenciado' ? 'bg-green-50 text-green-700 border-green-200' : p.status==='confirmado' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
            {STATUS_LABEL[p.status] || p.status}
          </span>
          {p.status !== 'credenciado' && (
            <button onClick={() => handleCheckin(p)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-3 py-2 hover:bg-blue-700">
              <CheckCircle2 className="w-4 h-4"/> Check-in
            </button>
          )}
          <button
            onClick={() => setConfirmando(p)}
            disabled={!podeImprimir(p)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 ${podeImprimir(p) ? 'hover:bg-gray-50' : 'opacity-60 cursor-not-allowed'}`}
            title={podeImprimir(p) ? 'Imprimir etiqueta' : 'Etiqueta já impressa'}
          >
            <Printer className="w-4 h-4"/> Etiqueta
          </button>
        </div>
      </div>
    </div>
  );

  // ===== Render principal =====
  if (carregando) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-6xl mx-auto px-4 py-10 grid gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!eventId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-3xl mx-auto px-4 py-14">
          <div className="rounded-2xl border bg-white p-6 text-gray-700">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h2 className="font-semibold mb-1">Evento não informado</h2>
                <p className="text-sm">Passe <code className="px-1.5 py-0.5 rounded bg-gray-100">/autoatendimento/:eventoId</code> ou <code className="px-1.5 py-0.5 rounded bg-gray-100">?eventoId=ID</code>.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Lista ampla */}
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
        {msg && (
          <div className={`mb-4 rounded-xl px-4 py-3 text-sm ${msg.tipo==='success' ? 'bg-green-50 text-green-700' : msg.tipo==='error' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>{msg.texto}</div>
        )}

        {participantes.length === 0 ? (
          <div className="rounded-2xl border border-dashed text-center p-14 text-gray-500 bg-white">
            Nenhum participante para exibir. Digite e pressione Enter/Tab para buscar.
          </div>
        ) : (
          <div className="grid gap-3 md:gap-4">
            {participantes.map((p) => (
              <Linha key={p.id} p={p} />
            ))}
          </div>
        )}
      </div>

      {/* FAB para QR Code */}
      {evento && (
        <button
          onClick={() => setShowScanner(true)}
          className="fixed bottom-6 right-6 md:bottom-8 md:right-8 rounded-full shadow-lg bg-blue-600 text-white p-4 hover:bg-blue-700 focus:outline-none"
          aria-label="Ler QR Code"
        >
          <QrCode className="w-6 h-6" />
        </button>
      )}

      {/* Modal Scanner */}
      {showScanner && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-4 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Scanner QR Code</h3>
              <button className="p-2 rounded-full hover:bg-gray-100" onClick={() => setShowScanner(false)}><X className="w-5 h-5"/></button>
            </div>
            <QrCodeScanner onScan={onScan} />
          </div>
        </div>
      )}

      {/* Modal confirmação etiqueta */}
      {confirmando && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Imprimir etiqueta?</h3>
            <p className="mt-1 text-sm text-gray-600">A etiqueta pode ser impressa apenas uma vez por participante.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setConfirmando(null)} className="rounded-xl border px-4 py-2 hover:bg-gray-50">Cancelar</button>
              <button onClick={async () => { const alvo = confirmando; setConfirmando(null); if (alvo) await handleImprimir(alvo); }} className="rounded-xl bg-blue-600 text-white px-4 py-2 hover:bg-blue-700">Imprimir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoAtendimento;
