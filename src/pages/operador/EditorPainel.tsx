// pages/recepcionista/EditorRecepcionista.tsx

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import LayoutDefault from '../../components/layout/LayoutDefault';
import DragDropEditor from '../../components/editor/DragDropEditor';
import { Save } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { obterEventoPorId } from '../../services/eventoService';
import {
  criarModeloRecepcionista,
  atualizarModeloRecepcionista,
  obterModeloRecepcionistaPorEvento
} from '../../services/modeloRecepcionistaService';

import { ComponenteEditor, Evento, ModeloPainel } from '../../models/types';

const camposParticipantePadrao = [
  'nome',
  'email',
  'empresa',
  'categoria',
  'telefone',
  'id'
];

const EditorRecepcionista: React.FC = () => {
  const { eventoId } = useParams<{ eventoId: string }>();
  const { currentUser } = useAuth();

  const [evento, setEvento] = useState<Evento | null>(null);
  const [componentes, setComponentes] = useState<ComponenteEditor[]>([]);
  const [modeloId, setModeloId] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error', texto: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const tamanhoTela = { largura: 1000, altura: 600 };

  useEffect(() => {
    const carregar = async () => {
      if (!eventoId) return;

      try {
        const ev = await obterEventoPorId(eventoId);
        setEvento(ev);

        const modelo = await obterModeloRecepcionistaPorEvento(eventoId);
        if (modelo) {
          setModeloId(modelo.id ?? null);
          setComponentes(modelo.componentes);
        }
      } catch (err) {
        console.error('Erro ao carregar modelo:', err);
        setMensagem({ tipo: 'error', texto: 'Erro ao carregar modelo da tela de recepção.' });
      } finally {
        setLoading(false);
      }
    };

    carregar();
  }, [eventoId]);

  const handleSalvar = async () => {
    if (!eventoId || !currentUser?.uid) return;

    setSalvando(true);
    try {
      if (modeloId) {
        await atualizarModeloRecepcionista(modeloId, {
          eventoId,
          componentes
        });
      } else {
        await criarModeloRecepcionista({
          eventoId,
          componentes,
          criadoPorId: currentUser.uid
        });
      }

      setMensagem({ tipo: 'success', texto: 'Tela de recepção salva com sucesso!' });
      setTimeout(() => setMensagem(null), 3000);
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setMensagem({ tipo: 'error', texto: 'Erro ao salvar. Tente novamente.' });
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return <LayoutDefault title="Carregando...">Carregando dados...</LayoutDefault>;
  }

  return (
    <LayoutDefault title="Editor de Tela de Recepção" backUrl={`/operador`}>
      {mensagem && (
        <div className={`mb-4 p-3 rounded-md ${mensagem.tipo === 'success' ? 'bg-success-light text-success' : 'bg-error-light text-error'}`}>
          {mensagem.texto}
        </div>
      )}

      <div className="bg-white p-4 rounded-md shadow-sm mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Personalize a interface da recepção</h2>
          <button className="btn btn-primary flex items-center" onClick={handleSalvar} disabled={salvando}>
            <Save className="w-5 h-5 mr-2" />
            {salvando ? 'Salvando...' : 'Salvar Tela'}
          </button>
        </div>

        <DragDropEditor
          componentes={componentes}
          onSave={setComponentes}
          tamanhoCracha={tamanhoTela}
          camposDisponiveis={camposParticipantePadrao}
        />
      </div>
    </LayoutDefault>
  );
};

export default EditorRecepcionista;
