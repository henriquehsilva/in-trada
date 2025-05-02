import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { criarEvento } from '../../../services/eventoService';
import { Evento } from '../../../models/types';
import { useAuth } from '../../../contexts/AuthContext';
import LayoutDefault from '../../../components/layout/LayoutDefault';
import toast from 'react-hot-toast';

const CriarEvento: React.FC = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<Omit<Evento, 'id' | 'criadoEm' | 'atualizadoEm'>>({
    nome: '',
    descricao: '',
    local: '',
    dataInicio: '',
    dataFim: '',
    criadoPorId: userData?.uid || '',
    camposPersonalizados: [],
  });

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setLoading(true);
  
    try {
      await criarEvento(form);
      toast.success(`Evento "${form.nome}" criado com sucesso!`);
      navigate('/admin');
    } catch (err) {
      console.error(err);
      setErro('Erro ao criar evento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LayoutDefault title="Criar Novo Evento">
      <div className="bg-white p-6 rounded-md shadow-sm mx-auto border border-gray-100">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Formulário de Evento</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="nome"
            placeholder="Nome do evento"
            value={form.nome}
            onChange={handleChange}
            required
            className="w-full border px-4 py-2 rounded"
          />
          <textarea
            name="descricao"
            placeholder="Descrição"
            value={form.descricao}
            onChange={handleChange}
            className="w-full border px-4 py-2 rounded"
          />
          <input
            type="text"
            name="local"
            placeholder="Local"
            value={form.local}
            onChange={handleChange}
            required
            className="w-full border px-4 py-2 rounded"
          />
          <input
            type="datetime-local"
            name="dataInicio"
            value={form.dataInicio}
            onChange={handleChange}
            required
            className="w-full border px-4 py-2 rounded"
          />
          <input
            type="datetime-local"
            name="dataFim"
            value={form.dataFim}
            onChange={handleChange}
            required
            className="w-full border px-4 py-2 rounded"
          />

          {erro && <p className="text-red-600 text-sm">{erro}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-white px-6 py-2 rounded hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Criar Evento'}
          </button>
        </form>
      </div>
    </LayoutDefault>
  );
};

export default CriarEvento;
