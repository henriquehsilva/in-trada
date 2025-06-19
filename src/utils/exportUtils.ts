import * as XLSX from 'xlsx';
import { Participante } from '../models/types';

export const exportToXLSX = (participantes: Participante[]) => {
  const data = participantes.map(p => {
    let criadoData = '';
    let criadoHorario = '';
    let atualizadoData = '';
    let atualizadoHorario = '';

    // se não for "pendente", preenchemos as partes de data/hora
    if (p.status !== 'pendente') {
      if (p.criadoEm) {
        const dCriado = new Date(p.criadoEm);
        criadoData = dCriado.toLocaleDateString('pt-BR');
        criadoHorario = dCriado.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      if (p.atualizadoEm) {
        const dAtual = new Date(p.atualizadoEm);
        atualizadoData = dAtual.toLocaleDateString('pt-BR');
        atualizadoHorario = dAtual.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    }

    return {
      ID: p.id,
      EventoID: p.eventoId,
      Nome: p.nome,
      Empresa: p.empresa,
      NomeCracha: p.nomeCracha,
      EmpresaCracha: p.empresaCracha,
      Cargo: p.cargo,
      Email1: p.email1,
      Email2: p.email2,
      Celular: p.celular,
      Telefone: p.telefone,
      Categoria: p.categoria,
      Observacao: p.observacao,
      CPF: p.cpf,
      RG: p.rg,
      CNPJ: p.cnpj,
      CodigoCliente: p.codigoCliente,
      Opcao1: p.opcao1,
      Opcao2: p.opcao2,
      Opcao3: p.opcao3,
      Opcao4: p.opcao4,
      Opcao5: p.opcao5,
      Opcao6: p.opcao6,
      Opcao7: p.opcao7,
      Opcao8: p.opcao8,
      Opcao9: p.opcao9,
      Opcao10: p.opcao10,
      Status: p.status,
      CriadoData: criadoData,
      CriadoHorario: criadoHorario,
      AtualizadoData: atualizadoData,
      AtualizadoHorario: atualizadoHorario
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Participantes');
  XLSX.writeFile(workbook, 'participantes.xlsx');
};
