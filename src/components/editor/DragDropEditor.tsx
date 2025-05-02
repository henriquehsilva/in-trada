import { useState } from 'react';
import Draggable from 'react-draggable';
import { nanoid } from 'nanoid';
import { ComponenteEditor } from '../../models/types';
import ComponentePreview from './ComponentePreview';
import ToolboxItem from './ToolboxItem';
import PropriedadesComponente from './PropriedadesComponente';
import {
  Type,
  PanelTop,
  MousePointerClick,
  QrCode,
  Image as ImageIcon,
  Minus,
} from 'lucide-react';

interface DragDropEditorProps {
  componentes: ComponenteEditor[];
  onSave: (componentes: ComponenteEditor[]) => void;
  tamanhoCracha?: { largura: number; altura: number };
  camposDisponiveis?: string[];
}

const DragDropEditor: React.FC<DragDropEditorProps> = ({
  componentes,
  onSave,
  tamanhoCracha = { largura: 400, altura: 250 },
  camposDisponiveis = []
}) => {
  const [componentesAtuais, setComponentesAtuais] = useState<ComponenteEditor[]>(componentes);
  const [componenteSelecionado, setComponenteSelecionado] = useState<ComponenteEditor | null>(null);

  const toolboxItems = [
    { tipo: 'texto', label: 'Texto', icon: <Type className="w-4 h-4" /> },
    { tipo: 'campo', label: 'Campo', icon: <PanelTop className="w-4 h-4" /> }, // representando um campo de formulário
    { tipo: 'botao', label: 'Botão', icon: <MousePointerClick className="w-4 h-4" /> },
    { tipo: 'qrcode', label: 'QR Code', icon: <QrCode className="w-4 h-4" /> },
    { tipo: 'imagem', label: 'Imagem', icon: <ImageIcon className="w-4 h-4" /> },
    { tipo: 'divisao', label: 'Divisão', icon: <Minus className="w-4 h-4" /> },
  ];

  const adicionarComponente = (tipo: string) => {
    const novo: ComponenteEditor = {
      id: nanoid(),
      tipo: tipo as any,
      propriedades: {
        x: 10,
        y: 10,
        largura: 100,
        altura: 30,
        texto: tipo === 'texto' ? 'Texto' : '',
        estilos: {
          corFonte: '#000000',
          tamanhoFonte: 14,
          alinhamento: 'center'
        }
      }
    };
    const novos = [...componentesAtuais, novo];
    setComponentesAtuais(novos);
    onSave(novos);
  };

  const handleStop = (e: any, data: any, id: string) => {
    const atualizados = componentesAtuais.map((c) =>
      c.id === id
        ? { ...c, propriedades: { ...c.propriedades, x: data.x, y: data.y } }
        : c
    );
    setComponentesAtuais(atualizados);
    onSave(atualizados);
  };

  const handleAtualizarComponente = (componenteAtualizado: ComponenteEditor) => {
    const novosComponentes = componentesAtuais.map(comp => 
      comp.id === componenteAtualizado.id ? componenteAtualizado : comp
    );
    setComponentesAtuais(novosComponentes);
    setComponenteSelecionado(componenteAtualizado);
    onSave(novosComponentes);
  };

  const handleExcluirComponente = (id: string) => {
    const novos = componentesAtuais.filter(c => c.id !== id);
    setComponentesAtuais(novos);
    onSave(novos);
    setComponenteSelecionado(null);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Toolbox */}
      <div className="w-full lg:w-64 bg-white p-4 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Componentes</h3>
        <div className="space-y-2">
          {toolboxItems.map(item => (
            <button
              key={item.tipo}
              onClick={() => adicionarComponente(item.tipo)}
              className="w-full text-left px-3 py-2 border rounded hover:bg-gray-50"
            >
              <div className="flex items-center">
                {item.icon}
                <span className="ml-2">{item.label}</span>
              </div>              
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-grow">
        <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
          <h3 className="text-lg font-semibold mb-4">Editor</h3>
          <div
            className="relative border border-gray-300 rounded-lg mx-auto"
            style={{ width: tamanhoCracha.largura, height: tamanhoCracha.altura, background: '#fff' }}
          >
            {componentesAtuais.map(comp => (
              <Draggable
                key={comp.id}
                bounds="parent"
                defaultPosition={{ x: comp.propriedades.x, y: comp.propriedades.y }}
                onStop={(e, data) => handleStop(e, data, comp.id)}
              >
                <div
                  onClick={() => setComponenteSelecionado(comp)}
                  style={{
                    width: comp.propriedades.largura,
                    height: comp.propriedades.altura,
                    position: 'absolute',
                    border: componenteSelecionado?.id === comp.id ? '2px solid #063a80' : '1px solid #ccc',
                    backgroundColor: '#f9f9f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'move'
                  }}
                >
                  <ComponentePreview componente={comp} />
                </div>
              </Draggable>
            ))}
          </div>
        </div>
      </div>

      {/* Propriedades */}
      <div className="w-full lg:w-80 bg-white p-4 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Propriedades</h3>
        {componenteSelecionado ? (
          <PropriedadesComponente
            componente={componenteSelecionado}
            onUpdate={handleAtualizarComponente}
            onDelete={handleExcluirComponente}
            camposDisponiveis={camposDisponiveis}
          />
        ) : (
          <p className="text-gray-500">Selecione um componente para editar</p>
        )}
      </div>
    </div>
  );
};

export default DragDropEditor;
