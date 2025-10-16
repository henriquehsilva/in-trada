import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Search, QrCode, Printer, CheckCircle2, BadgeCheck, Loader2, X, AlertTriangle } from 'lucide-react';
import QrCodeScanner from '../../components/qrcode/QrCodeScanner';
import { useAuth } from '../../contexts/AuthContext';
import { Evento, Participante } from '../../models/types';
import { obterEventoPorId } from '../../services/eventoService';
import {
  buscarParticipantes,
  fazerCheckin,
  obterParticipantePorId,
  obterParticipantesPorEvento,
  reservarEtiquetaUmaVez,
  subscribeParticipantesDoEvento,
} from '../../services/participanteService';
import { obterModelosCrachaPorEvento } from '../../services/modeloService';
import QRCode from 'qrcode';

// 🔹 Firestore para busca direta por codigoCliente
import { collection, query as fsQuery, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';

/**
 * Autoatendimento (Kiosk) – versão offline-first
 * - Busca: cache → servidor, com fallback local
 * - Check-in: permite offline (sincroniza depois via Firestore)
 * - Etiqueta: reserva 1x pelo cliente (otimista, funciona offline) + REGRAS no backend garantem unicidade
 * - Badge de estado de rede
 */

const STATUS_LABEL: Record<string, string> = {
  credenciado: 'Credenciado',
  confirmado: 'Confirmado',
  pendente: 'Pendente',
};

const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine);

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
  const [online, setOnline] = useState<boolean>(isOnline());

  // ref para manter o foco no search
  const searchRef = useRef<HTMLInputElement>(null);

  // ===== Rede: badge e comportamento =====
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // ===== Carregar evento + lista inicial =====
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

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

        // pré-carrega base para busca local/offline
        const lista = await obterParticipantesPorEvento(eventId);
        setBaseParticipantes(lista || []);
        setParticipantes([]);
        setMsg(null);

        // 🔄 mantém cache aquecido (opcional, mas recomendado)
        unsubscribe = subscribeParticipantesDoEvento(eventId, (arr) => {
          const next = arr || [];
          setBaseParticipantes(next);
          // Se há termo ativo, re-aplica filtro local para refletir atualizações
          if (termo.trim()) {
            const q = termo.trim().toLowerCase();
            setParticipantes(
              next.filter((p: any) => {
                const vals = [
                  p.nome,
                  p.empresa,
                  p.email1,
                  p.email2,
                  p.id,
                  p.codigoCliente, // 👈 inclui codigoCliente no filtro “ao vivo”
                ].map((v: any) => (v || '').toString().toLowerCase());
                return vals.some((v: string) => v.includes(q));
              })
            );
          }
        });
      } catch (e) {
        console.error(e);
        setMsg({ tipo: 'error', texto: 'Erro ao carregar dados do evento.' });
      } finally {
        setCarregando(false);
      }
    };

    run();
    return () => {
      if (unsubscribe) unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // ===== Dispara busca apenas em Enter/Tab (cache → servidor) =====
  const executarBusca = async () => {
    if (!eventId) return;
    const q = termo.trim().toLowerCase();
    if (!q) {
      setParticipantes([]);
      setMsg(null);
      return;
    }
    try {
      setBuscando(true);

      // 1) filtro local (sempre disponível – bom para offline e resposta instantânea)
      const local = baseParticipantes.filter((p) => {
        const arr = [
          p.nome,
          p.empresa,
          (p as any).email1,
          (p as any).email2,
          p.id,
          (p as any).codigoCliente, // 👈 inclui o codigoCliente na busca local
        ].map((v) => (v || '').toString().toLowerCase());
        return arr.some((v) => v.includes(q));
      });

      // 2) servidor (se online) usando service (que já é cache→server)
      let remotos: Participante[] = [];
      if (online) {
        try {
          remotos = await buscarParticipantes(eventId, q);
        } catch (err) {
          console.warn('Busca remota falhou, mantendo local:', err);
        }
      }

      // Preferir remotos quando existem; senão local
      const res = remotos?.length ? remotos : local;
      setParticipantes(res);
      setMsg(
        res.length
          ? null
          : { tipo: 'info', texto: online ? 'Nenhum participante encontrado.' : 'Sem rede: exibindo resultados locais.' }
      );
    } catch (e) {
      console.error(e);
      setMsg({ tipo: 'error', texto: 'Falha na busca. Tente novamente.' });
    } finally {
      setBuscando(false);
    }
  };

  // ===== Regras de ação =====
  const podeImprimir = (p: Participante) => !(p as any).etiquetaImpressaEm;

  // Reserva “apenas 1x” — OTIMISTA (funciona offline). Regras do Firestore garantem no backend.
  const reservarImpressao = async (p: Participante) => {
    if (!currentUser?.uid) throw new Error('Usuário não autenticado.');

    // Atualiza servidor (ou fila offline) e reflete na UI
    await reservarEtiquetaUmaVez(p.id, currentUser.uid);

    const iso = new Date().toISOString();
    setParticipantes((prev) => prev.map((x) => (x.id === p.id ? ({ ...x, etiquetaImpressaEm: iso } as any) : x)));
    setBaseParticipantes((prev) => prev.map((x) => (x.id === p.id ? ({ ...x, etiquetaImpressaEm: iso } as any) : x)));
  };

  const handleImprimir = async (p: Participante) => {
    try {
      await reservarImpressao(p);
      await imprimirCracha(p);
      setMsg({
        tipo: 'success',
        texto: online ? 'Etiqueta enviada para impressão!' : 'Etiqueta registrada offline. Será sincronizada quando houver rede.',
      });
    } catch (e: any) {
      console.error(e);
      setMsg({ tipo: 'error', texto: e?.message || 'Erro ao imprimir etiqueta.' });
    }
  };

  // Check-in pode operar offline (Firestore enfileira e sincroniza)
  const handleCheckin = async (p: Participante) => {
    try {
      await fazerCheckin(p.id);
      const up = { ...p, status: 'credenciado' as const };
      setParticipantes((prev) => prev.map((x) => (x.id === p.id ? up : x)));
      setBaseParticipantes((prev) => prev.map((x) => (x.id === p.id ? up : x)));
      setMsg({
        tipo: 'success',
        texto: online ? 'Check-in realizado!' : 'Check-in registrado offline. Será sincronizado quando houver rede.',
      });
    } catch (e) {
      console.error(e);
      setMsg({ tipo: 'error', texto: 'Erro no check-in.' });
    }
  };

  // ===== QRCode: buscar por codigoCliente (texto) dentro do evento; fallback para id se necessário
  const onScan = async (raw: string) => {
    if (!eventId) return;
    try {
      const scanned = (raw || '').trim();
      let codigoCliente: string | undefined;
      let id: string | undefined;

      // tenta JSON { codigoCliente?, id? }
      try {
        const parsed = JSON.parse(scanned);
        if (parsed && typeof parsed === 'object') {
          codigoCliente = parsed.codigoCliente || parsed.codigo || parsed.codCliente || undefined;
          id = parsed.id || undefined;
        }
      } catch {
        // não é JSON → trate como codigoCliente em texto puro
        codigoCliente = scanned;
      }

      let participante: Participante | null = null;

      // 1) tenta em memória (baseParticipantes) pelo codigoCliente
      if (codigoCliente) {
        participante =
          baseParticipantes.find(
            (p) => String((p as any).codigoCliente || '') === String(codigoCliente)
          ) || null;
      }

      // 2) se não achou, consulta direto Firestore por eventoId + codigoCliente
      if (!participante && codigoCliente) {
        const ref = collection(db, 'participantes');
        const q = fsQuery(
          ref,
          where('eventoId', '==', eventId),
          where('codigoCliente', '==', codigoCliente)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0];
          participante = { id: d.id, ...(d.data() as any) } as Participante;
        }
      }

      // 3) fallback: tenta pelo id (se veio no JSON) ou pela própria string
      if (!participante && (id || scanned)) {
        const idToFetch = id || scanned;
        try {
          const p = await obterParticipantePorId(idToFetch);
          if (p && p.eventoId === eventId) {
            participante = p;
          }
        } catch {
          // ignora
        }
      }

      if (!participante) {
        setMsg({ tipo: 'error', texto: 'QR Code inválido: participante não encontrado para este evento.' });
        return;
      }

      setParticipantes([participante]);
      setTermo('');
      setMsg(
        participante.status === 'credenciado'
          ? { tipo: 'info', texto: 'Participante já credenciado.' }
          : { tipo: 'success', texto: 'Participante localizado!' }
      );
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

    const htmlComponente = (modeloPadrao.componentes || [])
      .map((comp: any) => {
        const props = comp.propriedades || {};
        const valor = props.campoVinculado ? (participante as any)[props.campoVinculado] || '' : props.texto || '';
        if (comp.tipo === 'qrcode') {
          return `<div style="position:absolute;top:${props.y}px;left:${props.x}px;width:${props.largura}px;height:${props.altura}px;"><img src="${qr}" width="${props.largura}" height="${props.altura}"/></div>`;
        }
        if (comp.tipo === 'barcode') {
          return `<div style="position:absolute;top:${props.y}px;left:${props.x}px;"><svg id="barcode-${props.campoVinculado}" jsbarcode-value="${valor}" jsbarcode-format="CODE128" jsbarcode-width="2" jsbarcode-height="${props.altura}" jsbarcode-displayvalue="false"></svg></div>`;
        }
        return `<div style="position:absolute;top:${props.y}px;left:${props.x}px;width:${props.largura}px;height:${props.altura}px;font-size:${props.estilos?.tamanhoFonte || 14}px;font-weight:${props.estilos?.negrito ? 'bold' : 'normal'};font-family:${props.estilos?.fonte || 'Arial'};text-align:${props.estilos?.alinhamento || 'left'};color:${props.estilos?.corFonte || '#000'};background-color:${props.estilos?.corFundo || 'transparent'};border-radius:${props.estilos?.raio || 0}px;display:flex;align-items:center;justify-content:center;overflow:hidden;">${valor}</div>`;
      })
      .join('');

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
          <h1 className="text-2xl md:text-3xl font-bold truncate">
            {evento ? evento.nome : 'Autoatendimento'}
          </h1>

          <div className="flex items-center gap-3">
            {!online && (
              <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                Offline
              </span>
            )}
            {evento && (
              <button
                onClick={() => setShowScanner(true)}
                className="hidden md:inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50"
                title="Ler QR Code"
              >
                <QrCode className="w-5 h-5" /> <span>QR Code</span>
              </button>
            )}
          </div>
        </div>

        {/* Campo de busca grande */}
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
            <input
              ref={searchRef}
              autoFocus
              value={termo}
              onChange={(e) => {
                setTermo(e.target.value);
                // mantém foco após re-render
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
                      try {
                        el.setSelectionRange(end, end);
                      } catch {}
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
                  setParticipantes([]);
                  setMsg(null);
                  searchRef.current?.focus({ preventScroll: true });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-gray-100"
                title="Limpar"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            )}
          </div>
          <div className="mt-2 text-sm text-gray-500 flex items-center gap-2 min-h-[1.25rem]">
            {buscando && (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> <span>Buscando...</span>
              </>
            )}
            {!buscando && termo.trim() && participantes.length > 0 && (
              <span>{participantes.length} resultado(s)</span>
            )}
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
              <BadgeCheck className="w-4 h-4 mr-1" /> Etiqueta impressa
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`px-2.5 py-1 text-xs rounded-full border ${
              p.status === 'credenciado'
                ? 'bg-green-50 text-green-700 border-green-200'
                : p.status === 'confirmado'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-gray-50 text-gray-700 border-gray-200'
            }`}
          >
            {STATUS_LABEL[p.status] || p.status}
          </span>
          {p.status !== 'credenciado' && (
            <button
              onClick={() => handleCheckin(p)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-3 py-2 hover:bg-blue-700"
            >
              <CheckCircle2 className="w-4 h-4" /> Check-in
            </button>
          )}
          <button
            onClick={() => setConfirmando(p)}
            disabled={!podeImprimir(p)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 ${
              podeImprimir(p) ? 'hover:bg-gray-50' : 'opacity-60 cursor-not-allowed'
            }`}
            title={podeImprimir(p) ? 'Imprimir etiqueta' : 'Etiqueta já impressa'}
          >
            <Printer className="w-4 h-4" /> Etiqueta
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
                <p className="text-sm">
                  Passe <code className="px-1.5 py-0.5 rounded bg-gray-100">/autoatendimento/:eventoId</code> ou{' '}
                  <code className="px-1.5 py-0.5 rounded bg-gray-100">?eventoId=ID</code>.
                </p>
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
          <div
            className={`mb-4 rounded-xl px-4 py-3 text-sm ${
              msg.tipo === 'success'
                ? 'bg-green-50 text-green-700'
                : msg.tipo === 'error'
                ? 'bg-red-50 text-red-700'
                : 'bg-yellow-50 text-yellow-700'
            }`}
          >
            {msg.texto}
          </div>
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
              <button className="p-2 rounded-full hover:bg-gray-100" onClick={() => setShowScanner(false)}>
                <X className="w-5 h-5" />
              </button>
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
              <button onClick={() => setConfirmando(null)} className="rounded-xl border px-4 py-2 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const alvo = confirmando;
                  setConfirmando(null);
                  if (alvo) await handleImprimir(alvo);
                }}
                className="rounded-xl bg-blue-600 text-white px-4 py-2 hover:bg-blue-700"
              >
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoAtendimento;
