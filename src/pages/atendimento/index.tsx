import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Search, QrCode, Printer, CheckCircle2, BadgeCheck,
  Loader2, X, AlertTriangle, Settings, Pencil, Save, UserCog, UserPlus,
  MessageSquareText,
} from 'lucide-react';
import QrCodeScanner from '../../components/qrcode/QrCodeScanner';
import { useAuth } from '../../contexts/AuthContext';
import { Evento, Participante } from '../../models/types';
import { obterEventoPorId } from '../../services/eventoService';
import {
  fazerCheckin,
  atualizarParticipante,
  criarParticipante,
  obterParticipantesPorEvento,
  reservarEtiquetaUmaVez,
  subscribeParticipantesDoEvento,
} from '../../services/participanteService';
import { obterModelosCrachaPorEvento } from '../../services/modeloService';
import { normalizeText } from '../../utils/textUtils';
import { collection, doc, query as fsQuery, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { printBadge } from '../../utils/qzPrintUtils';

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

const CAMPOS_CADASTRO_LISTA = [
  'nome', 'nomeCracha', 'empresa', 'empresaCracha', 'cargo',
  'email1', 'email2', 'celular', 'telefone', 'categoria',
  'cpf', 'rg', 'cnpj',
  'opcao1', 'opcao2', 'opcao3', 'opcao4', 'opcao5',
  'opcao6', 'opcao7', 'opcao8', 'opcao9', 'opcao10',
  'observacao',
];

const CAMPOS_CADASTRO_DEFAULT = ['nome', 'nomeCracha', 'empresa', 'email1', 'telefone', 'categoria'];

const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine);

const filtrarParticipantes = (lista: Participante[], termo: string) => {
  const q = normalizeText(termo.trim());
  if (!q) return [];

  const codigosExatos = lista.filter((p) => normalizeText(p.codigoCliente) === q);
  if (codigosExatos.length > 0) return codigosExatos;

  return lista.filter((p) =>
    [p.nome, p.nomeCracha, p.email1, p.email2]
      .map(normalizeText)
      .some((valor) => valor.includes(q)),
  );
};

const filtrarParticipantesWake = (lista: Participante[], termo: string) => {
  const q = normalizeText(termo.trim());
  if (!q) return [];

  return lista.filter((p) =>
    [p.nome, p.email1, p.email2]
      .map((valor) => normalizeText(valor).trim())
      .some((valor) => valor.includes(q)),
  );
};

const normalizeCategory = (valor: string) => valor.trim().toUpperCase();

const stableColorFromString = (valor: string) => {
  if (!valor) return '#cccccc';
  let hash = 0;
  for (let i = 0; i < valor.length; i += 1) {
    hash = valor.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 55%, 75%)`;
};

type ValorCampoCadastro = string | boolean;

const criarNovoParticipanteInicial = (): Record<string, ValorCampoCadastro> =>
  Object.fromEntries(CAMPOS_CADASTRO_LISTA.map((campo) => [campo, '']));

const emailCorrespondeExatamente = (p: Participante, termo: string) => {
  const q = normalizeText(termo.trim());
  return [p.email1, p.email2].map(normalizeText).some((email) => email === q);
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
  const [online, setOnline] = useState<boolean>(isOnline());
  const [checkinEmAndamento, setCheckinEmAndamento] = useState<string | null>(null);
  const [impressaoEmAndamento, setImpressaoEmAndamento] = useState<string | null>(null);
  const [showNovoParticipante, setShowNovoParticipante] = useState(false);
  const [novoParticipante, setNovoParticipante] = useState<Record<string, ValorCampoCadastro>>(criarNovoParticipanteInicial);
  const [showConfigurarCamposCadastro, setShowConfigurarCamposCadastro] = useState(false);
  const [camposCadastroVisiveis, setCamposCadastroVisiveis] = useState<string[]>(() => {
    if (!eventId) return CAMPOS_CADASTRO_DEFAULT;
    try {
      const saved = localStorage.getItem(`autoatendimento.cadastro.campos.${eventId}`);
      return saved ? JSON.parse(saved) : CAMPOS_CADASTRO_DEFAULT;
    } catch {
      return CAMPOS_CADASTRO_DEFAULT;
    }
  });
  const [salvandoNovoParticipante, setSalvandoNovoParticipante] = useState(false);
  const [participanteObservacao, setParticipanteObservacao] = useState<Participante | null>(null);
  const isWake = evento?.telaAutoAtendimento === 'wake';
  const usaTemaAutoAtendimento = evento?.telaAutoAtendimento === 'default' || isWake;

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
  const novoParticipanteModalRef = useRef<HTMLDivElement>(null);
  const camposCadastroModalRef = useRef<HTMLDivElement>(null);

  const fecharNovoParticipante = () => {
    setShowConfigurarCamposCadastro(false);
    setShowNovoParticipante(false);
    window.setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 0);
  };

  useEffect(() => {
    if (!showNovoParticipante) return;

    const handleEscape = (event: KeyboardEvent) => {
      const modalAtivo = showConfigurarCamposCadastro
        ? camposCadastroModalRef.current
        : novoParticipanteModalRef.current;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (showConfigurarCamposCadastro) {
          setShowConfigurarCamposCadastro(false);
          window.setTimeout(() => {
            novoParticipanteModalRef.current
              ?.querySelector<HTMLElement>('[data-abrir-campos-cadastro]')
              ?.focus();
          }, 0);
        } else {
          setShowNovoParticipante(false);
          window.setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 0);
        }
        return;
      }

      if (event.key !== 'Tab' || !modalAtivo) return;
      const elementos = Array.from(modalAtivo.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((elemento) => elemento.offsetParent !== null);
      if (elementos.length === 0) return;

      const primeiro = elementos[0];
      const ultimo = elementos[elementos.length - 1];
      if (!modalAtivo.contains(document.activeElement)) {
        event.preventDefault();
        primeiro.focus();
      } else if (event.shiftKey && document.activeElement === primeiro) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primeiro.focus();
      }
    };

    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [showNovoParticipante, showConfigurarCamposCadastro]);

  useEffect(() => {
    if (!showConfigurarCamposCadastro) return;
    window.requestAnimationFrame(() => {
      camposCadastroModalRef.current
        ?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled])')
        ?.focus();
    });
  }, [showConfigurarCamposCadastro]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      searchRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const categoriasEvento = useMemo(() => Array.from(new Set([
    ...Object.keys(evento?.coresCategorias || {}),
    ...baseParticipantes.map((p) => normalizeCategory(p.categoria || '')).filter(Boolean),
  ])).sort((a, b) => a.localeCompare(b)), [evento?.coresCategorias, baseParticipantes]);

  const camposCadastroDisponiveis = useMemo(() => [
    ...CAMPOS_CADASTRO_LISTA,
    ...(evento?.camposPersonalizados || []).map((campo) => `cp:${campo.id}`),
  ], [evento?.camposPersonalizados]);

  // ===== Rede =====
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
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
      const res = isWake
        ? filtrarParticipantesWake(baseParticipantes, q)
        : filtrarParticipantes(baseParticipantes, q);
      setParticipantes(res);
      if (res.length > 0 && !isWake) setTermo('');
      setMsg(res.length ? null : { tipo: 'info', texto: online ? 'Nenhum participante encontrado.' : 'Sem rede: exibindo resultados locais.' });
    } catch (e) {
      console.error(e);
      setMsg({ tipo: 'error', texto: 'Falha na busca. Tente novamente.' });
    } finally {
      setBuscando(false);
    }
  };

  useEffect(() => {
    if (isWake) return;

    const valor = termo.trim();
    if (!valor) return;

    const timeoutId = window.setTimeout(() => {
      const resultados = filtrarParticipantes(baseParticipantes, valor);
      const emailsExatos = resultados.filter((p) => emailCorrespondeExatamente(p, valor));

      setParticipantes(emailsExatos.length > 0 ? emailsExatos : resultados);
      setMsg(null);
      setBuscando(false);

      if (emailsExatos.length > 0) setTermo('');
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [termo, baseParticipantes, isWake]);

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
      setMsg({ tipo: 'success', texto: online ? 'Janela de impressão aberta!' : 'Etiqueta registrada offline.' });
    } catch (e: any) {
      console.error(e);
      setMsg({ tipo: 'error', texto: e?.message || 'Erro ao imprimir etiqueta.' });
    }
  };

  const handleReimprimir = async (p: Participante) => {
    if (impressaoEmAndamento) return;

    try {
      setImpressaoEmAndamento(p.id);
      await imprimirCracha(p);
      setMsg({ tipo: 'success', texto: 'Janela de impressão aberta novamente!' });
    } catch (e: unknown) {
      console.error(e);
      setMsg({
        tipo: 'error',
        texto: e instanceof Error ? e.message : 'Erro ao reimprimir credencial.',
      });
    } finally {
      setImpressaoEmAndamento(null);
    }
  };

  const handleCadastrarParticipante = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !currentUser?.uid || salvandoNovoParticipante) return;

    try {
      setSalvandoNovoParticipante(true);
      const textoCampo = (campo: string) => String(novoParticipante[campo] ?? '').trim();
      const categoria = normalizeCategory(textoCampo('categoria'));
      const participante: Omit<Participante, 'id' | 'criadoEm' | 'atualizadoEm'> = {
        eventoId: eventId,
        nome: textoCampo('nome'),
        nomeCracha: textoCampo('nomeCracha') || textoCampo('nome'),
        empresa: textoCampo('empresa'),
        empresaCracha: textoCampo('empresaCracha') || textoCampo('empresa'),
        cargo: textoCampo('cargo'),
        email1: textoCampo('email1'),
        email2: textoCampo('email2'),
        celular: textoCampo('celular') || textoCampo('telefone'),
        telefone: textoCampo('telefone'),
        categoria,
        observacao: textoCampo('observacao'),
        cpf: textoCampo('cpf'),
        rg: textoCampo('rg'),
        cnpj: textoCampo('cnpj'),
        codigoCliente: '',
        opcao1: textoCampo('opcao1'), opcao2: textoCampo('opcao2'),
        opcao3: textoCampo('opcao3'), opcao4: textoCampo('opcao4'),
        opcao5: textoCampo('opcao5'), opcao6: textoCampo('opcao6'),
        opcao7: textoCampo('opcao7'), opcao8: textoCampo('opcao8'),
        opcao9: textoCampo('opcao9'), opcao10: textoCampo('opcao10'),
        status: 'pendente',
        criadoPorId: currentUser.uid,
        camposPersonalizados: Object.fromEntries(
          (evento?.camposPersonalizados || []).map((campo) => [
            campo.id,
            novoParticipante[`cp:${campo.id}`] ?? '',
          ]),
        ),
        corCategoria: evento?.coresCategorias?.[categoria]
          || baseParticipantes.find((p) => normalizeCategory(p.categoria) === categoria)?.corCategoria
          || stableColorFromString(categoria),
      };

      const participanteId = await criarParticipante(participante);
      await updateDoc(doc(db, 'participantes', participanteId), { codigoCliente: participanteId });

      const participanteCriado: Participante = {
        ...participante,
        id: participanteId,
        codigoCliente: participanteId,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };

      setBaseParticipantes((prev) => [participanteCriado, ...prev]);
      setParticipantes([participanteCriado]);
      setNovoParticipante(criarNovoParticipanteInicial());
      setShowNovoParticipante(false);
      setTermo('');
      setMsg({ tipo: 'success', texto: 'Participante cadastrado com sucesso! Agora você pode realizar o check-in.' });
    } catch (e) {
      console.error(e);
      setMsg({ tipo: 'error', texto: 'Erro ao cadastrar participante. Tente novamente.' });
    } finally {
      setSalvandoNovoParticipante(false);
    }
  };

  const handleCheckin = async (p: Participante) => {
    if (checkinEmAndamento) return;

    let checkinRealizado = false;
    try {
      setCheckinEmAndamento(p.id);

      await fazerCheckin(p.id);
      checkinRealizado = true;
      const up = { ...p, status: 'credenciado' as const };
      setBaseParticipantes((prev) => prev.map((x) => (x.id === p.id ? up : x)));

      try {
        await imprimirCracha(up);
        if (podeImprimir(p)) {
          await reservarImpressao(up);
        }
      } catch (e: unknown) {
        console.error(e);
        const detalhe = e instanceof Error ? e.message : 'erro desconhecido.';
        setTermo('');
        setParticipantes([]);
        setMsg({
          tipo: 'error',
          texto: `Check-in realizado, mas não foi possível abrir a impressão: ${detalhe}`,
        });
        return;
      }

      setTermo('');
      setParticipantes([]);
      setMsg({
        tipo: 'success',
        texto: 'CHECK-IN REALIZADO COM SUCESSO! DESEJAMOS UM EXCELENTE EVENTO!',
      });
    } catch (e: unknown) {
      console.error(e);
      const detalhe = e instanceof Error ? e.message : 'Erro desconhecido.';
      setMsg({
        tipo: 'error',
        texto: checkinRealizado
          ? `Check-in realizado, mas não foi possível abrir a impressão: ${detalhe}`
          : detalhe,
      });
    } finally {
      setCheckinEmAndamento(null);
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

  const toggleCampoCadastro = (campo: string, checked: boolean) => {
    if (campo === 'nome' || campo === 'categoria') return;
    const novos = checked
      ? [...camposCadastroVisiveis, campo]
      : camposCadastroVisiveis.filter((item) => item !== campo);
    setCamposCadastroVisiveis(novos);
    if (eventId) {
      localStorage.setItem(`autoatendimento.cadastro.campos.${eventId}`, JSON.stringify(novos));
    }
  };

  const labelCampoCadastro = (campo: string) => {
    if (campo.startsWith('cp:')) {
      const campoId = campo.slice(3);
      return evento?.camposPersonalizados?.find((item) => item.id === campoId)?.nome || campoId;
    }
    return evento?.labelsOpcoes?.[campo] || LABEL_CAMPO[campo] || campo;
  };

  // ===== Header =====
  const renderHeader = () => (
    <div className="sticky top-0 z-20 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b border-gray-100">
      <div className={`max-w-6xl mx-auto px-4 ${usaTemaAutoAtendimento ? 'pt-5 pb-6' : 'py-4'}`}>
        <div className={usaTemaAutoAtendimento ? 'grid grid-cols-[1fr_auto_1fr] items-center' : 'flex items-center justify-between'}>
          {usaTemaAutoAtendimento ? (
            <>
              <span aria-hidden="true" />
              {isWake ? (
                <img
                  src="/brands/novo-wake-logo.jpeg"
                  alt="Wake Lab"
                  className="h-14 md:h-20 w-auto object-contain justify-self-center"
                />
              ) : (
                <div className="relative h-20 w-52 sm:h-24 sm:w-72 md:h-32 md:w-96 overflow-hidden justify-self-center">
                  <img
                    src="/brands/in-trada-autoatendimento.png"
                    alt="IN-TRADA"
                    className="absolute left-1/2 top-1/2 w-full max-w-none -translate-x-1/2 -translate-y-1/2 scale-125"
                  />
                </div>
              )}
            </>
          ) : (
            <h1 className="text-2xl md:text-3xl font-bold truncate">
              {evento ? evento.nome : 'Autoatendimento'}
            </h1>
          )}
          <div className={`flex items-center gap-2 ${usaTemaAutoAtendimento ? 'justify-self-end' : ''}`}>
            {!online && (
              <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Offline</span>
            )}
            <button
              onClick={() => setShowConfigurarCampos(true)}
              className={`inline-flex items-center gap-2 rounded-xl border hover:bg-gray-50 ${usaTemaAutoAtendimento ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}
              title="Configurar campos visíveis"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Campos</span>
            </button>
            {evento && (
              <button
                onClick={() => setShowScanner(true)}
                className={`inline-flex items-center gap-2 rounded-xl border hover:bg-gray-50 ${usaTemaAutoAtendimento ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2'}`}
                title="Ler QR Code"
              >
                <QrCode className="w-5 h-5" /> <span className="hidden md:inline">QR Code</span>
              </button>
            )}
          </div>
        </div>

        <div className={usaTemaAutoAtendimento ? 'mt-7' : 'mt-4'}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
            <input
              ref={searchRef}
              disabled={showNovoParticipante}
              value={termo}
              onChange={(e) => {
                const valor = e.target.value;
                setTermo(valor);
                setParticipantes([]);
                setMsg(null);
                setBuscando(isWake ? false : Boolean(valor.trim()));
                requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || (!isWake && e.key === 'Tab')) {
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
              placeholder={isWake ? 'DIGITE SEU NOME OU E-MAIL' : 'DIGITE SEU NOME OU E-MAIL, OU ESCANEIE SEU QR-CODE'}
              className={`w-full pl-14 ${isWake ? 'pr-40' : 'pr-12'} py-4 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 text-lg ${usaTemaAutoAtendimento ? 'border-2 border-gray-900' : 'border border-gray-200'}`}
            />
            {!!termo && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setTermo(''); setParticipantes([]); setMsg(null); searchRef.current?.focus({ preventScroll: true }); }}
                className={`absolute ${isWake ? 'right-28' : 'right-3'} top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-gray-100`}
                aria-label="Limpar busca"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            )}
            {isWake && (
              <button
                type="button"
                onClick={executarBusca}
                disabled={!termo.trim() || buscando}
                className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {buscando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                Buscar
              </button>
            )}
          </div>
          <div className="mt-2 text-sm text-gray-500 flex items-center gap-2 min-h-[1.25rem]">
            {buscando && <><Loader2 className="w-4 h-4 animate-spin" /> <span>Buscando...</span></>}
          </div>
          {!isWake && evento && (
            <button
              type="button"
              onClick={() => setShowNovoParticipante(true)}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-50"
            >
              <UserPlus className="w-5 h-5" /> Novo participante
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // ===== Card do participante =====
  const renderLinha = (p: Participante) => {
    const isEditing = editandoId === p.id;

    const statusClass =
      p.status === 'credenciado' ? 'bg-green-50 text-green-700 border-green-200'
      : p.status === 'confirmado' ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-gray-50 text-gray-700 border-gray-200';

    return (
      <div key={p.id} className="rounded-2xl bg-white border border-gray-100 p-4 md:p-5 shadow-sm hover:shadow transition">
        {/* Linha superior: categoria + nome + ações */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className={`${usaTemaAutoAtendimento ? 'w-5 h-5' : 'w-3 h-3'} rounded-full shrink-0`} style={{ backgroundColor: (p as any).corCategoria || '#9CA3AF' }} />
              <span className={`${usaTemaAutoAtendimento ? 'text-sm font-semibold' : 'text-xs'} uppercase tracking-wide text-gray-500`}>{p.categoria || '—'}</span>
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
                {!usaTemaAutoAtendimento && (
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
                    disabled={checkinEmAndamento !== null}
                    className={`inline-flex items-center justify-center gap-2 text-white transition-colors ${
                      usaTemaAutoAtendimento
                        ? 'w-full sm:w-auto rounded-2xl bg-green-600 px-8 py-4 text-lg font-bold shadow-lg ring-4 ring-green-100 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60'
                        : 'rounded-xl bg-blue-600 px-3 py-2 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60'
                    }`}
                  >
                    {checkinEmAndamento === p.id
                      ? <Loader2 className={`${usaTemaAutoAtendimento ? 'w-6 h-6' : 'w-4 h-4'} animate-spin`} />
                      : <CheckCircle2 className={usaTemaAutoAtendimento ? 'w-6 h-6' : 'w-4 h-4'} />}
                    {checkinEmAndamento === p.id ? 'Realizando check-in...' : 'Check-in'}
                  </button>
                )}
                {!isWake && p.status === 'credenciado' && (
                  <button
                    onClick={() => handleReimprimir(p)}
                    disabled={impressaoEmAndamento !== null}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-base font-bold text-white shadow-md hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {impressaoEmAndamento === p.id
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : <Printer className="w-5 h-5" />}
                    {impressaoEmAndamento === p.id ? 'Reimprimindo...' : 'Imprimir novamente'}
                  </button>
                )}
                {!usaTemaAutoAtendimento && (
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
                {p.observacao?.trim() && (
                  <button
                    type="button"
                    onClick={() => setParticipanteObservacao(p)}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2 font-medium text-red-700 shadow-sm transition-colors hover:bg-red-100"
                    title="Este participante possui uma observação"
                  >
                    <MessageSquareText className="w-4 h-4" /> Observação
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
        {renderHeader()}
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
        {renderHeader()}
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

  if (!evento || !usaTemaAutoAtendimento) {
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
      {renderHeader()}

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

        {participantes.length > 0 && (
          <div className="grid gap-3 md:gap-4">
            {participantes.map(renderLinha)}
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

      {/* Modal: novo participante */}
      {showNovoParticipante && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div ref={novoParticipanteModalRef} className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-semibold">Novo participante</h3>
                <p className="mt-1 text-sm text-gray-500">Cadastre o participante e faça o check-in em seguida.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowConfigurarCamposCadastro(true)}
                  data-abrir-campos-cadastro
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Campos visíveis</span>
                </button>
                <button
                  type="button"
                  onClick={fecharNovoParticipante}
                  className="p-2 rounded-full hover:bg-gray-100"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleCadastrarParticipante} className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {camposCadastroDisponiveis
                  .filter((campo) => {
                    const personalizadoObrigatorio = campo.startsWith('cp:') && Boolean(
                      evento?.camposPersonalizados?.find((item) => item.id === campo.slice(3))?.obrigatorio,
                    );
                    return camposCadastroVisiveis.includes(campo)
                      || campo === 'nome'
                      || campo === 'categoria'
                      || personalizadoObrigatorio;
                  })
                  .map((campo) => {
                    const obrigatorio = campo === 'nome' || campo === 'categoria';
                    const campoPersonalizado = campo.startsWith('cp:')
                      ? evento?.camposPersonalizados?.find((item) => item.id === campo.slice(3))
                      : undefined;
                    const classeLabel = `${campo === 'nome' || campo === 'categoria' || campo === 'observacao' ? 'sm:col-span-2 ' : ''}text-sm font-medium text-gray-700`;
                    const atualizarValor = (valor: ValorCampoCadastro) => setNovoParticipante((prev) => ({ ...prev, [campo]: valor }));

                    if (campo === 'categoria') {
                      return (
                        <label key={campo} className={classeLabel}>
                          Categoria *
                          <input
                            required
                            list="categorias-autoatendimento"
                            value={String(novoParticipante[campo] ?? '')}
                            onChange={(e) => atualizarValor(e.target.value.toUpperCase())}
                            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal uppercase"
                          />
                          <datalist id="categorias-autoatendimento">
                            {categoriasEvento.map((categoria) => <option key={categoria} value={categoria} />)}
                          </datalist>
                        </label>
                      );
                    }

                    if (campoPersonalizado?.tipo === 'checkbox') {
                      return (
                        <label key={campo} className={`${classeLabel} flex items-center gap-2 pt-7`}>
                          <input
                            type="checkbox"
                            checked={Boolean(novoParticipante[campo])}
                            onChange={(e) => atualizarValor(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600"
                          />
                          {labelCampoCadastro(campo)}
                        </label>
                      );
                    }

                    if (campoPersonalizado?.tipo === 'selecao') {
                      return (
                        <label key={campo} className={classeLabel}>
                          {labelCampoCadastro(campo)} {campoPersonalizado.obrigatorio ? '*' : ''}
                          <select
                            required={campoPersonalizado.obrigatorio}
                            value={String(novoParticipante[campo] ?? '')}
                            onChange={(e) => atualizarValor(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal"
                          >
                            <option value="">Selecione uma opção</option>
                            {(campoPersonalizado.opcoes || []).map((opcao) => <option key={opcao} value={opcao}>{opcao}</option>)}
                          </select>
                        </label>
                      );
                    }

                    if (campo === 'observacao') {
                      return (
                        <label key={campo} className={classeLabel}>
                          {labelCampoCadastro(campo)}
                          <textarea
                            rows={3}
                            value={String(novoParticipante[campo] ?? '')}
                            onChange={(e) => atualizarValor(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal"
                          />
                        </label>
                      );
                    }

                    const tipo = campoPersonalizado?.tipo === 'numero'
                      ? 'number'
                      : campoPersonalizado?.tipo === 'data'
                        ? 'date'
                        : campo === 'email1' || campo === 'email2'
                          ? 'email'
                          : campo === 'telefone' || campo === 'celular'
                            ? 'tel'
                            : 'text';
                    const campoObrigatorio = obrigatorio || Boolean(campoPersonalizado?.obrigatorio);

                    return (
                      <label key={campo} className={classeLabel}>
                        {campo === 'nome' ? 'Nome completo' : labelCampoCadastro(campo)} {campoObrigatorio ? '*' : ''}
                        <input
                          autoFocus={campo === 'nome'}
                          required={campoObrigatorio}
                          type={tipo}
                          value={String(novoParticipante[campo] ?? '')}
                          onChange={(e) => atualizarValor(e.target.value)}
                          placeholder={campo === 'nomeCracha' ? 'Se vazio, usa o nome completo' : undefined}
                          className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal"
                        />
                      </label>
                    );
                  })}
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={fecharNovoParticipante}
                  className="rounded-xl border px-4 py-2.5 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoNovoParticipante}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {salvandoNovoParticipante
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : <UserPlus className="w-5 h-5" />}
                  {salvandoNovoParticipante ? 'Cadastrando...' : 'Cadastrar participante'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: campos visíveis no cadastro rápido */}
      {showNovoParticipante && showConfigurarCamposCadastro && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div
            ref={camposCadastroModalRef}
            className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[85vh]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-campos-cadastro"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 id="titulo-campos-cadastro" className="text-lg font-semibold">Campos visíveis no cadastro</h3>
                <p className="mt-0.5 text-sm text-gray-500">Nome e categoria são obrigatórios.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigurarCamposCadastro(false)}
                className="p-2 rounded-full hover:bg-gray-100"
                aria-label="Fechar campos visíveis"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-4 space-y-1 flex-1">
              {camposCadastroDisponiveis.map((campo) => {
                const fixo = campo === 'nome'
                  || campo === 'categoria'
                  || Boolean(
                    campo.startsWith('cp:')
                    && evento?.camposPersonalizados?.find((item) => item.id === campo.slice(3))?.obrigatorio,
                  );
                return (
                  <label key={campo} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fixo || camposCadastroVisiveis.includes(campo)}
                      disabled={fixo}
                      onChange={(e) => toggleCampoCadastro(campo, e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 disabled:opacity-60"
                    />
                    <span className="text-sm text-gray-700">{labelCampoCadastro(campo)}</span>
                    {campo.startsWith('cp:') && (
                      <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">personalizado</span>
                    )}
                    {fixo && <span className="ml-auto text-xs text-gray-400">obrigatório</span>}
                  </label>
                );
              })}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowConfigurarCamposCadastro(false)}
                className="rounded-xl bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: observação do participante */}
      {participanteObservacao && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-observacao-autoatendimento"
        >
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 id="titulo-observacao-autoatendimento" className="text-lg font-semibold">Observação</h3>
                <p className="mt-0.5 text-sm text-gray-500">{participanteObservacao.nome}</p>
              </div>
              <button
                type="button"
                onClick={() => setParticipanteObservacao(null)}
                className="p-2 rounded-full hover:bg-gray-100"
                aria-label="Fechar observação"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="whitespace-pre-wrap break-words text-gray-700">
                {participanteObservacao.observacao?.trim() || 'Nenhuma observação cadastrada.'}
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setParticipanteObservacao(null)}
                className="rounded-xl bg-blue-600 px-5 py-2 text-white hover:bg-blue-700"
              >
                Fechar
              </button>
            </div>
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
