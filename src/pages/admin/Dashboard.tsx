import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Users, Clock, Calendar } from 'lucide-react';
import LayoutDefault from '../../components/layout/LayoutDefault';
import { obterEventos } from '../../services/eventoService';
import { Evento } from '../../models/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DonutChart from '../../components/DonutChart';


const AdminDashboard: React.FC = () => {
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

  const eventosAtivos = eventos.filter(evento => {
    const dataFim = new Date(evento.dataFim);
    return dataFim >= new Date();
  });

  const eventosPassados = eventos.filter(evento => {
    const dataFim = new Date(evento.dataFim);
    return dataFim < new Date();
  });

  const formatarData = (dataString: string) => {
    try {
      const data = new Date(dataString);
      return format(data, 'dd/MM/yyyy', { locale: ptBR });
    } catch (e) {
      return dataString;
    }
  };

  const navegarParaNovoEvento = () => {
    navigate('/admin/eventos/novo');
  };

  return (
    <LayoutDefault title="Dashboard Administrativo">
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <div className="bg-error-light text-error p-4 rounded-md">
          {error}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Cards de resumo */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* <div className="card bg-white p-6 shadow-sm rounded-lg border border-gray-100">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-success-light text-success">
                  <Clock className="h-8 w-8" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Próximo Evento</p>
                  <p className="text-lg font-semibold truncate">
                    {eventosAtivos.length > 0
                      ? eventosAtivos[0].nome.substring(0, 15) + (eventosAtivos[0].nome.length > 15 ? '...' : '')
                      : 'Nenhum'}
                  </p>
                </div>
              </div>
            </div> */}
          </div>

          {/* Ações rápidas */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold mb-4">Ações Rápidas</h2>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={navegarParaNovoEvento}
                className="btn btn-primary"
              >
                Novo Evento
              </button>
              <button
                onClick={() => navigate('/admin/operadores')}
                className="btn btn-outline"
              >
                Gerenciar Operadores
              </button>
              <button
                onClick={() => navigate('/admin/eventos')}
                className="btn btn-outline"
              >
                Ver Todos os Eventos
              </button>
            </div>
          </div>

          {/* Lista de eventos recentes */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold mb-4">Eventos Recentes</h2>
            {eventos.length === 0 ? (
              <p className="text-gray-500">Nenhum evento cadastrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nome
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Local
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data Início
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data Fim
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {eventos.slice(0, 5).map((evento) => {
                      const agora = new Date();
                      const dataInicio = new Date(evento.dataInicio);
                      const dataFim = new Date(evento.dataFim);
                      
                      let status = 'Agendado';
                      let statusColor = 'bg-blue-100 text-blue-800';
                      
                      if (agora > dataFim) {
                        status = 'Encerrado';
                        statusColor = 'bg-gray-100 text-gray-800';
                      } else if (agora >= dataInicio && agora <= dataFim) {
                        status = 'Em andamento';
                        statusColor = 'bg-green-100 text-green-800';
                      }
                      
                      return (
                        <tr key={evento.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/eventos/${evento.id}`)}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{evento.nome}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{evento.local}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{formatarData(evento.dataInicio)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{formatarData(evento.dataFim)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}`}>
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                
                {eventos.length > 5 && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => navigate('/admin/eventos')}
                      className="text-primary hover:text-primary-700 font-medium"
                    >
                      Ver todos os eventos
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </LayoutDefault>
  );
};

export default AdminDashboard;