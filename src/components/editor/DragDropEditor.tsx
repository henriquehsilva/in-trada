import { useState, useEffect } from 'react';
import Draggable from 'react-draggable';
import { nanoid } from 'nanoid';
import { ComponenteEditor } from '../../models/types';
import ComponentePreview from './ComponentePreview';
import ToolboxItem from './ToolboxItem';
import PropriedadesComponente from './PropriedadesComponente';
import { RefreshCcw, RefreshCw } from 'lucide-react';

import {
  Type,
  PanelTop,
  MousePointerClick,
  QrCode,
  Image as ImageIcon,
  Minus,
  Barcode,
} from 'lucide-react';

interface DragDropEditorProps {
  componentes: ComponenteEditor[];
  onSave: (componentes: ComponenteEditor[]) => void;
  tamanhoCracha?: { largura: number; altura: number };
  camposDisponiveis?: string[];
  fontesDisponiveis?: string[];
}

const DragDropEditor: React.FC<DragDropEditorProps> = ({
  componentes,
  onSave,
  tamanhoCracha = { largura: 400, altura: 250 },
  camposDisponiveis = [],
  fontesDisponiveis = []
}) => {
  const [componentesAtuais, setComponentesAtuais] = useState<ComponenteEditor[]>([]);
  
  useEffect(() => {
    setComponentesAtuais(componentes);
  }, [componentes]);

  const [componenteSelecionado, setComponenteSelecionado] = useState<ComponenteEditor | null>(null);

  const toolboxItems = [
    { tipo: 'texto', label: 'Texto', icon: <Type className="w-4 h-4" /> },
    { tipo: 'campo', label: 'Campo', icon: <PanelTop className="w-4 h-4" /> },
    { tipo: 'botao', label: 'Botão', icon: <MousePointerClick className="w-4 h-4" /> },
    { tipo: 'qrcode', label: 'QR Code', icon: <QrCode className="w-4 h-4" /> },
    { tipo: 'barcode', label: 'Cod Barra', icon: <Barcode className="w-4 h-4" /> },
    { tipo: 'imagem', label: 'Imagem', icon: <ImageIcon className="w-4 h-4" /> },
    { tipo: 'divisao', label: 'Divisão', icon: <Minus className="w-4 h-4" /> },
  ];

  // const cmToPx = (cm: number) => Math.round((cm / 2.54) * 96);
  const cmToPx = (cm: number) => Math.round((cm / 2.54) * 203); // para ZPL (203 DPI)

  const modelosEtiqueta = [
    { id: '8x3', nome: 'Etiqueta 8x3cm', largura: cmToPx(8), altura: cmToPx(3) },
    { id: '6x4', nome: 'Etiqueta 6x4cm', largura: cmToPx(6), altura: cmToPx(4) },
    { id: '10x5', nome: 'Etiqueta 10x5cm', largura: cmToPx(10), altura: cmToPx(5) }
  ];

  const [modeloSelecionado, setModeloSelecionado] = useState(modelosEtiqueta[0]);

  const adicionarComponente = (tipo: string) => {
    const largura = tipo === 'qrcode' || tipo === 'barcode' ? cmToPx(5) : 100;
    const altura = tipo === 'qrcode' || tipo === 'barcode' ? cmToPx(5) : 30;

    const novo: ComponenteEditor = {
      id: nanoid(),
      tipo: tipo as ComponenteEditor['tipo'],
      propriedades: {
        x: 10,
        y: 10,
        largura,
        altura,
        texto: tipo === 'texto' ? 'Texto' : '',
        campoVinculado: tipo === 'campo' || tipo === 'barcode' ? 'id' : undefined,
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
        ? {
            ...c,
            propriedades: {
              ...c.propriedades,
              x: data.x,
              y: data.y
            }
          }
        : c
    );
    setComponentesAtuais(atualizados);
    onSave(atualizados); // <-- ESSENCIAL para refletir no EditorCrachas
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
            <button
              onClick={() => {      
                  setComponentesAtuais([]);
                  onSave([]);
                  setComponenteSelecionado(null);
                }
              }
              className="w-full text-left px-3 py-2 border border-red-500 text-red-600 rounded hover:bg-red-50 mt-4"
            >
            <div className="flex items-center">
              <RefreshCcw size={18} className="mr-2" />
              Resetar Componentes
            </div>
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-grow">
        <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Modelo da Etiqueta</label>
          <select
            value={modeloSelecionado.id}
            onChange={(e) => {
              const novoModelo = modelosEtiqueta.find(m => m.id === e.target.value);
              if (novoModelo) setModeloSelecionado(novoModelo);
            }}
            className="input-field mb-4"
          >
            {modelosEtiqueta.map(m => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
          <h3 className="text-lg font-semibold mb-4">Editor</h3>
          <div
            className="relative border border-gray-300 rounded-lg mx-auto"
            style={{
              width: modeloSelecionado.largura,
              height: modeloSelecionado.altura,
              position: 'relative',
              background: '#fff',
              overflow: 'hidden',
              border: '1px solid #ccc'
            }}
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
                  <ComponentePreview componente={comp} dados={{ id: '1234567890' }} />
                </div>
              </Draggable>
            ))}
          </div>
        </div>
      </div>

      {/* Propriedades */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Propriedades</h3>
        {componenteSelecionado ? (
          <PropriedadesComponente
            componente={componenteSelecionado}
            onUpdate={handleAtualizarComponente}
            onDelete={handleExcluirComponente}
            camposDisponiveis={camposDisponiveis}
            fontesDisponiveis={fontesDisponiveis}
          />
        ) : (
          <p className="text-gray-500">Selecione um componente para editar</p>
        )}
      </div>
    </div>
  );
};

export default DragDropEditor;
