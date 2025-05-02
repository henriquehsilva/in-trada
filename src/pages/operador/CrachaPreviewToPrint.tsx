// components/editor/CrachaPreviewToPrint.tsx
import React from 'react';
import QRCode from 'qrcode.react';
import { ComponenteEditor } from '../../models/types';

interface Props {
  componentes: ComponenteEditor[];
  participante: Record<string, string>;
  tamanho: { largura: number; altura: number };
}

const CrachaPreviewToPrint: React.FC<Props> = ({ componentes, participante, tamanho }) => {
  return (
    <div style={{ width: tamanho.largura, height: tamanho.altura, position: 'relative', background: 'white' }}>
      {componentes.map((comp) => {
        const props = comp.propriedades;
        const valor = props.campoVinculado
          ? participante[props.campoVinculado as keyof typeof participante] || ''
          : props.texto || '';

        return (
          <div
            key={comp.id}
            style={{
              position: 'absolute',
              top: props.y,
              left: props.x,
              width: props.largura,
              height: props.altura,
              fontSize: props.estilos?.tamanhoFonte,
              fontWeight: props.estilos?.negrito ? 'bold' : 'normal',
              textAlign: props.estilos?.alinhamento,
              color: props.estilos?.corFonte,
              backgroundColor: props.estilos?.corFundo,
              borderRadius: props.estilos?.raio,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}
          >
            {comp.tipo === 'qrcode' ? (
              <QRCode value={JSON.stringify(participante)} size={props.altura} />
            ) : (
              valor
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CrachaPreviewToPrint;
