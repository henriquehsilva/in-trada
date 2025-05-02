import { ComponenteEditor } from '../../models/types';
import { Trash2 } from 'lucide-react';

interface PropriedadesComponenteProps {
  componente: ComponenteEditor;
  onUpdate: (componente: ComponenteEditor) => void;
  onDelete: (id: string) => void;
  camposDisponiveis?: string[];
}

const PropriedadesComponente: React.FC<PropriedadesComponenteProps> = ({
  componente,
  onUpdate,
  onDelete,
  camposDisponiveis = []
}) => {
  const handleChange = (
    key: string,
    value: any,
    subKey?: string
  ) => {
    const newComponente = { ...componente };
    
    if (subKey) {
      // Atualiza uma propriedade dentro de estilos
      newComponente.propriedades.estilos = {
        ...newComponente.propriedades.estilos,
        [subKey]: value
      };
    } else {
      // Atualiza uma propriedade direta
      newComponente.propriedades = {
        ...newComponente.propriedades,
        [key]: value
      };
    }
    
    onUpdate(newComponente);
  };

  const handleDeleteClick = () => {
    onDelete(componente.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-md font-medium capitalize">
          {componente.tipo}
        </h4>
        <button
          type="button"
          onClick={handleDeleteClick}
          className="p-1 text-error hover:bg-error-light rounded"
          title="Excluir componente"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="space-y-3">
        {/* Posição e Tamanho */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">X</label>
            <input
              type="number"
              value={componente.propriedades.x}
              onChange={(e) => handleChange('x', parseInt(e.target.value))}
              className="mt-1 block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Y</label>
            <input
              type="number"
              value={componente.propriedades.y}
              onChange={(e) => handleChange('y', parseInt(e.target.value))}
              className="mt-1 block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Largura</label>
            <input
              type="number"
              value={componente.propriedades.largura}
              onChange={(e) => handleChange('largura', parseInt(e.target.value))}
              className="mt-1 block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Altura</label>
            <input
              type="number"
              value={componente.propriedades.altura}
              onChange={(e) => handleChange('altura', parseInt(e.target.value))}
              className="mt-1 block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
            />
          </div>
        </div>

        {/* Texto - para componentes que usam texto */}
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

        {/* Campo vinculado - para o tipo campo */}
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
                <option key={campo} value={campo}>
                  {campo}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* URL - para imagens */}
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

        {/* Estilos comuns */}
        <div className="pt-2 border-t border-gray-200">
          <h5 className="text-sm font-medium mb-2">Estilo</h5>
          
          {/* Cores */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-xs font-medium text-gray-700">Cor do texto</label>
              <input
                type="color"
                value={componente.propriedades.estilos?.corFonte || '#000000'}
                onChange={(e) => handleChange('estilos', e.target.value, 'corFonte')}
                className="mt-1 block w-full h-8 p-0 border-gray-300 rounded shadow-sm focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Cor de fundo</label>
              <input
                type="color"
                value={componente.propriedades.estilos?.corFundo || '#ffffff'}
                onChange={(e) => handleChange('estilos', e.target.value, 'corFundo')}
                className="mt-1 block w-full h-8 p-0 border-gray-300 rounded shadow-sm focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          {/* Fonte */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-xs font-medium text-gray-700">Tamanho da fonte</label>
              <input
                type="number"
                value={componente.propriedades.estilos?.tamanhoFonte || 12}
                onChange={(e) => handleChange('estilos', parseInt(e.target.value), 'tamanhoFonte')}
                className="mt-1 block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Alinhamento</label>
              <select
                value={componente.propriedades.estilos?.alinhamento || 'left'}
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
            <div className="flex items-center">
              <input
                type="checkbox"
                id="negrito"
                checked={componente.propriedades.estilos?.negrito || false}
                onChange={(e) => handleChange('estilos', e.target.checked, 'negrito')}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label htmlFor="negrito" className="ml-2 block text-xs font-medium text-gray-700">
                Negrito
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="italico"
                checked={componente.propriedades.estilos?.italico || false}
                onChange={(e) => handleChange('estilos', e.target.checked, 'italico')}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label htmlFor="italico" className="ml-2 block text-xs font-medium text-gray-700">
                Itálico
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="sublinhado"
                checked={componente.propriedades.estilos?.sublinhado || false}
                onChange={(e) => handleChange('estilos', e.target.checked, 'sublinhado')}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label htmlFor="sublinhado" className="ml-2 block text-xs font-medium text-gray-700">
                Sublinhado
              </label>
            </div>
          </div>

          {/* Borda */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700">Largura da borda</label>
              <input
                type="number"
                value={componente.propriedades.estilos?.bordaLargura || 0}
                onChange={(e) => handleChange('estilos', parseInt(e.target.value), 'bordaLargura')}
                className="mt-1 block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Cor da borda</label>
              <input
                type="color"
                value={componente.propriedades.estilos?.bordaCor || '#000000'}
                onChange={(e) => handleChange('estilos', e.target.value, 'bordaCor')}
                className="mt-1 block w-full h-8 p-0 border-gray-300 rounded shadow-sm focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Raio da borda</label>
              <input
                type="number"
                value={componente.propriedades.estilos?.raio || 0}
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