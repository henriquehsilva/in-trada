import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QrCode, Search, UserPlus, CheckCircle, Printer, Edit } from 'lucide-react';
import LayoutDefault from '../../components/layout/LayoutDefault';
import QrCodeScanner from '../../components/qrcode/QrCodeScanner';
import { 
  obterEventoPorId 
} from '../../services/eventoService';
import { 
  obterParticipantesPorEvento,
  buscarParticipantes,
  obterParticipantePorId,
  fazerCheckin,
  criarParticipante
} from '../../services/participanteService';
import { useAuth } from '../../contexts/AuthContext';
import { Evento, Participante } from '../../models/types';
import { Dialog } from '@headlessui/react';
import qz from 'qz-tray';
import { obterModelosCrachaPorEvento } from '../../services/modeloService';
import { ModeloCracha } from '../../models/types';
import QRCode from 'qrcode';

const PainelRecepcao: React.FC = () => {
  const navigate = useNavigate();
  const { eventoId } = useParams<{ eventoId: string }>();
  const { currentUser } = useAuth();
  
  const [evento, setEvento] = useState<Evento | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [participanteSelecionado, setParticipanteSelecionado] = useState<Participante | null>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [termoBusca, setTermoBusca] = useState('');
  const [showFormNovoParticipante, setShowFormNovoParticipante] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error' | 'info', texto: string } | null>(null);
  const [confirmarImpressao, setConfirmarImpressao] = useState(false);
  // Refs para formulário de novo participante
  const nomeRef = useRef<HTMLInputElement>(null);
  const empresaRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const telefoneRef = useRef<HTMLInputElement>(null);
  const categoriaRef = useRef<HTMLSelectElement>(null);
  
  // Campos personalizados para o formulário
  const [camposPersonalizadosValues, setCamposPersonalizadosValues] = useState<Record<string, any>>({});

  const obterModeloPadrao = async (eventoId: string): Promise<ModeloCracha | null> => {
  const modelos = await obterModelosCrachaPorEvento(eventoId);
    return modelos.find(m => m.padrao) || null;
  };

  useEffect(() => {
    const carregarDados = async () => {
      if (!eventoId) return;
      
      try {
        // Carrega dados do evento
        const eventoDados = await obterEventoPorId(eventoId);
        if (eventoDados) {
          setEvento(eventoDados);
          
          // Carrega participantes do evento
          const participantesDados = await obterParticipantesPorEvento(eventoId);
          setParticipantes(participantesDados);
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        setMensagem({
          tipo: 'error',
          texto: 'Erro ao carregar dados. Tente novamente mais tarde.'
        });
      } finally {
        setLoading(false);
      }
    };
    
    carregarDados();
  }, [eventoId]);

  const handleSearch = async () => {
    if (!eventoId || !termoBusca.trim()) return;
    
    try {
      setLoading(true);
      const resultados = await buscarParticipantes(eventoId, termoBusca);
      setParticipantes(resultados);
      
      if (resultados.length === 0) {
        setMensagem({
          tipo: 'info',
          texto: 'Nenhum participante encontrado. Deseja cadastrar um novo?'
        });
      } else {
        setMensagem(null);
      }
    } catch (err) {
      console.error('Erro ao buscar participantes:', err);
      setMensagem({
        tipo: 'error',
        texto: 'Erro ao buscar participantes. Tente novamente.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQrCodeScan = async (data: string) => {
    try {
      // Assume que o QR Code contém o ID do participante
      let participanteId = data;
      
      // Se o QR Code contém um JSON, extrai o ID
      try {
        const jsonData = JSON.parse(data);
        participanteId = jsonData.id || data;
      } catch {
        // Não é um JSON válido, usa o dado como está
      }
      
      const participante = await obterParticipantePorId(participanteId);
      
      if (participante) {
        setParticipanteSelecionado(participante);
        setShowQrScanner(false);
        
        // Mostra mensagem dependendo do status
        if (participante.status === 'credenciado') {
          setMensagem({
            tipo: 'info',
            texto: 'Participante já realizou check-in anteriormente.'
          });
        } else {
          setMensagem({
            tipo: 'success',
            texto: 'Participante encontrado! Realize o check-in.'
          });
        }
      } else {
        setMensagem({
          tipo: 'error',
          texto: 'Participante não encontrado com este QR Code.'
        });
      }
    } catch (err) {
      console.error('Erro ao processar QR Code:', err);
      setMensagem({
        tipo: 'error',
        texto: 'Erro ao processar QR Code. Tente novamente.'
      });
    }
  };

  const handleSelectParticipante = (participante: Participante) => {
    setParticipanteSelecionado(participante);
    setMensagem(null);
  };

  const handleCheckin = async () => {
    if (!participanteSelecionado) return;
    
    try {
      setLoading(true);
      await fazerCheckin(participanteSelecionado.id);
      
      // Atualiza status localmente
      const participanteAtualizado = { 
        ...participanteSelecionado, 
        status: 'credenciado' as const 
      };
      setParticipanteSelecionado(participanteAtualizado);
      
      // Atualiza na lista de participantes
      setParticipantes(prev => 
        prev.map(p => p.id === participanteAtualizado.id ? participanteAtualizado : p)
      );
      
      setMensagem({
        tipo: 'success',
        texto: 'Check-in realizado com sucesso!'
      });
      
      // Limpa a mensagem após 3 segundos
      setTimeout(() => setMensagem(null), 3000);
    } catch (err) {
      console.error('Erro ao fazer check-in:', err);
      setMensagem({
        tipo: 'error',
        texto: 'Erro ao fazer check-in. Tente novamente.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckinComConfirmacao = () => {
    setConfirmarImpressao(true);
  };

  const confirmarCheckin = async (imprimir: boolean) => {
    setConfirmarImpressao(false);
    await handleCheckin();
    if (imprimir) {
      handlePrintCredencial();
    }
  };

  const handlePrintCredencial = async () => {
    if (!participanteSelecionado || !evento) return;

    try {
      const modelos = await obterModelosCrachaPorEvento(evento.id);
      const modeloPadrao = modelos.find((m) => m.padrao);

      if (!modeloPadrao) {
        setMensagem({
          tipo: 'error',
          texto: 'Nenhum modelo de crachá padrão definido para este evento.',
        });
        return;
      }

      // Gera o QR code como imagem base64
      const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(participanteSelecionado));

      const htmlComponente = modeloPadrao.componentes.map(comp => {
        const props = comp.propriedades;
        const valor = props.campoVinculado
          ? participanteSelecionado[props.campoVinculado as keyof typeof participanteSelecionado] || ''
          : props.texto || '';

        if (comp.tipo === 'qrcode') {
          return `
            <div style="position:absolute; top:${props.y}px; left:${props.x}px; width:${props.largura}px; height:${props.altura}px;">
              <img src="${qrCodeDataUrl}" width="${props.largura}" height="${props.altura}" />
            </div>
          `;
        }

        return `
          <div style="
            position:absolute;
            top:${props.y}px; left:${props.x}px;
            width:${props.largura}px; height:${props.altura}px;
            font-size:${props.estilos?.tamanhoFonte || 14}px;
            font-weight:${props.estilos?.negrito ? 'bold' : 'normal'};
            font-family:${props.estilos?.fonte || 'Arial'};
            text-align:${props.estilos?.alinhamento || 'left'};
            color:${props.estilos?.corFonte || '#000'};
            background-color:${props.estilos?.corFundo || 'transparent'};
            border-radius:${props.estilos?.raio || 0}px;
            display:flex; align-items:center; justify-content:center;
            overflow:hidden;
          ">
            ${valor}
          </div>
        `;
      }).join('');

      const largura = 400;
      const altura = 200;

      const html = `
        <html>
          <head>
            <title>Imprimir Crachá</title>
            <style>
              @page { size: ${largura}px ${altura}px; margin: 0; }
              body { margin: 0; padding: 0; }
            </style>
          </head>
          <body>
            <div style="position:relative; width:${largura}px; height:${altura}px;">
              ${htmlComponente}
            </div>
            <script>
              window.onload = function () {
                window.print();
                setTimeout(() => window.close(), 300);
              };
            </script>
          </body>
        </html>
      `;

      const printWindow = window.open('', '_blank', 'width=600,height=400');
      if (!printWindow) return;

      printWindow.document.write(html);
      printWindow.document.close();

      setMensagem({
        tipo: 'success',
        texto: 'Credencial enviada para impressão!',
      });

    } catch (err) {
      console.error('Erro ao imprimir:', err);
      setMensagem({
        tipo: 'error',
        texto: 'Erro ao imprimir credencial.',
      });
    }
  };

  const handleCadastrarParticipante = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!eventoId || !currentUser?.uid) return;
    
    try {
      setLoading(true);
      
      // Coleta dados do formulário
      const novoParticipante: Omit<Participante, 'id' | 'criadoEm' | 'atualizadoEm'> = {
        eventoId,
        nome: nomeRef.current?.value || '',
        empresa: empresaRef.current?.value || '',
        email1: emailRef.current?.value || '',
        email2: emailRef.current?.value || '',
        celular: telefoneRef.current?.value || '',
        nomeCracha: nomeRef.current?.value || '',
        empresaCracha: empresaRef.current?.value || '',
        cargo: '',
        observacao: '',
        cpf: '',
        rg: '',
        cnpj: '',
        codigoCliente: '',
        opcao1: '',
        opcao2: '',
        opcao3: '',
        opcao4: '',
        opcao5: '',
        opcao6: '',
        opcao7: '',
        opcao8: '',
        opcao9: '',
        opcao10: '',
        telefone: telefoneRef.current?.value || '',
        categoria: categoriaRef.current?.value || '',
        status: 'pendente',
        criadoPorId: currentUser.uid,
        camposPersonalizados: camposPersonalizadosValues
      };
      
      // Cria participante no banco de dados
      const participanteId = await criarParticipante(novoParticipante);
      
      // Adiciona à lista local
      const participanteCriado: Participante = {
        ...novoParticipante,
        id: participanteId,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
      };
      
      setParticipantes(prev => [participanteCriado, ...prev]);
      setParticipanteSelecionado(participanteCriado);
      setShowFormNovoParticipante(false);
      
      setMensagem({
        tipo: 'success',
        texto: 'Participante cadastrado com sucesso! Realize o check-in.'
      });
      
      // Limpa campos personalizados
      setCamposPersonalizadosValues({});
    } catch (err) {
      console.error('Erro ao cadastrar participante:', err);
      setMensagem({
        tipo: 'error',
        texto: 'Erro ao cadastrar participante. Tente novamente.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCampoPersonalizadoChange = (id: string, valor: any) => {
    setCamposPersonalizadosValues(prev => ({
      ...prev,
      [id]: valor
    }));
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
      title={`Recepção: ${evento.nome}`} 
      backUrl="/recepcionista"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1: Busca e Lista */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-semibold mb-3">Buscar Participante</h3>
            
            <div className="flex mb-3">
              <input
                type="text"
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Nome, email ou empresa"
                className="input-field flex-grow mr-2"
              />
              <button
                onClick={handleSearch}
                className="btn btn-primary flex items-center justify-center"
              >
                <Search className="w-5 h-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowQrScanner(!showQrScanner)}
                className="btn btn-outline flex items-center justify-center"
              >
                <QrCode className="w-5 h-5 mr-2" />
                {showQrScanner ? 'Fechar Scanner' : 'Ler QR Code'}
              </button>
              
              <button
                onClick={() => setShowFormNovoParticipante(!showFormNovoParticipante)}
                className="btn btn-outline flex items-center justify-center"
              >
                <UserPlus className="w-5 h-5 mr-2" />
                {showFormNovoParticipante ? 'Cancelar' : 'Novo'}
              </button>
            </div>
          </div>
          
          {showQrScanner && (
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="font-semibold mb-3">Scanner QR Code</h3>
              <QrCodeScanner onScan={handleQrCodeScan} />
            </div>
          )}
          
          {mensagem && (
            <div className={`p-3 rounded-md ${
              mensagem.tipo === 'success' 
                ? 'bg-success-light text-success' 
                : mensagem.tipo === 'error'
                ? 'bg-error-light text-error'
                : 'bg-warning-light text-warning'
            }`}>
              {mensagem.texto}
            </div>
          )}
          
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-semibold mb-3">Participantes</h3>
            
            {participantes.length === 0 ? (
              <p className="text-gray-500 text-sm">
                Nenhum participante encontrado.
              </p>
            ) : (
              <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                {participantes.map((participante) => (
                  <div
                    key={participante.id}
                    className={`py-3 cursor-pointer hover:bg-gray-50 ${
                      participanteSelecionado?.id === participante.id ? 'bg-gray-50' : ''
                    }`}
                    onClick={() => handleSelectParticipante(participante)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{participante.nome}</h4>
                        <p className="text-sm text-gray-600">{participante.empresa}</p>
                        <p className="text-xs text-gray-500">{participante.email1}</p>
                      </div>
                      <div>
                        <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                          participante.status === 'credenciado' 
                            ? 'bg-success-light text-success' 
                            : participante.status === 'confirmado'
                            ? 'bg-primary-100 text-primary'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {participante.status === 'credenciado' 
                            ? 'Credenciado' 
                            : participante.status === 'confirmado'
                            ? 'Confirmado'
                            : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Coluna 2: Formulário de Novo Participante ou Detalhes do Participante */}
        <div className="lg:col-span-2">
          {showFormNovoParticipante ? (
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <h3 className="font-semibold mb-4">Cadastrar Novo Participante</h3>
              
              <form onSubmit={handleCadastrarParticipante}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome completo *
                    </label>
                    <input
                      type="text"
                      ref={nomeRef}
                      required
                      className="input-field"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Empresa
                    </label>
                    <input
                      type="text"
                      ref={empresaRef}
                      className="input-field"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      ref={emailRef}
                      required
                      className="input-field"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telefone
                    </label>
                    <input
                      type="tel"
                      ref={telefoneRef}
                      className="input-field"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categoria *
                    </label>
                    <select
                      ref={categoriaRef}
                      required
                      className="input-field"
                    >
                      <option value="">Selecione uma categoria</option>
                      <option value="Participante">Participante</option>
                      <option value="Palestrante">Palestrante</option>
                      <option value="Staff">Staff</option>
                      <option value="VIP">VIP</option>
                      <option value="Imprensa">Imprensa</option>
                    </select>
                  </div>
                </div>
                
                {/* Campos personalizados do evento */}
                {evento.camposPersonalizados && evento.camposPersonalizados.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">Informações adicionais</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {evento.camposPersonalizados.map((campo) => (
                        <div key={campo.id}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {campo.nome} {campo.obrigatorio ? '*' : ''}
                          </label>
                          
                          {campo.tipo === 'texto' && (
                            <input
                              type="text"
                              value={camposPersonalizadosValues[campo.id] || ''}
                              onChange={(e) => handleCampoPersonalizadoChange(campo.id, e.target.value)}
                              required={campo.obrigatorio}
                              className="input-field"
                            />
                          )}
                          
                          {campo.tipo === 'numero' && (
                            <input
                              type="number"
                              value={camposPersonalizadosValues[campo.id] || ''}
                              onChange={(e) => handleCampoPersonalizadoChange(campo.id, e.target.value)}
                              required={campo.obrigatorio}
                              className="input-field"
                            />
                          )}
                          
                          {campo.tipo === 'data' && (
                            <input
                              type="date"
                              value={camposPersonalizadosValues[campo.id] || ''}
                              onChange={(e) => handleCampoPersonalizadoChange(campo.id, e.target.value)}
                              required={campo.obrigatorio}
                              className="input-field"
                            />
                          )}
                          
                          {campo.tipo === 'selecao' && campo.opcoes && (
                            <select
                              value={camposPersonalizadosValues[campo.id] || ''}
                              onChange={(e) => handleCampoPersonalizadoChange(campo.id, e.target.value)}
                              required={campo.obrigatorio}
                              className="input-field"
                            >
                              <option value="">Selecione uma opção</option>
                              {campo.opcoes.map((opcao, index) => (
                                <option key={index} value={opcao}>
                                  {opcao}
                                </option>
                              ))}
                            </select>
                          )}
                          
                          {campo.tipo === 'checkbox' && (
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id={`campo-${campo.id}`}
                                checked={camposPersonalizadosValues[campo.id] || false}
                                onChange={(e) => handleCampoPersonalizadoChange(campo.id, e.target.checked)}
                                required={campo.obrigatorio}
                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                              />
                              <label htmlFor={`campo-${campo.id}`} className="ml-2 block text-sm text-gray-900">
                                Sim
                              </label>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowFormNovoParticipante(false)}
                    className="btn btn-outline mr-2"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary"
                  >
                    {loading ? 'Salvando...' : 'Cadastrar e Credenciar'}
                  </button>
                </div>
              </form>
            </div>
          ) : participanteSelecionado ? (
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold">Detalhes do Participante</h3>
                <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                  participanteSelecionado.status === 'credenciado' 
                    ? 'bg-success-light text-success' 
                    : participanteSelecionado.status === 'confirmado'
                    ? 'bg-primary-100 text-primary'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {participanteSelecionado.status === 'credenciado' 
                    ? 'Credenciado' 
                    : participanteSelecionado.status === 'confirmado'
                    ? 'Confirmado'
                    : 'Pendente'}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">Nome</p>
                  <p className="font-medium">{participanteSelecionado.nome}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Empresa</p>
                  <p className="font-medium">{participanteSelecionado.empresa || '-'}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{participanteSelecionado.email1}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Telefone</p>
                  <p className="font-medium">{participanteSelecionado.telefone || '-'}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Categoria</p>
                  <p className="font-medium">{participanteSelecionado.categoria}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">ID</p>
                  <p className="font-medium">{participanteSelecionado.id}</p>
                </div>
              </div>
              
              {/* Informações personalizadas */}
              {participanteSelecionado.camposPersonalizados && 
               Object.keys(participanteSelecionado.camposPersonalizados).length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium mb-2">Informações adicionais</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(participanteSelecionado.camposPersonalizados).map(([key, value]) => {
                      // Encontra o campo personalizado correspondente
                      const campo = evento.camposPersonalizados?.find(c => c.id === key);
                      return (
                        <div key={key}>
                          <p className="text-sm text-gray-500">{campo?.nome || key}</p>
                          <p className="font-medium">
                            {typeof value === 'boolean' 
                              ? (value ? 'Sim' : 'Não')
                              : value || '-'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => navigate(`/operador/participantes/${eventoId}/${participanteSelecionado.id}/editar`)}
                  className="btn btn-outline flex items-center"
                  title="Editar participante"
                >
                  <Edit className="w-5 h-5 mr-2" /> Editar Participante
                </button>

                {participanteSelecionado.status !== 'credenciado' && (
                  <button
                    onClick={handleCheckinComConfirmacao}
                    disabled={loading}
                    className="btn btn-primary flex items-center"
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    {loading ? 'Processando...' : 'Fazer Check-in'}
                  </button>
                )}
                
                <button
                  onClick={handlePrintCredencial}
                  className="btn btn-outline flex items-center"
                >
                  <Printer className="w-5 h-5 mr-2" />
                  Imprimir Credencial
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="text-center py-12">
                <QrCode className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="font-semibold text-lg mb-2">Nenhum participante selecionado</h3>
                <p className="text-gray-500 mb-4">
                  Selecione um participante da lista ou use as opções abaixo:
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => setShowQrScanner(true)}
                    className="btn btn-outline flex items-center"
                  >
                    <QrCode className="w-5 h-5 mr-2" />
                    Ler QR Code
                  </button>
                  
                  <button
                    onClick={() => setShowFormNovoParticipante(true)}
                    className="btn btn-primary flex items-center"
                  >
                    <UserPlus className="w-5 h-5 mr-2" />
                    Cadastrar Novo
                  </button>
                </div>
              </div>
            </div>
          )}
          {confirmarImpressao && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
              <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
                <h2 className="text-lg font-semibold mb-4">Deseja imprimir a credencial?</h2>
                <div className="flex justify-end gap-4">
                  <button
                    onClick={() => confirmarCheckin(false)}
                    className="btn btn-outline"
                  >
                    Não
                  </button>
                  <button
                    onClick={() => confirmarCheckin(true)}
                    className="btn btn-primary"
                  >
                    Sim
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </LayoutDefault>
  );
};

export default PainelRecepcao;