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

  useEffect(() => {
    const carregarDados = async () => {
      if (!id || !eventoId) return;

      try {
        setLoading(true);
        // Carrega participante
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

        // Carrega todos os participantes do evento (para herdar cor da categoria)
        const participantesRef = collection(db, 'participantes');
        const snapshot = await getDocs(query(
          participantesRef,
          where('eventoId', '==', eventoId)
        ));
        const lista = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Participante) }));
        // normaliza categoria para trabalhar localmente
        setParticipantesEvento(lista.map(p => ({
          ...p,
          categoria: normalizeCategory(p.categoria || ''),
        })));
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name === 'categoria') {
      const upper = normalizeCategory(value);
      const corExistente = categoriaColorMap[upper];
      setForm(prev => ({
        ...prev,
        categoria: upper,
        corCategoria: prev.corCategoria?.trim() ? prev.corCategoria : (corExistente || stableColorFromString(upper)),
      }));
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
      // Normaliza categoria e decide cor
      const categoriaUpper = normalizeCategory(form.categoria);
      let corCategoria = (form.corCategoria || '').trim();

      // 1) Tenta herdar do mapa carregado
      const corNoMapa = categoriaColorMap[categoriaUpper];
      // 2) Se ainda não tiver, consulta novamente (defesa caso o mapa não tenha tudo atualizado)
      if (!corNoMapa && !corCategoria) {
        const participantesRef = collection(db, 'participantes');
        const snapshot = await getDocs(query(
          participantesRef,
          where('eventoId', '==', eventoId)
        ));
        const corExistente = snapshot.docs
          .map(d => d.data() as Participante)
          .find(p => normalizeCategory(p.categoria || '') === categoriaUpper)?.corCategoria;
        corCategoria = corExistente || stableColorFromString(categoriaUpper);
      } else if (!corCategoria) {
        corCategoria = corNoMapa || stableColorFromString(categoriaUpper);
      }

      const ref = doc(db, 'participantes', id);
      await updateDoc(ref, {
        ...form,
        categoria: categoriaUpper,
        corCategoria,
        atualizadoEm: new Date().toISOString(),
      });

      toast.success(`Participante atualizado com sucesso!`);
      setSucesso('Participante atualizado com sucesso!');

      setTimeout(() => {
        if (from === 'painel-recepcao') {
          navigate(`/recepcionista/painel/${eventoId}`, {
            state: { participanteId: id }
          });
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
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Editar Participante</h2>
          {/* Botão de atualizar no topo */}
          <button
            onClick={() => handleSubmit()}
            disabled={loading}
            className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Atualizar'}
          </button>
        </div>

        {erro && <div className="text-red-600 mb-4">{erro}</div>}
        {sucesso && <div className="text-green-600 mb-4">{sucesso}</div>}

        {loading ? (
          <p>Carregando...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campos do formulário */}
            {Object.entries(form).map(([key, value]) => {
              // Select do status permanece como select
              if (key === 'status') {
                return (
                  <select
                    key={key}
                    name={key}
                    value={value as string}
                    onChange={handleChange}
                    className="w-full border px-4 py-2 rounded"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="confirmado">Confirmado</option>
                    <option value="credenciado">Credenciado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                );
              }

              // Categoria passa a ser SELECT dinâmico (MAIÚSCULO e herda cor)
              if (key === 'categoria') {
                return (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categoria *
                    </label>
                    <select
                      name="categoria"
                      value={(value as string) || ''}
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
                      Será salva em MAIÚSCULO. Se já existir cor para essa categoria neste evento, ela será reutilizada automaticamente.
                    </p>
                  </div>
                );
              }

              // Campo de cor com preview e dica
              if (key === 'corCategoria') {
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cor da Categoria
                      </label>
                      <input
                        type="text"
                        name="corCategoria"
                        placeholder="#RRGGBB ou hsl(...)"
                        value={(value as string) || ''}
                        onChange={handleChange}
                        className="w-full border px-4 py-2 rounded"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Este valor pode ser sobrescrito automaticamente caso exista uma cor já usada pela mesma categoria.
                      </p>
                    </div>
                    <div
                      className="w-10 h-10 rounded border"
                      title="Preview da cor"
                      style={{ backgroundColor: (value as string) || '#ccc' }}
                    />
                  </div>
                );
              }

              // Observação como textarea
              if (key === 'observacao') {
                return (
                  <textarea
                    key={key}
                    name={key}
                    placeholder="Observação"
                    value={(value as string) || ''}
                    onChange={handleChange}
                    className="w-full border px-4 py-2 rounded"
                    rows={3}
                  />
                );
              }

              // Demais campos como input texto
              return (
                <input
                  key={key}
                  type="text"
                  name={key}
                  placeholder={key.charAt(0).toUpperCase() + key.slice(1)}
                  value={(value as string) ?? ''}
                  onChange={handleChange}
                  className="w-full border px-4 py-2 rounded"
                />
              );
            })}

            {/* Botão no final do form (mantido) */}
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
