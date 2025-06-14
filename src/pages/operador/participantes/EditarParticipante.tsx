import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import LayoutDefault from '../../../components/layout/LayoutDefault';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import toast from 'react-hot-toast';

const EditarParticipante: React.FC = () => {
  const { eventoId, id } = useParams<{ eventoId: string; id: string }>();
  const navigate = useNavigate();

  const location = useLocation();
  const from = location.state?.from;

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

  useEffect(() => {
    const carregarParticipante = async () => {
      if (!id) return;

      try {
        const ref = doc(db, 'participantes', id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setForm(prev => ({ ...prev, ...data }));
        } else {
          setErro('Participante não encontrado.');
        }
      } catch (err) {
        console.error(err);
        setErro('Erro ao carregar participante.');
      } finally {
        setLoading(false);
      }
    };

    carregarParticipante();
  }, [id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    setSucesso('');

    if (!eventoId || !id) {
      setErro('Dados de rota ausentes.');
      setLoading(false);
      return;
    }

    try {
      const ref = doc(db, 'participantes', id);
      await updateDoc(ref, {
        ...form,
        atualizadoEm: new Date().toISOString(),
      });

      toast.success(`Participante atualizado com sucesso!`);
      setTimeout(() => {
        if (from === 'painel-recepcao') {
          navigate(`/recepcionista/painel/${eventoId}`, {
            state: { participanteId: id }
          });
        } else {
          navigate(`/operador/participantes?eventoId=${eventoId}`);
        }
      }, 2000);
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
            {Object.entries(form).map(([key, value]) => (
              key === 'status' || key === 'categoria' ? (
                <select
                  key={key}
                  name={key}
                  value={value}
                  onChange={handleChange}
                  className="w-full border px-4 py-2 rounded"
                >
                  {key === 'status' ? (
                    <>
                      <option value="pendente">Pendente</option>
                      <option value="confirmado">Confirmado</option>
                      <option value="credenciado">Credenciado</option>
                      <option value="cancelado">Cancelado</option>
                    </>
                  ) : (
                    <>
                      <option value="participante">Participante</option>
                      <option value="palestrante">Palestrante</option>
                      <option value="staff">Staff</option>
                      <option value="vip">VIP</option>
                      <option value="imprensa">Imprensa</option>
                    </>
                  )}
                </select>
              ) : (
                <input
                  key={key}
                  type="text"
                  name={key}
                  placeholder={key.charAt(0).toUpperCase() + key.slice(1)}
                  value={value}
                  onChange={handleChange}
                  className="w-full border px-4 py-2 rounded"
                />
              )
            ))}

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
