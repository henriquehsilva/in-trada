import { ComponenteEditor } from '../../models/types';
import { Trash2 } from 'lucide-react';

interface PropriedadesComponenteProps {
  componente: ComponenteEditor;
  onUpdate: (componente: ComponenteEditor) => void;
  onDelete: (id: string) => void;
  camposDisponiveis?: string[];
}

const fontesWindows = [
  'Arial',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Lucida Console'
];

type ChaveEstilo =
  | 'corFonte'
  | 'tamanhoFonte'
  | 'alinhamento'
  | 'negrito'
  | 'italico'
  | 'sublinhado'
  | 'corFundo'
  | 'bordaLargura'
  | 'bordaCor'
  | 'raio'
  | 'fonte';

const PropriedadesComponente: React.FC<PropriedadesComponenteProps> = ({
  componente,
  onUpdate,
  onDelete,
  camposDisponiveis = []
}) => {
  const estilos = componente.propriedades.estilos as Record<ChaveEstilo, any>;

  const handleChange = (
    key: string,
    value: any,
    subKey?: ChaveEstilo
  ) => {
    const newComponente = { ...componente };

    if (subKey) {
      newComponente.propriedades.estilos = {
        ...newComponente.propriedades.estilos,
        [subKey]: value
      };
    } else {
      newComponente.propriedades = {
        ...newComponente.propriedades,
        [key]: value
      };
    }

    onUpdate(newComponente);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-md font-medium capitalize">{componente.tipo}</h4>
        <button
          type="button"
          onClick={() => onDelete(componente.id)}
          className="p-1 text-error hover:bg-error-light rounded"
          title="Excluir componente"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="space-y-3">
        {/* Posição e Tamanho */}
        <div className="grid grid-cols-2 gap-2">
          {['x', 'y', 'largura', 'altura'].map((key) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700">{key.toUpperCase()}</label>
              <input
                type="number"
                value={(componente.propriedades as any)[key]}
                onChange={(e) => handleChange(key, parseInt(e.target.value))}
                className="mt-1 block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
              />
            </div>
          ))}
        </div>

        {/* Texto */}
        {(componente.tipo === 'texto' || componente.tipo === 'botao') && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Texto</label>
            <input
              type="text"
              value={componente.propriedades.texto || ''}
              onChange={(e) => handleChange('texto', e.target.value)}
              className="mt-1 block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
            />
          </div>
        )}

        {/* Campo vinculado */}
        {componente.tipo === 'campo' && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Campo vinculado</label>
            <select
              value={componente.propriedades.campoVinculado || ''}
              onChange={(e) => handleChange('campoVinculado', e.target.value)}
              className="mt-1 block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
            >
              <option value="">Selecione um campo</option>
              {camposDisponiveis.map((campo) => (
                <option key={campo} value={campo}>{campo}</option>
              ))}
            </select>
          </div>
        )}

        {/* Imagem */}
        {componente.tipo === 'imagem' && (
          <div>
            <label className="block text-sm font-medium text-gray-700">URL da imagem</label>
            <input
              type="text"
              value={componente.propriedades.url || ''}
              onChange={(e) => handleChange('url', e.target.value)}
              className="mt-1 block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
            />
          </div>
        )}

        {/* Estilos */}
        <div className="pt-2 border-t border-gray-200">
          <h5 className="text-sm font-medium mb-2">Estilo</h5>

          {/* Fonte */}
          <div className="mb-2">
            <label className="block text-xs font-medium text-gray-700">Fonte</label>
            <select
              value={estilos.fonte ?? 'Arial'}
              onChange={(e) => handleChange('estilos', e.target.value, 'fonte')}
              className="mt-1 block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
            >
              {fontesWindows.map((fonte) => (
                <option key={fonte} value={fonte}>{fonte}</option>
              ))}
            </select>
          </div>

          {/* Tamanho e Alinhamento */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-xs font-medium text-gray-700">Tamanho da fonte</label>
              <input
                type="number"
                value={estilos.tamanhoFonte ?? 12}
                onChange={(e) => handleChange('estilos', parseInt(e.target.value), 'tamanhoFonte')}
                className="mt-1 block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Alinhamento</label>
              <select
                value={estilos.alinhamento ?? 'left'}
                onChange={(e) => handleChange('estilos', e.target.value, 'alinhamento')}
                className="mt-1 block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
              >
                <option value="left">Esquerda</option>
                <option value="center">Centro</option>
                <option value="right">Direita</option>
              </select>
            </div>
          </div>

          {/* Formatação */}
          <div className="flex space-x-4 mb-2">
            {(['negrito', 'italico', 'sublinhado'] as ChaveEstilo[]).map((estilo) => (
              <div className="flex items-center" key={estilo}>
                <input
                  type="checkbox"
                  id={estilo}
                  checked={!!estilos[estilo]}
                  onChange={(e) => handleChange('estilos', e.target.checked, estilo)}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <label htmlFor={estilo} className="ml-2 block text-xs font-medium text-gray-700 capitalize">
                  {estilo}
                </label>
              </div>
            ))}
          </div>

          {/* Cores */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            {([
              { key: 'corFonte', label: 'Cor do texto', default: '#000000' },
              { key: 'corFundo', label: 'Cor de fundo', default: '#ffffff' }
            ] as { key: ChaveEstilo, label: string, default: string }[]).map(({ key, label, default: def }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-700">{label}</label>
                <input
                  type="color"
                  value={estilos[key] ?? def}
                  onChange={(e) => handleChange('estilos', e.target.value, key)}
                  className="mt-1 block w-full h-8 p-0 border-gray-300 rounded shadow-sm focus:ring-primary focus:border-primary"
                />
              </div>
            ))}
          </div>

          {/* Borda */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700">Largura da borda</label>
              <input
                type="number"
                value={estilos.bordaLargura ?? 0}
                onChange={(e) => handleChange('estilos', parseInt(e.target.value), 'bordaLargura')}
                className="mt-1 block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Cor da borda</label>
              <input
                type="color"
                value={estilos.bordaCor ?? '#000000'}
                onChange={(e) => handleChange('estilos', e.target.value, 'bordaCor')}
                className="mt-1 block w-full h-8 p-0 border-gray-300 rounded shadow-sm focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Raio da borda</label>
              <input
                type="number"
                value={estilos.raio ?? 0}
                onChange={(e) => handleChange('estilos', parseInt(e.target.value), 'raio')}
                className="mt-1 block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropriedadesComponente;
