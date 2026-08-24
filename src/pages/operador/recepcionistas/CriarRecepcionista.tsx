// src/pages/operador/recepcionistas/CriarRecepcionista.tsx

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LayoutDefault from '../../../components/layout/LayoutDefault';
import { obterEventos } from '../../../services/eventoService';
import { Evento } from '../../../models/types';
import { auth, db } from '../../../firebase/config';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';

const CriarRecepcionista: React.FC = () => {
  const { currentUser } = useAuth();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    eventoId: '',
    senhaOperador: '',
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
    carregarEventos();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    setSucesso('');

    if (form.senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.');
      setLoading(false);
      return;
    }

    try {
      const { user } = await createUserWithEmailAndPassword(auth, form.email, form.senha);
      await updateProfile(user, { displayName: form.nome });

      const now = new Date().toISOString();
      await setDoc(doc(db, 'usuarios', user.uid), {
        nome: form.nome,
        email: form.email,
        role: 'recepcionista',
        eventoId: form.eventoId,
        criadoEm: now,
        atualizadoEm: now,
      });

      // Reautentica o operador — createUserWithEmailAndPassword
      // substitui a sessão do operador pela da recepcionista.
      if (currentUser?.email && form.senhaOperador) {
        try {
          await signInWithEmailAndPassword(auth, currentUser.email, form.senhaOperador);
        } catch {
          // Se a reautenticação falhar, o operador será deslogado ao navegar.
          // Navega para o login em vez da listagem.
          toast.success(`Recepcionista ${form.nome} criado com sucesso!`);
          setTimeout(() => navigate('/login'), 2000);
          return;
        }
      }

      toast.success(`Recepcionista ${form.nome} criado com sucesso!`);
      setTimeout(() => navigate('/operador/recepcionistas'), 2000);
    } catch (err) {
      console.error(err);
      const code = (err as { code?: string }).code;
      if (code === 'auth/email-already-in-use') {
        setErro('Este e-mail já está em uso.');
      } else if (code === 'auth/weak-password') {
        setErro('A senha deve ter pelo menos 6 caracteres.');
      } else {
        setErro('Erro ao criar recepcionista. Verifique os dados e tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LayoutDefault title="Nova Recepcionista">
      <div className="mx-auto bg-white border p-6 rounded-md shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Cadastrar Recepcionista</h2>

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
            type="password"
            name="senha"
            placeholder="Senha"
            value={form.senha}
            onChange={handleChange}
            required
            className="w-full border px-4 py-2 rounded"
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

          <div className="border-t pt-4 mt-2">
            <p className="text-sm text-gray-500 mb-2">
              Confirme sua senha de operador para manter a sessão após a criação.
            </p>
            <input
              type="password"
              name="senhaOperador"
              placeholder="Sua senha de operador"
              value={form.senhaOperador}
              onChange={handleChange}
              required
              className="w-full border px-4 py-2 rounded"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-white px-6 py-2 rounded hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Criar Recepcionista'}
          </button>
        </form>
      </div>
    </LayoutDefault>
  );
};

export default CriarRecepcionista;
