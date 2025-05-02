import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, QrCode, Layout, Calendar } from 'lucide-react';
import LayoutDefault from '../../components/layout/LayoutDefault';
import { useAuth } from '../../contexts/AuthContext';
import { Evento } from '../../models/types';
import { obterEventos } from '../../services/eventoService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const OperadorDashboard: React.FC = () => {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

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
      <LayoutDefault title="Dashboard do Operador">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </LayoutDefault>
    );
  }

  return (
    <LayoutDefault title="Dashboard do Operador">
      {error && (
        <div className="bg-error-light text-error p-4 rounded-md mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-primary-100 text-primary">
              <Calendar className="h-8 w-8" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Eventos Ativos</p>
              <p className="text-2xl font-semibold">{eventos.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-accent-100 text-accent">
              <Users className="h-8 w-8" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Recepcionistas</p>
              <p className="text-2xl font-semibold">0</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-success-light text-success">
              <QrCode className="h-8 w-8" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Credenciamentos</p>
              <p className="text-2xl font-semibold">0</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-warning-light text-warning">
              <Layout className="h-8 w-8" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Modelos</p>
              <p className="text-2xl font-semibold">0</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold mb-4">Eventos Ativos</h2>
          <div className="space-y-4">
            {eventos.map(evento => (
              <div
                key={evento.id}
                className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => navigate(`/operador/editor-crachas/${evento.id}`)}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-primary">{evento.nome}</h3>
                  <span className="px-2 py-1 text-xs rounded-full bg-success-light text-success">
                    Ativo
                  </span>
                </div>
                <div className="text-sm text-gray-500 space-y-1">
                  <p>
                    <Calendar className="w-4 h-4 inline mr-2" />
                    {formatarData(evento.dataInicio)}
                  </p>
                  <p className="flex items-center">
                    <Users className="w-4 h-4 mr-2" />
                    0 participantes
                  </p>
                </div>
              </div>
            ))}

            {eventos.length === 0 && (
              <div className="text-center py-8">
                <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Nenhum evento ativo no momento.</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold mb-4">Ações Rápidas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/operador/recepcionistas')}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              <Users className="w-8 h-8 text-primary mb-2" />
              <h3 className="font-medium mb-1">Gerenciar Recepcionistas</h3>
              <p className="text-sm text-gray-500">
                Adicione ou remova recepcionistas dos eventos
              </p>
            </button>

            <button
              onClick={() => navigate('/operador/editor-crachas/' + (eventos[0]?.id || ''))}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              <Layout className="w-8 h-8 text-accent mb-2" />
              <h3 className="font-medium mb-1">Editor de Crachás</h3>
              <p className="text-sm text-gray-500">
                Crie e personalize modelos de crachás
              </p>
            </button>

            <button
              onClick={() => navigate('/operador/editor-painel/' + (eventos[0]?.id || ''))}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              <Layout className="w-8 h-8 text-success mb-2" />
              <h3 className="font-medium mb-1">Editor de Painéis</h3>
              <p className="text-sm text-gray-500">
                Configure painéis de recepção
              </p>
            </button>

            <button
              onClick={() => navigate('/operador/participantes/' + (eventos[0]?.id || ''))}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              <Users className="w-8 h-8 text-warning mb-2" />
              <h3 className="font-medium mb-1">Participantes</h3>
              <p className="text-sm text-gray-500">
                Gerencie participantes dos eventos
              </p>
            </button>
          </div>
        </div>
      </div>
    </LayoutDefault>
  );
};

export default OperadorDashboard;