import * as XLSX from 'xlsx';
import { Participante } from '../models/types';

export const exportToXLSX = (participantes: Participante[]) => {
  const data = participantes.map(p => ({
    Nome: p.nome,
    Empresa: p.empresa,
    Email: p.email1,
    Telefone: p.telefone,
    Categoria: p.categoria,
    Status: p.status,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Participantes');
  XLSX.writeFile(workbook, 'participantes.xlsx');
};
