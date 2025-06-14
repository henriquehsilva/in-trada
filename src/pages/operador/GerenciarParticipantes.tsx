import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Download, Filter, Trash2, Edit } from 'lucide-react';
import LayoutDefault from '../../components/layout/LayoutDefault';
import { useAuth } from '../../contexts/AuthContext';
import { Evento, Participante } from '../../models/types';
import { obterEventos } from '../../services/eventoService';
import {
  obterParticipantesPorEvento,
  buscarParticipantes,
  excluirParticipante
} from '../../services/participanteService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PieChart, Pie, Cell, Tooltip, Label } from 'recharts';

const GerenciarParticipantes: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedEventoId = searchParams.get('eventoId') || '';

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoSelecionado, setEventoSelecionado] = useState<string>(selectedEventoId);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const coresStatus = {
    credenciado: '#22c55e',
    confirmado: '#3b82f6',
    pendente: '#a1a1aa',
    cancelado: '#ef4444'
  };

  useEffect(() => {
    const carregarEventos = async () => {
      try {
        const lista = await obterEventos();
        setEventos(lista);
        if (!eventoSelecionado && lista.length > 0) {
          const primeiro = lista[0].id;
          setEventoSelecionado(primeiro);
          setSearchParams({ eventoId: primeiro });
        }
      } catch (err) {
        console.error('Erro ao carregar eventos:', err);
        setError('Erro ao carregar eventos.');
      }
    };
    carregarEventos();
  }, []);

  useEffect(() => {
    const carregarParticipantes = async () => {
      if (!eventoSelecionado) return;
      setLoading(true);
      try {
        const participantesDados = await obterParticipantesPorEvento(eventoSelecionado);
        setParticipantes(participantesDados);
      } catch (err) {
        console.error('Erro ao carregar participantes:', err);
        setError('Erro ao carregar participantes.');
      } finally {
        setLoading(false);
      }
    };
    carregarParticipantes();
  }, [eventoSelecionado]);

  const handleSearch = async () => {
    if (!eventoSelecionado) return;
    if (!termoBusca.trim()) {
      const participantesDados = await obterParticipantesPorEvento(eventoSelecionado);
      setParticipantes(participantesDados);
      return;
    }
    try {
      setLoading(true);
      const resultados = await buscarParticipantes(eventoSelecionado, termoBusca);
      setParticipantes(resultados);
    } catch (err) {
      console.error('Erro ao buscar participantes:', err);
      setError('Erro ao buscar participantes.');
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirParticipante = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este participante?')) return;
    try {
      await excluirParticipante(id);
      setParticipantes(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error('Erro ao excluir participante:', err);
      setError('Erro ao excluir participante.');
    }
  };

  const formatarData = (dataString: string) => {
    try {
      const data = new Date(dataString);
      return format(data, "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return dataString;
    }
  };

  const statusCounts = {
    credenciado: participantes.filter(p => p.status === 'credenciado').length,
    confirmado: participantes.filter(p => p.status === 'confirmado').length,
    pendente: participantes.filter(p => p.status === 'pendente').length,
    cancelado: participantes.filter(p => p.status === 'cancelado').length,
  };

  const total = Object.values(statusCounts).reduce((sum, val) => sum + val, 0);

  const gerarDadosDonut = (status: keyof typeof coresStatus) => [
    { name: status, value: statusCounts[status] },
    { name: 'outros', value: total - statusCounts[status] }
  ];

  const renderDonut = (dados: any[], titulo: string, cor: string) => {
    const total = dados[0].value;
    return (
      <div className="flex flex-col items-center">
        <PieChart width={180} height={180}>
          <Pie
            data={dados}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            dataKey="value"
          >
            {dados.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={index === 0 ? cor : '#e5e7eb'} />
            ))}
            <Label
              value={total}
              position="center"
              fontSize={16}
              fontWeight="bold"
              fill="#000"
            />
          </Pie>
          <Tooltip />
        </PieChart>
        <span
          className="text-sm font-medium mt-2 cursor-pointer"
          onClick={() => setStatusFiltro(titulo.toLowerCase() as keyof typeof coresStatus)}
        >
          {titulo}
        </span>        
      </div>
    );
  };

  const participantesFiltrados = statusFiltro === 'todos' ? participantes : participantes.filter(p => p.status === statusFiltro);

  return (
    <LayoutDefault title="Gerenciar Participantes" backUrl="/operador">
      {error && <div className="bg-error-light text-error p-4 rounded-md mb-4">{error}</div>}

      <div className="bg-white p-4 rounded-lg shadow-sm mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <select
            value={eventoSelecionado}
            onChange={(e) => {
              setEventoSelecionado(e.target.value);
              setSearchParams({ eventoId: e.target.value });
            }}
            className="input-field w-full sm:max-w-sm"
          >
            {eventos.map((evento) => (
              <option key={evento.id} value={evento.id}>{evento.nome}</option>
            ))}
          </select>
          {statusFiltro !== 'todos' && (
            <button
              onClick={() => setStatusFiltro('todos')}
              className="btn btn-sm btn-outline"
            >
              Limpar Filtro
            </button>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/operador/participantes/${eventoSelecionado}/importar`)}
              className="btn btn-outline flex items-center"
            >
              <Download className="w-5 h-5 mr-2" /> Importar
            </button>
            <button
              onClick={() => navigate(`/operador/participantes/${eventoSelecionado}/novo`)}
              className="btn btn-primary flex items-center"
            >
              <Plus className="w-5 h-5 mr-2" /> Novo Participante
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-8 justify-center md:justify-start">
          {renderDonut(gerarDadosDonut('credenciado'), 'Credenciado', coresStatus.credenciado)}
          {renderDonut(gerarDadosDonut('confirmado'), 'Confirmado', coresStatus.confirmado)}
          {renderDonut(gerarDadosDonut('pendente'), 'Pendente', coresStatus.pendente)}
          {renderDonut(gerarDadosDonut('cancelado'), 'Cancelado', coresStatus.cancelado)}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Buscar por nome, email ou empresa..."
            className="input-field w-full"
          />
          <button onClick={handleSearch} className="btn btn-primary flex items-center">
            <Search className="w-5 h-5" />
          </button>
          <button className="btn btn-outline flex items-center" title="Filtros avançados">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cadastrado em</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                <th className="relative px-6 py-3"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {participantes.filter(p => statusFiltro === 'todos' || p.status === statusFiltro)
                .map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.nome}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.email1}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.empresa}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary-100 text-primary">{p.categoria}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      p.status === 'credenciado' ? 'bg-success-light text-success' :
                      p.status === 'confirmado' ? 'bg-primary-100 text-primary' :
                      p.status === 'cancelado' ? 'bg-error-light text-error' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {p.status === 'credenciado' ? 'Credenciado' :
                       p.status === 'confirmado' ? 'Confirmado' :
                       p.status === 'cancelado' ? 'Cancelado' : 'Pendente'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatarData(p.criadoEm)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => navigate(`/operador/participantes/${eventoSelecionado}/${p.id}/editar`)}
                        className="text-primary hover:text-primary-700"
                        title="Editar participante"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleExcluirParticipante(p.id)}
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
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum participante encontrado</h3>
                    <p className="text-gray-500 mb-4">{termoBusca ? 'Tente ajustar os termos da busca ou limpar os filtros.' : 'Comece adicionando participantes ao evento.'}</p>
                    {!termoBusca && (
                      <button
                        onClick={() => navigate(`/operador/participantes/${eventoSelecionado}/novo`)}
                        className="btn btn-primary"
                      >
                        <Plus className="w-5 h-5 mr-2" /> Adicionar Participante
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
