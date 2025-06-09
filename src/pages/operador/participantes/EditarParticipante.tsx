// src/pages/operador/participantes/EditarParticipante.tsx

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
    email: '',
    telefone: '',
    empresa: '',
    categoria: '',
    status: 'participante',
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
          setForm({
            nome: data.nome || '',
            email: data.email || '',
            telefone: data.telefone || '',
            empresa: data.empresa || '',
            categoria: data.categoria || '',
            status: data.status || 'credenciado',
          });
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
            <input
              type="text"
              name="nome"
              placeholder="Nome completo"
              value={form.nome}
              onChange={handleChange}
              required
              className="w-full border px-4 py-2 rounded"
            />

            <input
              type="email"
              name="email"
              placeholder="E-mail"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full border px-4 py-2 rounded"
            />

            <input
              type="text"
              name="telefone"
              placeholder="Telefone"
              value={form.telefone}
              onChange={handleChange}
              className="w-full border px-4 py-2 rounded"
            />

            <input
              type="text"
              name="empresa"
              placeholder="Empresa"
              value={form.empresa}
              onChange={handleChange}
              className="w-full border px-4 py-2 rounded"
            />

						<select
							name="categoria"
							value={form.categoria}
							onChange={handleChange}
							className="w-full border px-4 py-2 rounded"
						>
							<option value="participante">Participante</option>
							<option value="palestrante">Palestrante</option>
							<option value="staff">Staff</option>
							<option value="vip">VIP</option>
							<option value="imprensa">Imprensa</option>
						</select>

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
