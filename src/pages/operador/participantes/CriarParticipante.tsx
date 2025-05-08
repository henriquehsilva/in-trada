// src/pages/operador/participantes/CriarParticipante.tsx

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LayoutDefault from '../../../components/layout/LayoutDefault';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import toast from 'react-hot-toast';

const CriarParticipante: React.FC = () => {
  const { eventoId } = useParams<{ eventoId: string }>();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nome: '',
    email: '',
		telefone: '',
    empresa: '',
    categoria: '',
    status: 'participante',
  });

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

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

    if (!eventoId) {
      setErro('Evento não definido. Verifique a URL.');
      setLoading(false);
      return;
    }

    try {
      const novoParticipante = {
        ...form,
        eventoId,
        criadoEm: new Date().toISOString(),
      };

      await addDoc(collection(db, 'participantes'), novoParticipante);

      toast.success(`Participante ${form.nome} criado com sucesso!`);
      setTimeout(() => navigate(`/operador/participantes?eventoId=${eventoId}`), 2000);
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
            {loading ? 'Salvando...' : 'Criar Participante'}
          </button>
        </form>
      </div>
    </LayoutDefault>
  );
};

export default CriarParticipante;
