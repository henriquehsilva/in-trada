/** Normaliza texto para comparacoes sem diferenciar maiusculas ou acentos. */
export const normalizeText = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
