export interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: 'admin' | 'operador' | 'recepcionista';
  eventoId?: string; // Para recepcionistas
  criadoEm: string;
  atualizadoEm: string;
}

export interface Evento {
  id: string;
  nome: string;
  descricao: string;
  dataInicio: string;
  dataFim: string;
  local: string;
  criadoPorId: string;
  criadoEm: string;
  atualizadoEm: string;
  camposPersonalizados: CampoPersonalizado[];
  quantidadeParticipantes?: number;
}

export interface CampoPersonalizado {
  id: string;
  nome: string;
  tipo: 'texto' | 'numero' | 'data' | 'selecao' | 'checkbox';
  obrigatorio: boolean;
  opcoes?: string[]; // Para campos do tipo 'selecao'
}

export interface Participante {
  id: string;
  eventoId: string;
  nome: string;
  empresa: string;
  nomeCracha: string;
  empresaCracha: string;
  cargo: string;
  email1: string;
  email2: string;
  celular: string;
  telefone: string;
  categoria: string;
  observacao: string;
  cpf: string;
  rg: string;
  cnpj: string;
  codigoCliente: string;
  opcao1: string;
  opcao2: string;
  opcao3: string;
  opcao4: string;
  opcao5: string;
  opcao6: string;
  opcao7: string;
  opcao8: string;
  opcao9: string;
  opcao10: string;
  status: 'pendente' | 'confirmado' | 'credenciado' | 'cancelado';
  criadoEm: string;
  atualizadoEm: string;
  criadoPorId: string;
  camposPersonalizados: { [key: string]: any };
}

export interface ModeloCracha {
  id: string;
  eventoId: string;
  nome: string;
  componentes: ComponenteEditor[];
  criadoPorId: string;
  criadoEm: string;
  atualizadoEm: string;
  padrao?: boolean;
  larguraCm?: number;
  alturaCm?: number; 
}

export interface ModeloPainel {
  id: string;
  eventoId: string;
  nome: string;
  componentes: ComponenteEditor[];
  criadoPorId: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface EstilosComponente {
  corFonte?: string;
  tamanhoFonte?: number;
  alinhamento?: 'left' | 'center' | 'right';
  negrito?: boolean;
  italico?: boolean;
  sublinhado?: boolean;
  corFundo?: string;
  bordaLargura?: number;
  bordaCor?: string;
  raio?: number;
  fonte?: string;
  [key: string]: string | number | boolean | undefined; // <-- Esta linha permite indexação dinâmica
}

export interface ComponenteEditor {
  id: string;
  tipo: 'texto' | 'campo' | 'botao' | 'qrcode' | 'imagem' | 'divisao' | 'barcode';
  propriedades: {
    x: number;
    y: number;
    largura: number;
    altura: number;
    texto?: string;
    campoVinculado?: string;
    estilos?: EstilosComponente;
    url?: string;
  };
}

export interface Acao {
  id: string;
  usuarioId: string;
  tipo: 'login' | 'logout' | 'criar' | 'atualizar' | 'excluir' | 'checkin';
  entidade: 'usuario' | 'evento' | 'participante' | 'modelo';
  entidadeId: string;
  metadados: any;
  dataHora: string;
}
