import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import LayoutDefault from '../../components/layout/LayoutDefault';
import { obterEventos } from '../../services/eventoService';
import { Evento } from '../../models/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { baixarFirestoreParaEmulator } from '../../services/emulatorSyncService';
import { useAuth } from '../../contexts/AuthContext';


const AdminDashboard: React.FC = () => {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [modalSincronizacaoAberto, setModalSincronizacaoAberto] = useState(false);
  const [emailProducao, setEmailProducao] = useState('');
  const [senhaProducao, setSenhaProducao] = useState('');
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
      return format(data, 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dataString;
    }
  };

  const navegarParaNovoEvento = () => {
    navigate('/admin/eventos/novo');
  };

  const abrirSincronizacao = () => {
    setEmailProducao(currentUser?.email ?? '');
    setSenhaProducao('');
    setModalSincronizacaoAberto(true);
  };

  const baixarDadosOnline = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSincronizando(true);
    try {
      const resultado = await baixarFirestoreParaEmulator(
        emailProducao.trim(),
        senhaProducao,
      );
      const eventosData = await obterEventos();
      setEventos(eventosData);
      setModalSincronizacaoAberto(false);
      setSenhaProducao('');
      toast.success(`${resultado.total} documentos baixados para o emulador.`);
    } catch (err) {
      console.error('Erro ao baixar dados para o emulador:', err);
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Não foi possível atualizar a base local: ${mensagem}`);
    } finally {
      setSincronizando(false);
    }
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
              {import.meta.env.VITE_USE_EMULATORS === '1' && (
                <button
                  type="button"
                  onClick={abrirSincronizacao}
                  disabled={sincronizando}
                  className="btn btn-outline inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                  title="Copia os dados do Firestore online para o emulador local"
                >
                  <Download className={`h-4 w-4 ${sincronizando ? 'animate-bounce' : ''}`} />
                  {sincronizando ? 'Atualizando base local...' : 'Atualizar base local'}
                </button>
              )}
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

      {modalSincronizacaoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={baixarDadosOnline}
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-gray-900">
              Atualizar base local
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Entre com um administrador da produção. Documentos locais com o
              mesmo ID serão sobrescritos.
            </p>

            <label className="mt-5 block text-sm font-medium text-gray-700">
              E-mail da produção
              <input
                type="email"
                required
                autoComplete="username"
                value={emailProducao}
                onChange={(event) => setEmailProducao(event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </label>

            <label className="mt-4 block text-sm font-medium text-gray-700">
              Senha da produção
              <input
                type="password"
                required
                autoComplete="current-password"
                value={senhaProducao}
                onChange={(event) => setSenhaProducao(event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={sincronizando}
                onClick={() => setModalSincronizacaoAberto(false)}
                className="btn btn-outline"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={sincronizando}
                className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sincronizando ? 'Atualizando...' : 'Baixar dados'}
              </button>
            </div>
          </form>
        </div>
      )}
    </LayoutDefault>
  );
};

export default AdminDashboard;
