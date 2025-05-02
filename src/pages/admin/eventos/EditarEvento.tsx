import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LayoutDefault from '../../../components/layout/LayoutDefault';
import { obterEventoPorId, atualizarEvento } from '../../../services/eventoService';
import { Evento } from '../../../models/types';
import toast from 'react-hot-toast';

const EditarEvento: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [form, setForm] = useState<Omit<Evento, 'id' | 'criadoEm' | 'atualizadoEm'>>({
    nome: '',
    descricao: '',
    local: '',
    dataInicio: '',
    dataFim: '',
    criadoPorId: '',
    camposPersonalizados: [],
  });

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const carregarDados = async () => {
      if (!id) return;
      try {
        const evento = await obterEventoPorId(id);
        if (evento) {
          setForm({
            nome: evento.nome,
            descricao: evento.descricao,
            local: evento.local,
            dataInicio: evento.dataInicio,
            dataFim: evento.dataFim,
            criadoPorId: evento.criadoPorId,
            camposPersonalizados: evento.camposPersonalizados || [],
          });
        } else {
          setErro('Evento não encontrado');
        }
      } catch (err) {
        setErro('Erro ao carregar evento');
      } finally {
        setLoading(false);
      }
    };
    carregarDados();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setErro(null);
    setSalvando(true);

    try {
      await atualizarEvento(id, form);
      toast.success(`Evento "${form.nome}" editado com sucesso!`);
      navigate('/admin'); // redireciona após salvar
    } catch (err) {
      setErro('Erro ao atualizar evento. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <LayoutDefault title="Editar Evento">
      <div className="bg-white p-6 rounded-md shadow-sm mx-auto border border-gray-100">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Editar Evento</h2>

        {loading ? (
          <p>Carregando...</p>
        ) : (
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
              disabled={salvando}
              className="bg-primary text-white px-6 py-2 rounded hover:bg-primary-dark disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </form>
        )}
      </div>
    </LayoutDefault>
  );
};

export default EditarEvento;
