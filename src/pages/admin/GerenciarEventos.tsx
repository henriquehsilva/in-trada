import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, Calendar, MapPin, Users } from 'lucide-react';
import LayoutDefault from '../../components/layout/LayoutDefault';
import { obterEventos, excluirEvento } from '../../services/eventoService';
import { Evento } from '../../models/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const GerenciarEventos: React.FC = () => {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const carregarEventos = async () => {
      try {
        const eventosData = await obterEventos();
        setEventos(eventosData);
      } catch (err) {
        console.error('Erro ao carregar eventos:', err);
        setError('Não foi possível carregar os eventos. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };

    carregarEventos();
  }, []);

  const handleExcluirEvento = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este evento?')) {
      return;
    }

    try {
      await excluirEvento(id);
      setEventos(eventos.filter(evento => evento.id !== id));
    } catch (err) {
      console.error('Erro ao excluir evento:', err);
      setError('Não foi possível excluir o evento. Tente novamente mais tarde.');
    }
  };

  const formatarData = (dataString: string) => {
    try {
      const data = new Date(dataString);
      return format(data, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch (e) {
      return dataString;
    }
  };

  if (loading) {
    return (
      <LayoutDefault title="Gerenciar Eventos">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </LayoutDefault>
    );
  }

  return (
    <LayoutDefault title="Gerenciar Eventos">
      {error && (
        <div className="bg-error-light text-error p-4 rounded-md mb-4">
          {error}
        </div>
      )}

      <div className="mb-6">
        <button
          onClick={() => navigate('/admin/eventos/novo')}
          className="btn btn-primary flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Novo Evento
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {eventos.map(evento => (
          <div
            key={evento.id}
            className="bg-white rounded-lg shadow-sm border border-gray-100 p-4"
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-primary">{evento.nome}</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => navigate(`/admin/eventos/${evento.id}`)}
                  className="p-1 text-gray-500 hover:text-primary rounded"
                  title="Editar evento"
                >
                  <Edit size={18} />
                </button>
                <button
                  onClick={() => handleExcluirEvento(evento.id)}
                  className="p-1 text-gray-500 hover:text-error rounded"
                  title="Excluir evento"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <p className="text-gray-600 text-sm mb-4">{evento.descricao}</p>

            <div className="space-y-2 text-sm">
              <div className="flex items-center text-gray-600">
                <Calendar className="w-4 h-4 mr-2" />
                <span>
                  {formatarData(evento.dataInicio)} até {formatarData(evento.dataFim)}
                </span>
              </div>

              <div className="flex items-center text-gray-600">
                <MapPin className="w-4 h-4 mr-2" />
                <span>{evento.local}</span>
              </div>

              <div className="flex items-center text-gray-600">
                <Users className="w-4 h-4 mr-2" />
                <span>
                  {evento.camposPersonalizados?.length || 0} campos personalizados
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => navigate(`/admin/eventos/${evento.id}/participantes`)}
                  className="btn btn-outline text-sm"
                >
                  Ver Participantes
                </button>
                <button
                  onClick={() => navigate(`/admin/eventos/${evento.id}/configuracoes`)}
                  className="btn btn-primary text-sm"
                >
                  Configurações
                </button>
              </div>
            </div>
          </div>
        ))}

        {eventos.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum evento cadastrado
            </h3>
            <p className="text-gray-500 mb-4">
              Comece criando seu primeiro evento clicando no botão acima.
            </p>
          </div>
        )}
      </div>
    </LayoutDefault>
  );
};

export default GerenciarEventos;