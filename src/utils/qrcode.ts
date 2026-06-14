export function buildQrValue(
  participante: Record<string, any>,
  camposQrCode?: string[],
  separadorQrCode?: string
): string {
  if (!camposQrCode || camposQrCode.length === 0) {
    return participante?.codigoCliente?.toString?.() || participante?.id?.toString?.() || '';
  }
  const sep = separadorQrCode ?? ';';
  return camposQrCode
    .map((campo) => {
      const val = participante?.[campo] ?? participante?.camposPersonalizados?.[campo] ?? '';
      return val?.toString?.() ?? '';
    })
    .join(sep);
}
