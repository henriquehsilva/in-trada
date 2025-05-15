import { QrCode } from 'lucide-react';
import Barcode from 'react-barcode';
import { ComponenteEditor } from '../../models/types';

interface ComponentePreviewProps {
  componente: ComponenteEditor;
  dados?: Record<string, any>; // Dados do participante para renderização
}

const ComponentePreview: React.FC<ComponentePreviewProps> = ({ 
  componente, 
  dados 
}) => {
  const { tipo, propriedades } = componente;
  const { estilos = {} } = propriedades;
  
  const getValorCampo = () => {
    if (!propriedades.campoVinculado || !dados) return propriedades.texto || '';
    return dados[propriedades.campoVinculado] || '';
  };

  const estilosBase = {
    color: estilos.corFonte || '#000000',
    fontSize: `${estilos.tamanhoFonte || 12}px`,
    fontFamily: estilos.fonte || 'Arial', // AQUI A FONTE É APLICADA
    textAlign: estilos.alinhamento || 'left',
    fontWeight: estilos.negrito ? 'bold' : 'normal',
    fontStyle: estilos.italico ? 'italic' : 'normal',
    textDecoration: estilos.sublinhado ? 'underline' : 'none',
    backgroundColor: estilos.corFundo || 'transparent',
    borderWidth: estilos.bordaLargura ? `${estilos.bordaLargura}px` : '0',
    borderColor: estilos.bordaCor || 'transparent',
    borderStyle: estilos.bordaLargura ? 'solid' : 'none',
    borderRadius: estilos.raio ? `${estilos.raio}px` : '0',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: tipo === 'botao' ? 'center' : 'flex-start',
    padding: '4px',
    overflow: 'hidden',
  } as React.CSSProperties;

  switch (tipo) {
    case 'texto':
      return <div style={estilosBase}>{propriedades.texto || 'Texto de exemplo'}</div>;

    case 'campo':
      return <div style={estilosBase}>{getValorCampo() || `{${propriedades.campoVinculado || 'campo'}}`}</div>;

    case 'botao':
      return (
        <button type="button" style={{ ...estilosBase, cursor: 'pointer' }}>
          {propriedades.texto || 'Botão'}
        </button>
      );

    case 'qrcode':
      return (
        <div style={{ ...estilosBase, justifyContent: 'center' }}>
          <QrCode size={Math.min(propriedades.largura, propriedades.altura) * 0.8} />
        </div>
      );

    case 'barcode':
      return (
        <div style={{ ...estilosBase, justifyContent: 'center' }}>
          <Barcode
            value={getValorCampo()}
            width={1}
            height={propriedades.altura}
            displayValue={false}
            background="transparent"
          />
        </div>
      );

    case 'imagem':
      return (
        <div style={estilosBase}>
          {propriedades.url ? (
            <img
              src={propriedades.url}
              alt="Imagem"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', margin: '0 auto' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-xs">
              Imagem
            </div>
          )}
        </div>
      );

    case 'divisao':
      return (
        <div style={{ ...estilosBase, backgroundColor: estilos.corFundo || '#f0f0f0' }} />
      );

    default:
      return <div style={estilosBase}>Componente desconhecido</div>;
  }
};

export default ComponentePreview;
