import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Search, QrCode, Printer, CheckCircle2, BadgeCheck,
  Loader2, X, AlertTriangle, Settings, Pencil, Save, UserCog, Wifi, WifiOff,
} from 'lucide-react';
import QrCodeScanner from '../../components/qrcode/QrCodeScanner';
import { useAuth } from '../../contexts/AuthContext';
import { Evento, Participante } from '../../models/types';
import { obterEventoPorId } from '../../services/eventoService';
import {
  buscarParticipantes,
  fazerCheckin,
  atualizarParticipante,
  obterParticipantesPorEvento,
  reservarEtiquetaUmaVez,
  subscribeParticipantesDoEvento,
} from '../../services/participanteService';
import { obterModelosCrachaPorEvento } from '../../services/modeloService';
import { normalizeText } from '../../utils/textUtils';
import { collection, query as fsQuery, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { printBadge } from '../../utils/qzPrintUtils';
import { connectQz, isQzConnected, QZ_TRAY_ENABLED, selectQzPrinter } from '../../utils/qzConnection';

const STATUS_LABEL: Record<string, string> = {
  credenciado: 'Credenciado',
  confirmado: 'Confirmado',
  pendente: 'Pendente',
};

const LABEL_CAMPO: Record<string, string> = {
  nome: 'Nome',
  empresa: 'Empresa',
  nomeCracha: 'Nome no crachá',
  empresaCracha: 'Empresa no crachá',
  cargo: 'Cargo',
  email1: 'E-mail',
  email2: 'E-mail 2',
  celular: 'Celular',
  telefone: 'Telefone',
  categoria: 'Categoria',
  cpf: 'CPF',
  rg: 'RG',
  cnpj: 'CNPJ',
  codigoCliente: 'Código cliente',
  opcao1: 'Opção 1', opcao2: 'Opção 2', opcao3: 'Opção 3', opcao4: 'Opção 4',
  opcao5: 'Opção 5', opcao6: 'Opção 6', opcao7: 'Opção 7', opcao8: 'Opção 8',
  opcao9: 'Opção 9', opcao10: 'Opção 10',
  observacao: 'Observação',
};

const CAMPOS_PADRAO_LISTA = [
  'nome','empresa','nomeCracha','empresaCracha','cargo',
  'email1','email2','celular','telefone','categoria',
  'cpf','rg','cnpj','codigoCliente',
  'opcao1','opcao2','opcao3','opcao4','opcao5',
  'opcao6','opcao7','opcao8','opcao9','opcao10',
  'observacao',
];

const CAMPOS_VISIVEIS_DEFAULT = ['nome', 'empresa', 'email1', 'celular', 'categoria'];

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
  const [qzConectado, setQzConectado] = useState(false);
  const [impressoras, setImpressoras] = useState<string[]>([]);
  const [impressoraPadrao, setImpressoraPadrao] = useState(
    () => localStorage.getItem('impressora.padrao') || '',
  );
  const [showImpressora, setShowImpressora] = useState(false);
  const [conectandoQz, setConectandoQz] = useState(false);
  const isWake = evento?.telaAutoAtendimento === 'wake';

  // Campos configuráveis
  const [camposCustom, setCamposCustom] = useState<string[]>([]);
  const [showConfigurarCampos, setShowConfigurarCampos] = useState(false);
  const [camposVisiveis, setCamposVisiveis] = useState<string[]>(() => {
    if (!eventId) return CAMPOS_VISIVEIS_DEFAULT;
    try {
      const saved = localStorage.getItem(`recepcao.campos.${eventId}`);
      return saved ? JSON.parse(saved) : CAMPOS_VISIVEIS_DEFAULT;
    } catch {
      return CAMPOS_VISIVEIS_DEFAULT;
    }
  });

  // Edição inline
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [salvando, setSalvando] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  // ===== Rede =====
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const conectarImpressora = async () => {
    if (!QZ_TRAY_ENABLED) return;
    try {
      setConectandoQz(true);
      const lista = await connectQz();
      setImpressoras(lista);
      setQzConectado(isQzConnected());
      setImpressoraPadrao((atual) => {
        const selecionada = selectQzPrinter(lista, atual);
        if (selecionada) localStorage.setItem('impressora.padrao', selecionada);
        else localStorage.removeItem('impressora.padrao');
        return selecionada;
      });
    } catch (error) {
      console.error('Erro ao conectar ao QZ Tray:', error);
      setQzConectado(false);
    } finally {
      setConectandoQz(false);
    }
  };

  useEffect(() => {
    conectarImpressora();
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

        // extrai campos personalizados do evento
        const custom = (ev?.camposPersonalizados || []).map((c: any) => c.nome as string);
        setCamposCustom(custom);

        const lista = await obterParticipantesPorEvento(eventId);
        setBaseParticipantes(lista || []);
        setParticipantes([]);
        setMsg(null);

        unsubscribe = subscribeParticipantesDoEvento(eventId, (arr) => {
          setBaseParticipantes(arr || []);
          if (termo.trim()) {
            const q = normalizeText(termo.trim());
            const codigosExatos = (arr || []).filter(
              (p: any) => normalizeText(p.codigoCliente) === q
            );
            setParticipantes(
              codigosExatos.length > 0 ? codigosExatos : (arr || []).filter((p: any) =>
                [p.nome, p.empresa, p.email1, p.email2, p.id, p.codigoCliente]
                  .map(normalizeText)
                  .some((v: string) => v.includes(q))
              )
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
    return () => { if (unsubscribe) unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // ===== Busca =====
  const executarBusca = async () => {
    if (!eventId) return;
    const q = normalizeText(termo.trim());
    if (!q) { setParticipantes([]); setMsg(null); return; }
    try {
      setBuscando(true);
      const codigosExatos = baseParticipantes.filter(
        (p) => normalizeText((p as any).codigoCliente) === q
      );
      const local = codigosExatos.length > 0
        ? codigosExatos
        : baseParticipantes.filter((p) =>
            [p.nome, p.empresa, (p as any).email1, (p as any).email2, p.id, (p as any).codigoCliente]
              .map(normalizeText)
              .some((v) => v.includes(q))
          );
      let remotos: Participante[] = [];
      if (online) {
        try { remotos = await buscarParticipantes(eventId, q); }
        catch (err) { console.warn('Busca remota falhou:', err); }
      }
      const res = remotos?.length ? remotos : local;
      setParticipantes(res);
      if (res.length > 0) setTermo('');
      setMsg(res.length ? null : { tipo: 'info', texto: online ? 'Nenhum participante encontrado.' : 'Sem rede: exibindo resultados locais.' });
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
    await reservarEtiquetaUmaVez(p.id, currentUser.uid);
    const iso = new Date().toISOString();
    setParticipantes((prev) => prev.map((x) => (x.id === p.id ? ({ ...x, etiquetaImpressaEm: iso } as any) : x)));
    setBaseParticipantes((prev) => prev.map((x) => (x.id === p.id ? ({ ...x, etiquetaImpressaEm: iso } as any) : x)));
  };

  const handleImprimir = async (p: Participante) => {
    try {
      await imprimirCracha(p);
      await reservarImpressao(p);
      setMsg({ tipo: 'success', texto: online ? 'Etiqueta enviada para impressão!' : 'Etiqueta registrada offline.' });
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
      setMsg({ tipo: 'success', texto: online ? 'Check-in realizado!' : 'Check-in registrado offline.' });
    } catch (e) {
      console.error(e);
      setMsg({ tipo: 'error', texto: 'Erro no check-in.' });
    }
  };

  const onScan = async (raw: string) => {
    if (!eventId) return;
    try {
      const codigoCliente = String(raw ?? '').trim();
      if (!codigoCliente) { setMsg({ tipo: 'error', texto: 'QR Code vazio.' }); return; }

      let participante: Participante | null =
        baseParticipantes.find(
          (p) => p.eventoId === eventId && String((p as any).codigoCliente ?? '').trim() === codigoCliente
        ) || null;

      if (!participante) {
        const ref = collection(db, 'participantes');
        let q = fsQuery(ref, where('eventoId', '==', eventId), where('codigoCliente', '==', codigoCliente));
        let qs = await getDocs(q);
        if (qs.empty && /^\d+$/.test(codigoCliente)) {
          q = fsQuery(ref, where('eventoId', '==', eventId), where('codigoCliente', '==', Number(codigoCliente)));
          qs = await getDocs(q);
        }
        if (!qs.empty) {
          const d = qs.docs[0];
          participante = { id: d.id, ...(d.data() as any) } as Participante;
        }
      }

      if (participante) {
        setParticipantes([participante]);
        setTermo('');
        setMsg(participante.status === 'credenciado'
          ? { tipo: 'info', texto: 'Participante já credenciado.' }
          : { tipo: 'success', texto: 'Participante localizado!' });
      } else {
        setMsg({ tipo: 'error', texto: `Nenhum participante com codigoCliente "${codigoCliente}" neste evento.` });
      }
    } catch (e) {
      console.error(e);
      setMsg({ tipo: 'error', texto: 'Falha ao ler QR Code.' });
    } finally {
      setShowScanner(false);
    }
  };

  const imprimirCracha = async (participante: Participante) => {
    if (!evento) return;
    const modelos = await obterModelosCrachaPorEvento(evento.id);
    const modeloPadrao = modelos.find((m) => m.padrao);
    if (!modeloPadrao) throw new Error('Modelo padrão não definido.');

    await printBadge({
      modelo: modeloPadrao,
      participante: participante as any,
      printerName: impressoraPadrao,
      qzConnected: qzConectado,
    });
  };

  // ===== Edição inline =====
  const getFieldValue = (p: Participante, campo: string): string => {
    if (camposCustom.includes(campo)) {
      return (p as any).camposPersonalizados?.[campo] ?? '';
    }
    return (p as any)[campo] ?? '';
  };

  const iniciarEdicao = (p: Participante) => {
    const vals: Record<string, any> = {};
    camposVisiveis.forEach((campo) => { vals[campo] = getFieldValue(p, campo); });
    setEditValues(vals);
    setEditandoId(p.id);
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setEditValues({});
  };

  const salvarEdicao = async (p: Participante) => {
    try {
      setSalvando(true);
      const updateObj: Record<string, any> = {};
      const novosCamposPersonalizados = { ...(p.camposPersonalizados || {}) };
      let hasCustom = false;

      for (const [campo, valor] of Object.entries(editValues)) {
        if (!camposVisiveis.includes(campo)) continue;
        if (camposCustom.includes(campo)) {
          novosCamposPersonalizados[campo] = valor;
          hasCustom = true;
        } else {
          updateObj[campo] = valor;
        }
      }
      if (hasCustom) updateObj.camposPersonalizados = novosCamposPersonalizados;

      await atualizarParticipante(p.id, updateObj as any);

      const atualizado: Participante = {
        ...p,
        ...updateObj,
        camposPersonalizados: novosCamposPersonalizados,
      };
      setParticipantes((prev) => prev.map((x) => (x.id === p.id ? atualizado : x)));
      setBaseParticipantes((prev) => prev.map((x) => (x.id === p.id ? atualizado : x)));
      cancelarEdicao();
      setMsg({ tipo: 'success', texto: 'Dados atualizados com sucesso.' });
    } catch (e) {
      console.error(e);
      setMsg({ tipo: 'error', texto: 'Erro ao salvar alterações.' });
    } finally {
      setSalvando(false);
    }
  };

  // ===== Persistir seleção de campos =====
  const toggleCampo = (campo: string, checked: boolean) => {
    const novos = checked
      ? [...camposVisiveis, campo]
      : camposVisiveis.filter((c) => c !== campo);
    setCamposVisiveis(novos);
    if (eventId) localStorage.setItem(`recepcao.campos.${eventId}`, JSON.stringify(novos));
  };

  // ===== Header =====
  const Header = () => (
    <div className="sticky top-0 z-20 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-gray-100">
      <div className={`max-w-6xl mx-auto px-4 ${isWake ? 'pt-5 pb-6' : 'py-4'}`}>
        <div className={isWake ? 'grid grid-cols-[1fr_auto_1fr] items-center' : 'flex items-center justify-between'}>
          {isWake ? (
            <>
              <span aria-hidden="true" />
              <img
                src="/brands/novo-wake-logo.jpeg"
                alt="Wake Lab"
                className="h-14 md:h-20 w-auto object-contain justify-self-center"
              />
            </>
          ) : (
            <h1 className="text-2xl md:text-3xl font-bold truncate">
              {evento ? evento.nome : 'Autoatendimento'}
            </h1>
          )}
          <div className={`flex items-center gap-2 ${isWake ? 'justify-self-end' : ''}`}>
            {!online && (
              <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Offline</span>
            )}
            {QZ_TRAY_ENABLED && !isWake && (
              <button
                onClick={() => setShowImpressora(true)}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50 text-sm"
                title="Configurar impressão direta"
              >
                {qzConectado && impressoraPadrao
                  ? <Wifi className="w-4 h-4 text-green-500" />
                  : <WifiOff className="w-4 h-4 text-gray-400" />}
                <span className="hidden sm:inline">Impressora</span>
              </button>
            )}
            <button
              onClick={() => setShowConfigurarCampos(true)}
              className={`inline-flex items-center gap-2 rounded-xl border hover:bg-gray-50 ${isWake ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}
              title="Configurar campos visíveis"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Campos</span>
            </button>
            {evento && (
              <button
                onClick={() => setShowScanner(true)}
                className={`inline-flex items-center gap-2 rounded-xl border hover:bg-gray-50 ${isWake ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2'}`}
                title="Ler QR Code"
              >
                <QrCode className="w-5 h-5" /> <span className="hidden md:inline">QR Code</span>
              </button>
            )}
          </div>
        </div>

        <div className={isWake ? 'mt-7' : 'mt-4'}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
            <input
              ref={searchRef}
              autoFocus
              value={termo}
              onChange={(e) => {
                setTermo(e.target.value);
                requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  executarBusca().finally(() => {
                    const el = searchRef.current;
                    if (el) {
                      el.focus({ preventScroll: true });
                      try { el.setSelectionRange(el.value.length, el.value.length); } catch {}
                    }
                  });
                }
              }}
              placeholder="DIGITE SEU E-MAIL OU ESCANEIE SEU QR-CODE"
              className={`w-full pl-14 pr-12 py-4 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 text-lg ${isWake ? 'border-2 border-gray-900' : 'border border-gray-200'}`}
            />
            {!!termo && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setTermo(''); setParticipantes([]); setMsg(null); searchRef.current?.focus({ preventScroll: true }); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            )}
          </div>
          <div className="mt-2 text-sm text-gray-500 flex items-center gap-2 min-h-[1.25rem]">
            {buscando && <><Loader2 className="w-4 h-4 animate-spin" /> <span>Buscando...</span></>}
            {!buscando && termo.trim() && participantes.length > 0 && <span>{participantes.length} resultado(s)</span>}
          </div>
        </div>
      </div>
    </div>
  );

  // ===== Card do participante =====
  const Linha = ({ p }: { p: Participante }) => {
    const isEditing = editandoId === p.id;

    const statusClass =
      p.status === 'credenciado' ? 'bg-green-50 text-green-700 border-green-200'
      : p.status === 'confirmado' ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-gray-50 text-gray-700 border-gray-200';

    return (
      <div className="rounded-2xl bg-white border border-gray-100 p-4 md:p-5 shadow-sm hover:shadow transition">
        {/* Linha superior: categoria + nome + ações */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className={`${isWake ? 'w-5 h-5' : 'w-3 h-3'} rounded-full shrink-0`} style={{ backgroundColor: (p as any).corCategoria || '#9CA3AF' }} />
              <span className={`${isWake ? 'text-sm font-semibold' : 'text-xs'} uppercase tracking-wide text-gray-500`}>{p.categoria || '—'}</span>
            </div>
            <h3 className="mt-1 text-lg md:text-xl font-semibold">{p.nome}</h3>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <span className={`px-2.5 py-1 text-xs rounded-full border ${statusClass}`}>
              {STATUS_LABEL[p.status] || p.status}
            </span>

            {isEditing ? (
              <>
                <button
                  onClick={() => salvarEdicao(p)}
                  disabled={salvando}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 text-white px-3 py-2 text-sm hover:bg-green-700 disabled:opacity-60"
                >
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar
                </button>
                <button
                  onClick={cancelarEdicao}
                  className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <X className="w-4 h-4" /> Cancelar
                </button>
                {!isWake && (
                  <button
                    onClick={() => navigate(`/operador/participantes/${p.eventoId}/${p.id}/editar`)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 text-blue-700 px-3 py-2 text-sm hover:bg-blue-50"
                  >
                    <UserCog className="w-4 h-4" /> Editar Cadastro
                  </button>
                )}
              </>
            ) : (
              <>
                {p.status !== 'credenciado' && (
                  <button
                    onClick={() => handleCheckin(p)}
                    className={`inline-flex items-center justify-center gap-2 text-white transition-colors ${
                      isWake
                        ? 'w-full sm:w-auto rounded-2xl bg-green-600 px-8 py-4 text-lg font-bold shadow-lg ring-4 ring-green-100 hover:bg-green-700'
                        : 'rounded-xl bg-blue-600 px-3 py-2 hover:bg-blue-700'
                    }`}
                  >
                    <CheckCircle2 className={isWake ? 'w-6 h-6' : 'w-4 h-4'} /> Check-in
                  </button>
                )}
                {!isWake && (
                  <button
                    onClick={() => setConfirmando(p)}
                    disabled={!podeImprimir(p)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 ${podeImprimir(p) ? 'hover:bg-gray-50' : 'opacity-60 cursor-not-allowed'}`}
                    title={podeImprimir(p) ? 'Imprimir etiqueta' : 'Etiqueta já impressa'}
                  >
                    <Printer className="w-4 h-4" /> Etiqueta
                  </button>
                )}
                {camposVisiveis.length > 0 && (
                  <button
                    onClick={() => iniciarEdicao(p)}
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-200 text-amber-700 px-3 py-2 hover:bg-amber-50"
                  >
                    <Pencil className="w-4 h-4" /> Editar
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Campos configuráveis */}
        {camposVisiveis.length > 0 && (
          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 pt-3 border-t border-gray-50">
            {camposVisiveis.map((campo) => (
              <div key={campo}>
                <dt className="text-xs text-gray-400 uppercase tracking-wide">
                  {LABEL_CAMPO[campo] || campo}
                </dt>
                {isEditing ? (
                  <input
                    value={editValues[campo] ?? ''}
                    onChange={(e) => setEditValues((prev) => ({ ...prev, [campo]: e.target.value }))}
                    className="mt-0.5 w-full text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-1 focus:ring-blue-300 focus:border-blue-400"
                  />
                ) : (
                  <dd className="text-sm text-gray-800 truncate">{getFieldValue(p, campo) || '—'}</dd>
                )}
              </div>
            ))}
          </dl>
        )}

        {(p as any).etiquetaImpressaEm && (
          <div className="mt-3 inline-flex items-center text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full">
            <BadgeCheck className="w-4 h-4 mr-1" /> Etiqueta impressa
          </div>
        )}
      </div>
    );
  };

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

  if (!evento || !isWake) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-gray-900">
            {evento ? 'Autoatendimento não configurado' : 'Evento não encontrado'}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {evento
              ? 'Este evento não possui uma tela de autoatendimento selecionada.'
              : 'Não foi possível localizar o evento informado.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
        {msg && (
          <div className={`mb-4 rounded-xl px-4 py-3 text-sm ${
            msg.tipo === 'success' ? 'bg-green-50 text-green-700'
            : msg.tipo === 'error' ? 'bg-red-50 text-red-700'
            : 'bg-yellow-50 text-yellow-700'
          }`}>
            {msg.texto}
          </div>
        )}

        {participantes.length === 0 ? (
          <div className="rounded-2xl border border-dashed text-center p-14 text-gray-500 bg-white">
            Nenhum participante para exibir. Digite e pressione Enter/Tab para buscar.
          </div>
        ) : (
          <div className="grid gap-3 md:gap-4">
            {participantes.map((p) => <Linha key={p.id} p={p} />)}
          </div>
        )}
      </div>

      {/* FAB QR Code */}
      {evento && (
        <button
          onClick={() => setShowScanner(true)}
          className="fixed bottom-6 right-6 md:bottom-8 md:right-8 rounded-full shadow-lg bg-blue-600 text-white p-4 hover:bg-blue-700 focus:outline-none"
          aria-label="Ler QR Code"
        >
          <QrCode className="w-6 h-6" />
        </button>
      )}

      {/* Modal: Configurar campos visíveis */}
      {showImpressora && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold">Impressão direta</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {qzConectado ? 'QZ Tray conectado' : 'QZ Tray não disponível'}
                </p>
              </div>
              <button onClick={() => setShowImpressora(false)} className="p-2 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              {qzConectado ? (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Impressora padrão</label>
                  <select
                    value={impressoraPadrao}
                    onChange={(e) => {
                      setImpressoraPadrao(e.target.value);
                      localStorage.setItem('impressora.padrao', e.target.value);
                    }}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2"
                  >
                    {impressoras.length === 0 && <option value="">Nenhuma impressora encontrada</option>}
                    {impressoras.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
                  </select>
                  <p className="text-xs text-gray-500 mt-2">
                    Esta impressora será usada diretamente, sem abrir a caixa de diálogo do navegador.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    Abra o QZ Tray neste computador e autorize a conexão. Sem ele, será usada a impressão do navegador.
                  </p>
                  <button
                    onClick={conectarImpressora}
                    disabled={conectandoQz}
                    className="rounded-xl border px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {conectandoQz ? 'Conectando...' : 'Tentar novamente'}
                  </button>
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button onClick={() => setShowImpressora(false)} className="rounded-xl bg-blue-600 text-white px-5 py-2">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Configurar campos visíveis */}
      {showConfigurarCampos && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 pt-6 pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold">Campos visíveis na recepção</h3>
                <p className="text-sm text-gray-500 mt-0.5">Selecione quais dados aparecem em cada cartão.</p>
              </div>
              <button onClick={() => setShowConfigurarCampos(false)} className="p-2 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-4 space-y-1 flex-1">
              {camposCustom.length > 0 && (
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Campos padrão</p>
              )}
              {CAMPOS_PADRAO_LISTA.map((campo) => (
                <label key={campo} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={camposVisiveis.includes(campo)}
                    onChange={(e) => toggleCampo(campo, e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{LABEL_CAMPO[campo] || campo}</span>
                </label>
              ))}

              {camposCustom.length > 0 && (
                <>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mt-4 mb-2">Campos personalizados</p>
                  {camposCustom.map((campo) => (
                    <label key={campo} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={camposVisiveis.includes(campo)}
                        onChange={(e) => toggleCampo(campo, e.target.checked)}
                        className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{campo}</span>
                      <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">personalizado</span>
                    </label>
                  ))}
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
              <span className="text-sm text-gray-500">{camposVisiveis.length} campo(s) selecionado(s)</span>
              <button
                onClick={() => setShowConfigurarCampos(false)}
                className="rounded-xl bg-blue-600 text-white px-5 py-2 text-sm hover:bg-blue-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Scanner */}
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

      {/* Modal: confirmação etiqueta */}
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
                onClick={async () => { const alvo = confirmando; setConfirmando(null); if (alvo) await handleImprimir(alvo); }}
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
