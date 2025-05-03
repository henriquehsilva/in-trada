import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LayoutDefault from '../../../components/layout/LayoutDefault';
import { obterEventos } from '../../../services/eventoService';
import { Evento, Usuario } from '../../../models/types';
import { db } from '../../../firebase/config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

const EditarOperador: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [form, setForm] = useState({
    nome: '',
    email: '',
    eventoId: '',
  });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const carregarEventos = async () => {
      try {
        const eventosData = await obterEventos();
        setEventos(eventosData);
      } catch {
        setErro('Erro ao carregar eventos.');
      }
    };

    const carregarOperador = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'usuarios', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const dados = snap.data();
          setForm({
            nome: dados.nome || '',
            email: dados.email || '',
            eventoId: dados.eventoId || '',
          });
        }
      } catch (e) {
        setErro('Erro ao carregar dados do operador.');
      }
    };

    carregarEventos();
    carregarOperador();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    setSucesso('');

    try {
      if (!id) return;

      const docRef = doc(db, 'usuarios', id);
      await updateDoc(docRef, {
        nome: form.nome,
        email: form.email,
        eventoId: form.eventoId,
        atualizadoEm: new Date().toISOString(),
      });

      toast.success(`Operador atualizado com sucesso!`);
      setTimeout(() => navigate('/admin/operadores'), 2000);
    } catch (err) {
      console.error(err);
      setErro('Erro ao atualizar operador.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LayoutDefault title="Editar Operador">
      <div className="mx-auto bg-white border p-6 rounded-md shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Atualizar Dados do Operador</h2>

        {erro && <div className="text-red-600 mb-4">{erro}</div>}
        {sucesso && <div className="text-green-600 mb-4">{sucesso}</div>}

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
            disabled
          />

          <select
            name="eventoId"
            value={form.eventoId}
            onChange={handleChange}
            required
            className="w-full border px-4 py-2 rounded"
          >
            <option value="">Selecione o evento</option>
            {eventos.map((evento) => (
              <option key={evento.id} value={evento.id}>
                {evento.nome}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-white px-6 py-2 rounded hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Atualizar Operador'}
          </button>
        </form>
      </div>
    </LayoutDefault>
  );
};

export default EditarOperador;
