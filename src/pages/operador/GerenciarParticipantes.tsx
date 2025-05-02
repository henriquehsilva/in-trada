import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Search, Download, Filter, Trash2, Edit } from 'lucide-react';
import LayoutDefault from '../../components/layout/LayoutDefault';
import { useAuth } from '../../contexts/AuthContext';
import { Evento, Participante } from '../../models/types';
import { 
  obterEventoPorId 
} from '../../services/eventoService';
import {
  obterParticipantesPorEvento,
  buscarParticipantes,
  excluirParticipante
} from '../../services/participanteService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const GerenciarParticipantes: React.FC = () => {
  const { eventoId } = useParams<{ eventoId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [evento, setEvento] = useState<Evento | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const carregarDados = async () => {
      if (!eventoId) return;
      
      try {
        // Carrega dados do evento
        const eventoDados = await obterEventoPorId(eventoId);
        if (eventoDados) {
          setEvento(eventoDados);
          
          // Carrega participantes
          const participantesDados = await obterParticipantesPorEvento(eventoId);
          setParticipantes(participantesDados);
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        setError('Erro ao carregar dados. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };
    
    carregarDados();
  }, [eventoId]);

  const handleSearch = async () => {
    if (!eventoId || !termoBusca.trim()) {
      // Se a busca estiver vazia, recarrega todos os participantes
      const participantesDados = await obterParticipantesPorEvento(eventoId);
      setParticipantes(participantesDados);
      return;
    }
    
    try {
      setLoading(true);
      const resultados = await buscarParticipantes(eventoId, termoBusca);
      setParticipantes(resultados);
    } catch (err) {
      console.error('Erro ao buscar participantes:', err);
      setError('Erro ao buscar participantes. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirParticipante = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este participante?')) {
      return;
    }

    try {
      await excluirParticipante(id);
      setParticipantes(participantes.filter(p => p.id !== id));
    } catch (err) {
      console.error('Erro ao excluir participante:', err);
      setError('Erro ao excluir participante. Tente novamente.');
    }
  };

  const formatarData = (dataString: string) => {
    try {
      const data = new Date(dataString);
      return format(data, "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch (e) {
      return dataString;
    }
  };

  if (loading && !evento) {
    return (
      <LayoutDefault title="Carregando...">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </LayoutDefault>
    );
  }

  if (!evento) {
    return (
      <LayoutDefault title="Evento não encontrado">
        <div className="bg-error-light text-error p-4 rounded-md">
          Evento não encontrado ou você não tem permissão para acessá-lo.
        </div>
      </LayoutDefault>
    );
  }

  return (
    <LayoutDefault 
      title={`Participantes: ${evento.nome}`}
      backUrl="/operador"
    >
      {error && (
        <div className="bg-error-light text-error p-4 rounded-md mb-4">
          {error}
        </div>
      )}

      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-grow">
            <div className="flex gap-2">
              <div className="flex-grow">
                <input
                  type="text"
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Buscar por nome, email ou empresa..."
                  className="input-field w-full"
                />
              </div>
              <button
                onClick={handleSearch}
                className="btn btn-primary flex items-center"
              >
                <Search className="w-5 h-5" />
              </button>
              <button
                className="btn btn-outline flex items-center"
                title="Filtros avançados"
              >
                <Filter className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/operador/participantes/${eventoId}/importar`)}
              className="btn btn-outline flex items-center"
            >
              <Download className="w-5 h-5 mr-2" />
              Importar
            </button>
            <button
              onClick={() => navigate(`/operador/participantes/${eventoId}/novo`)}
              className="btn btn-primary flex items-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              Novo Participante
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Empresa
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Categoria
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cadastrado em
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {participantes.map((participante) => (
                <tr key={participante.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {participante.nome}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {participante.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {participante.empresa}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary-100 text-primary">
                      {participante.categoria}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      participante.status === 'credenciado'
                        ? 'bg-success-light text-success'
                        : participante.status === 'confirmado'
                        ? 'bg-primary-100 text-primary'
                        : participante.status === 'cancelado'
                        ? 'bg-error-light text-error'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {participante.status === 'credenciado'
                        ? 'Credenciado'
                        : participante.status === 'confirmado'
                        ? 'Confirmado'
                        : participante.status === 'cancelado'
                        ? 'Cancelado'
                        : 'Pendente'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {formatarData(participante.criadoEm)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => navigate(`/operador/participantes/${eventoId}/${participante.id}/editar`)}
                        className="text-primary hover:text-primary-700"
                        title="Editar participante"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleExcluirParticipante(participante.id)}
                        className="text-error hover:text-error-700"
                        title="Excluir participante"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {participantes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Search className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Nenhum participante encontrado
                    </h3>
                    <p className="text-gray-500 mb-4">
                      {termoBusca
                        ? 'Tente ajustar os termos da busca ou limpar os filtros.'
                        : 'Comece adicionando participantes ao evento.'}
                    </p>
                    {!termoBusca && (
                      <button
                        onClick={() => navigate(`/operador/participantes/${eventoId}/novo`)}
                        className="btn btn-primary"
                      >
                        <Plus className="w-5 h-5 mr-2" />
                        Adicionar Participante
                      </button>
                    )}
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

export default GerenciarParticipantes;