import React from 'react';
import QRCode from 'qrcode.react';
import Barcode from 'react-barcode';
import { ComponenteEditor } from '../../models/types';

interface Props {
  componentes: ComponenteEditor[];
  participante: Record<string, string>;
  tamanho: { largura: number; altura: number };
}

const CrachaPreviewToPrint: React.FC<Props> = ({ componentes, participante, tamanho }) => {
  return (
    <div
      style={{
        width: tamanho.largura,
        height: tamanho.altura,
        position: 'relative',
        background: 'white'
      }}
    >
      {componentes.map((comp) => {
        const props = comp.propriedades;
        const estilos = props.estilos || {};
        const valor = props.campoVinculado
          ? participante[props.campoVinculado as keyof typeof participante] || ''
          : props.texto || '';

        const estiloComponente: React.CSSProperties = {
          position: 'absolute',
          top: props.y,
          left: props.x,
          width: props.largura,
          height: props.altura,
          fontSize: estilos.tamanhoFonte,
          fontFamily: estilos.fonte || 'Arial',
          fontWeight: estilos.negrito ? 'bold' : 'normal',
          fontStyle: estilos.italico ? 'italic' : 'normal',
          textDecoration: estilos.sublinhado ? 'underline' : 'none',
          textAlign: estilos.alinhamento,
          color: estilos.corFonte,
          backgroundColor: estilos.corFundo,
          borderRadius: estilos.raio,
          borderWidth: estilos.bordaLargura || 0,
          borderColor: estilos.bordaCor || 'transparent',
          borderStyle: estilos.bordaLargura ? 'solid' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        };

        return (
          <div key={comp.id} style={estiloComponente}>
            {comp.tipo === 'qrcode' ? (
              <QRCode value={JSON.stringify(participante)} size={props.altura} />
            ) : comp.tipo === 'barcode' ? (
              <Barcode
                value={valor}
                width={1}
                height={props.altura}
                displayValue={false}
                background="transparent"
              />
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
