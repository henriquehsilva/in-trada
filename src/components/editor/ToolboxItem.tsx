import { MouseEvent } from 'react';
import { Type, FormInput, Square as SquareButton, QrCode, Image, SeparatorHorizontal } from 'lucide-react';

interface ToolboxItemProps {
  tipo: 'texto' | 'campo' | 'botao' | 'qrcode' | 'imagem' | 'divisao';
  label: string;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
}

const getIconByType = (tipo: string) => {
  switch (tipo) {
    case 'texto':
      return <Type className="w-5 h-5" />;
    case 'campo':
      return <FormInput className="w-5 h-5" />;
    case 'botao':
      return <SquareButton className="w-5 h-5" />;
    case 'qrcode':
      return <QrCode className="w-5 h-5" />;
    case 'imagem':
      return <Image className="w-5 h-5" />;
    case 'divisao':
      return <SeparatorHorizontal className="w-5 h-5" />;
    default:
      return <div className="w-5 h-5" />;
  }
};

const ToolboxItem: React.FC<ToolboxItemProps> = ({ tipo, label, onClick }) => {
  return (
    <div
      className="flex items-center p-3 border border-gray-200 rounded-md shadow-sm bg-white hover:bg-gray-50 cursor-grab active:cursor-grabbing"
      onClick={onClick}
    >
      <div className="mr-3 text-primary">
        {getIconByType(tipo)}
      </div>
      <span>{label}</span>
    </div>
  );
};

export default ToolboxItem;