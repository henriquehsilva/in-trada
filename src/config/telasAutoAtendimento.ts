import type { TelaAutoAtendimento } from '../models/types';

export interface OpcaoTelaAutoAtendimento {
  id: TelaAutoAtendimento;
  nome: string;
}

export const TELA_AUTOATENDIMENTO_PADRAO: TelaAutoAtendimento = 'default';

export const TELAS_AUTOATENDIMENTO: OpcaoTelaAutoAtendimento[] = [
  { id: 'default', nome: 'IN-TRADA (padrão)' },
  { id: 'wake', nome: 'Wake' },
];

export function obterNomeTelaAutoAtendimento(id: TelaAutoAtendimento): string {
  return TELAS_AUTOATENDIMENTO.find((tela) => tela.id === id)?.nome || id;
}
