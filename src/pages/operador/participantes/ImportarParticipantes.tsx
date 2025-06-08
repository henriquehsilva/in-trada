import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import LayoutDefault from '../../../components/layout/LayoutDefault';
import { Participante } from '../../../models/types';

type ParticipanteCSV = Omit<Participante, 'id' | 'criadoEm'>;

const ImportarParticipantes: React.FC = () => {
  const { eventoId } = useParams<{ eventoId: string }>();
  const navigate = useNavigate();

  const [preview, setPreview] = useState<ParticipanteCSV[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);

  const handleArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const dados = results.data as ParticipanteCSV[];
        const dadosValidos = dados.filter(d => d.nome && d.email);
        setPreview(dadosValidos);
        setErro(null);
      },
      error: (err) => {
        console.error('Erro ao ler CSV:', err);
        setErro('Erro ao processar o arquivo. Verifique o formato.');
      }
    });
  };

  const handleImportar = async () => {
    if (!eventoId || preview.length === 0) return;

    setImportando(true);
    setErro(null);
    setMensagem(null);

    try {
      const ref = collection(db, 'participantes');

      await Promise.all(preview.map(p =>
        addDoc(ref, {
          ...p,
          eventoId,
          status: 'pendente',
          criadoEm: serverTimestamp()
        })
      ));

      setMensagem(`${preview.length} participantes importados com sucesso.`);
      setPreview([]);
    } catch (err) {
      console.error('Erro ao importar:', err);
      setErro('Falha ao importar participantes. Tente novamente.');
    } finally {
      setImportando(false);
    }
  };

  return (
    <LayoutDefault
      title="Importar Participantes"
      backUrl={`/operador/participantes?eventoId=${eventoId}`}
    >
      <div className="bg-white p-6 rounded-lg shadow-sm space-y-4">
        <p className="text-sm text-gray-600">
          Selecione um arquivo <strong>.csv</strong> com colunas: <code>nome</code>, <code>email</code>, <code>empresa</code>, <code>telefone</code>, <code>categoria</code>.
        </p>

        <input type="file" accept=".csv" onChange={handleArquivo} className="input-field" />

        {erro && <div className="text-error bg-error-light p-3 rounded">{erro}</div>}
        {mensagem && <div className="text-success bg-success-light p-3 rounded">{mensagem}</div>}

        {preview.length > 0 && (
          <div>
            <h3 className="text-md font-semibold mb-2">Pré-visualização ({preview.length})</h3>
            <div className="overflow-auto max-h-64 border border-gray-200 rounded">
              <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Nome</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Empresa</th>
                    <th className="px-3 py-2 text-left">Telefone</th>
                    <th className="px-3 py-2 text-left">Categoria</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.map((p, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-1">{p.nome}</td>
                      <td className="px-3 py-1">{p.email}</td>
                      <td className="px-3 py-1">{p.empresa}</td>
                      <td className="px-3 py-1">{p.telefone}</td>
                      <td className="px-3 py-1">{p.categoria}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="btn btn-primary mt-4"
              onClick={handleImportar}
              disabled={importando}
            >
              {importando ? 'Importando...' : 'Importar Participantes'}
            </button>
          </div>
        )}
      </div>
    </LayoutDefault>
  );
};

export default ImportarParticipantes;
