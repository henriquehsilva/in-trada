import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import LayoutDefault from '../../../components/layout/LayoutDefault';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import toast from 'react-hot-toast';

type Participante = {
  id?: string;
  eventoId?: string;
  nome: string;
  empresa: string;
  nomeCracha: string;
  empresaCracha: string;
  cargo: string;
  email1: string;
  email2: string;
  celular: string;
  telefone: string;
  categoria: string;
  corCategoria: string;
  observacao: string;
  cpf: string;
  rg: string;
  cnpj: string;
  codigoCliente: string;
  opcao1: string;
  opcao2: string;
  opcao3: string;
  opcao4: string;
  opcao5: string;
  opcao6: string;
  opcao7: string;
  opcao8: string;
  opcao9: string;
  opcao10: string;
  status: 'pendente' | 'confirmado' | 'credenciado' | 'cancelado';
  [k: string]: any;
};

const normalizeCategory = (s: string) => (s || '').trim().toUpperCase();

/** Gera uma cor “pastel” estável a partir do nome da categoria */
const stableColorFromString = (str: string) => {
  if (!str) return '#cccccc';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 75%)`;
};

const EditarParticipante: React.FC = () => {
  const { eventoId, id } = useParams<{ eventoId: string; id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from;

  const [form, setForm] = useState<Participante>({
    nome: '',
    empresa: '',
    nomeCracha: '',
    empresaCracha: '',
    cargo: '',
    email1: '',
    email2: '',
    celular: '',
    telefone: '',
    categoria: '',
    corCategoria: '',
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
    status: 'pendente',
  });

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [participantesEvento, setParticipantesEvento] = useState<Participante[]>([]);

  // Carrega dados do participante e lista de participantes do evento (para compor categorias e herança de cor)
  useEffect(() => {
    const carregarDados = async () => {
      if (!id || !eventoId) return;

      try {
        setLoading(true);

        // Participante
        const ref = doc(db, 'participantes', id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as Participante;
          setForm(prev => ({
            ...prev,
            ...data,
            categoria: normalizeCategory(data.categoria || ''),
          }));
        } else {
          setErro('Participante não encontrado.');
        }

        // Todos os participantes do evento (para categorias/cor)
        const participantesRef = collection(db, 'participantes');
        const snapshot = await getDocs(query(participantesRef, where('eventoId', '==', eventoId)));
        const lista = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Participante) }));
        setParticipantesEvento(
          lista.map(p => ({ ...p, categoria: normalizeCategory(p.categoria || '') }))
        );
      } catch (err) {
        console.error(err);
        setErro('Erro ao carregar dados.');
      } finally {
        setLoading(false);
      }
    };

    carregarDados();
  }, [id, eventoId]);

  // Mapa Categoria -> Cor (primeira encontrada para a categoria no evento)
  const categoriaColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of participantesEvento) {
      const cat = normalizeCategory(p.categoria);
      if (cat && p.corCategoria && !map[cat]) {
        map[cat] = p.corCategoria;
      }
    }
    return map;
  }, [participantesEvento]);

  // Lista de categorias do evento (únicas, em MAIÚSCULO)
  const categoriasEvento = useMemo(() => {
    const setCats = new Set<string>();
    for (const p of participantesEvento) {
      const cat = normalizeCategory(p.categoria);
      if (cat) setCats.add(cat);
    }
    return Array.from(setCats).sort((a, b) => a.localeCompare(b));
  }, [participantesEvento]);

  // Handler igual ao da tela de Criar: categoria sempre MAIÚSCULO e herda cor existente (ou gera estável)
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name === 'categoria') {
      const upper = normalizeCategory(value);
      const cor = categoriaColorMap[upper] || stableColorFromString(upper);
      setForm(prev => ({ ...prev, categoria: upper, corCategoria: cor }));
      return;
    }

    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErro('');
    setSucesso('');

    if (!eventoId || !id) {
      setErro('Dados de rota ausentes.');
      setLoading(false);
      return;
    }

    try {
      const categoriaUpper = normalizeCategory(form.categoria);
      let corCategoria = (form.corCategoria || '').trim();

      // Herda cor da categoria no evento, se ainda não definida
      if (!corCategoria) {
        const participantesRef = collection(db, 'participantes');
        const snapshot = await getDocs(query(participantesRef, where('eventoId', '==', eventoId)));
        const corExistente = snapshot.docs
          .map(d => d.data() as Participante)
          .find(p => normalizeCategory(p.categoria || '') === categoriaUpper)?.corCategoria;
        corCategoria = corExistente || stableColorFromString(categoriaUpper);
      }

      const ref = doc(db, 'participantes', id);
      await updateDoc(ref, {
        ...form,
        categoria: categoriaUpper,
        corCategoria,
        atualizadoEm: new Date().toISOString(),
      });

      toast.success('Participante atualizado com sucesso!');
      setSucesso('Participante atualizado com sucesso!');

      setTimeout(() => {
        if (from === 'painel-recepcao') {
          navigate(`/recepcionista/painel/${eventoId}`, { state: { participanteId: id } });
        } else {
          navigate(`/operador/participantes?eventoId=${eventoId}`);
        }
      }, 1200);
    } catch (err) {
      console.error(err);
      setErro('Erro ao atualizar participante.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LayoutDefault title="Editar Participante">
      <div className="mx-auto bg-white border p-6 rounded-md shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Editar Participante</h2>

        {erro && <div className="text-red-600 mb-4">{erro}</div>}
        {sucesso && <div className="text-green-600 mb-4">{sucesso}</div>}

        {loading ? (
          <p>Carregando...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campos principais (igual Criar) */}
            <input
              type="text"
              name="nome"
              placeholder="Nome"
              value={form.nome}
              onChange={handleChange}
              className="w-full border px-4 py-2 rounded"
              required
            />

            <input
              type="text"
              name="empresa"
              placeholder="Empresa"
              value={form.empresa}
              onChange={handleChange}
              className="w-full border px-4 py-2 rounded"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                name="nomeCracha"
                placeholder="Nome no Crachá"
                value={form.nomeCracha}
                onChange={handleChange}
                className="w-full border px-4 py-2 rounded"
              />
              <input
                type="text"
                name="empresaCracha"
                placeholder="Empresa no Crachá"
                value={form.empresaCracha}
                onChange={handleChange}
                className="w-full border px-4 py-2 rounded"
              />
            </div>

            <input
              type="text"
              name="cargo"
              placeholder="Cargo"
              value={form.cargo}
              onChange={handleChange}
              className="w-full border px-4 py-2 rounded"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="email"
                name="email1"
                placeholder="Email principal"
                value={form.email1}
                onChange={handleChange}
                className="w-full border px-4 py-2 rounded"
                required
              />
              <input
                type="email"
                name="email2"
                placeholder="Email alternativo"
                value={form.email2}
                onChange={handleChange}
                className="w-full border px-4 py-2 rounded"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="tel"
                name="celular"
                placeholder="Celular"
                value={form.celular}
                onChange={handleChange}
                className="w-full border px-4 py-2 rounded"
              />
              <input
                type="tel"
                name="telefone"
                placeholder="Telefone"
                value={form.telefone}
                onChange={handleChange}
                className="w-full border px-4 py-2 rounded"
              />
            </div>

            {/* CATEGORIA como SELECT dinâmico (sempre em CAIXA ALTA) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
              <select
                name="categoria"
                value={form.categoria}
                onChange={handleChange}
                className="w-full border px-4 py-2 rounded uppercase"
                required
                defaultValue=""
              >
                <option value="" disabled>Selecione uma categoria</option>
                {categoriasEvento.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                A categoria é salva em MAIÚSCULO e herdará a cor usada no evento, quando existir.
              </p>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full border px-4 py-2 rounded"
              >
                <option value="pendente">Pendente</option>
                <option value="confirmado">Confirmado</option>
                <option value="credenciado">Credenciado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

            {/* Observação */}
            <textarea
              name="observacao"
              placeholder="Observação"
              value={form.observacao}
              onChange={handleChange}
              className="w-full border px-4 py-2 rounded"
              rows={3}
            />

            {/* Documentos e códigos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" name="cpf" placeholder="CPF" value={form.cpf} onChange={handleChange} className="w-full border px-4 py-2 rounded" />
              <input type="text" name="rg" placeholder="RG" value={form.rg} onChange={handleChange} className="w-full border px-4 py-2 rounded" />
              <input type="text" name="cnpj" placeholder="CNPJ" value={form.cnpj} onChange={handleChange} className="w-full border px-4 py-2 rounded" />
              <input type="text" name="codigoCliente" placeholder="Código Cliente" value={form.codigoCliente} onChange={handleChange} className="w-full border px-4 py-2 rounded" />
            </div>

            {/* Opções extras */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" name="opcao1" placeholder="Opção 1" value={form.opcao1} onChange={handleChange} className="w-full border px-4 py-2 rounded" />
              <input type="text" name="opcao2" placeholder="Opção 2" value={form.opcao2} onChange={handleChange} className="w-full border px-4 py-2 rounded" />
              <input type="text" name="opcao3" placeholder="Opção 3" value={form.opcao3} onChange={handleChange} className="w-full border px-4 py-2 rounded" />
              <input type="text" name="opcao4" placeholder="Opção 4" value={form.opcao4} onChange={handleChange} className="w-full border px-4 py-2 rounded" />
              <input type="text" name="opcao5" placeholder="Opção 5" value={form.opcao5} onChange={handleChange} className="w-full border px-4 py-2 rounded" />
              <input type="text" name="opcao6" placeholder="Opção 6" value={form.opcao6} onChange={handleChange} className="w-full border px-4 py-2 rounded" />
              <input type="text" name="opcao7" placeholder="Opção 7" value={form.opcao7} onChange={handleChange} className="w-full border px-4 py-2 rounded" />
              <input type="text" name="opcao8" placeholder="Opção 8" value={form.opcao8} onChange={handleChange} className="w-full border px-4 py-2 rounded" />
              <input type="text" name="opcao9" placeholder="Opção 9" value={form.opcao9} onChange={handleChange} className="w-full border px-4 py-2 rounded" />
              <input type="text" name="opcao10" placeholder="Opção 10" value={form.opcao10} onChange={handleChange} className="w-full border px-4 py-2 rounded" />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-primary text-white px-6 py-2 rounded hover:bg-primary-dark disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Atualizar Participante'}
            </button>
          </form>
        )}
      </div>
    </LayoutDefault>
  );
};

export default EditarParticipante;
