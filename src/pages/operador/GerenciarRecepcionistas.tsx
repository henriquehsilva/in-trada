import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, Mail, Calendar, Users } from 'lucide-react';
import LayoutDefault from '../../components/layout/LayoutDefault';
import { useAuth } from '../../contexts/AuthContext';
import { Usuario } from '../../models/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';

const GerenciarRecepcionistas: React.FC = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  useEffect(() => {
    const carregarRecepcionistas = async () => {
      try {
        const usuariosRef = collection(db, 'usuarios');
        const q = query(usuariosRef, where('role', '==', 'recepcionista'));
        const snapshot = await getDocs(q);

        const lista: Usuario[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            nome: data.nome,
            email: data.email,
            role: data.role,
            eventoId: data.eventoId,
            criadoEm: data.criadoEm || '',
            atualizadoEm: data.atualizadoEm || '',
          };
        });

        setUsuarios(lista);
      } catch (err) {
        console.error('Erro ao carregar recepcionistas:', err);
        setError('Não foi possível carregar as recepcionistas. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };

    carregarRecepcionistas();
  }, []);

  const handleExcluir = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta recepcionista?')) return;

    try {
      await deleteDoc(doc(db, 'usuarios', id));
      setUsuarios((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      console.error('Erro ao excluir recepcionista:', err);
      setError('Não foi possível excluir a recepcionista. Tente novamente.');
    }
  };

  const formatarData = (dataString: string) => {
    try {
      const data = new Date(dataString);
      return format(data, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return dataString;
    }
  };

  if (loading) {
    return (
      <LayoutDefault title="Gerenciar Recepcionistas">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </LayoutDefault>
    );
  }

  return (
    <LayoutDefault title="Gerenciar Recepcionistas">
      {error && <div className="bg-error-light text-error p-4 rounded-md mb-4">{error}</div>}

      <div className="mb-6">
        <button
          onClick={() => navigate('/operador/recepcionistas/novo')}
          className="btn btn-primary flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nova Recepcionista
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cadastrado em</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {usuarios.map((usuario) => (
                <tr key={usuario.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{usuario.nome}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-500">
                      <Mail className="w-4 h-4 mr-2" />
                      {usuario.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="w-4 h-4 mr-2" />
                      {formatarData(usuario.criadoEm)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-success-light text-success">Ativo</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => navigate(`/operador/recepcionistas/${usuario.id}/editar`)}
                        className="text-primary hover:text-primary-700"
                        title="Editar"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleExcluir(usuario.id)}
                        className="text-error hover:text-error-700"
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Nenhuma recepcionista cadastrada
                    </h3>
                    <p className="text-gray-500 mb-4">
                      Comece adicionando recepcionistas ao sistema clicando no botão acima.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </LayoutDefault>
  );
};

export default GerenciarRecepcionistas;
