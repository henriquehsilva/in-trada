import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LayoutDefault from '../../../components/layout/LayoutDefault';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';

// Helpers
const normalizeCategory = (s: string) => (s || '').trim().toUpperCase();
const stableColorFromString = (str: string) => {
  if (!str) return '#cccccc';
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 75%)`;
};

const CriarParticipante: React.FC = () => {
  const { eventoId } = useParams<{ eventoId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
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

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // Categorias existentes no evento (em CAIXA ALTA, únicas)
  const [categoriasEvento, setCategoriasEvento] = useState<string[]>([]);
  const [categoriaColorMap, setCategoriaColorMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const carregarCategorias = async () => {
      if (!eventoId) return;
      const participantesRef = collection(db, 'participantes');
      const snap = await getDocs(query(participantesRef, where('eventoId', '==', eventoId)));

      const setCats = new Set<string>();
      const colorMap: Record<string, string> = {};
      snap.forEach((docu) => {
        const data: any = docu.data();
        const cat = normalizeCategory(data.categoria);
        if (cat) setCats.add(cat);
        if (cat && data.corCategoria && !colorMap[cat]) colorMap[cat] = data.corCategoria;
      });

      const list = Array.from(setCats).sort((a, b) => a.localeCompare(b));
      setCategoriasEvento(list);
      setCategoriaColorMap(colorMap);
    };
    carregarCategorias();
  }, [eventoId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    // Categoria sempre MAIÚSCULO + define cor automaticamente (herdada ou estável)
    if (name === 'categoria') {
      const upper = normalizeCategory(value);
      const cor = categoriaColorMap[upper] || stableColorFromString(upper);
      setForm((prev) => ({ ...prev, categoria: upper, corCategoria: cor }));
      return;
    }

    // Demais campos mantêm comportamento padrão
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    setSucesso('');

    if (!eventoId) {
      setErro('Evento não definido. Verifique a URL.');
      setLoading(false);
      return;
    }

    try {
      const participantesRef = collection(db, 'participantes');

      const categoriaUpper = normalizeCategory(form.categoria);
      let corCategoria = (form.corCategoria || '').trim();

      // Se não definimos cor ainda, tenta herdar de outro participante do mesmo evento; se não houver, gera cor estável
      if (!corCategoria) {
        const snap = await getDocs(query(participantesRef, where('eventoId', '==', eventoId)));
        const corExistente = snap.docs
          .map((d) => d.data() as any)
          .find((p) => normalizeCategory(p.categoria) === categoriaUpper)?.corCategoria;
        corCategoria = corExistente || stableColorFromString(categoriaUpper);
      }

      const novoParticipante = {
        ...form,
        categoria: categoriaUpper,
        corCategoria,
        eventoId,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        criadoPorId: currentUser?.uid || '',
        camposPersonalizados: {},
      };

      await addDoc(participantesRef, novoParticipante);

      toast.success(`Participante ${form.nome} criado com sucesso!`);
      setTimeout(() => navigate(`/operador/participantes?eventoId=${eventoId}`), 1200);
    } catch (err) {
      console.error(err);
      setErro('Erro ao criar participante. Verifique os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LayoutDefault title="Novo Participante">
      <div className="mx-auto bg-white border p-6 rounded-md shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Cadastrar Participante</h2>

        {erro && <div className="text-red-600 mb-4">{erro}</div>}
        {sucesso && <div className="text-green-600 mb-4">{sucesso}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Campos principais */}
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
            {loading ? 'Salvando...' : 'Criar Participante'}
          </button>
        </form>
      </div>
    </LayoutDefault>
  );
};

export default CriarParticipante;