import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Papa, { parse, ParseError, ParseResult } from 'papaparse';
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

  const reader = new FileReader();

  reader.onload = (event) => {
    const result = event.target?.result;
    if (!(result instanceof ArrayBuffer)) {
      setErro('Erro ao ler arquivo.');
      return;
    }

    // Detecta charset padrão, tenta UTF-8 e Latin1
    const utf8Text = new TextDecoder('utf-8').decode(result);
    const hasInvalidUtf8 = utf8Text.includes('�'); // símbolo comum de erro de decodificação

    const text = hasInvalidUtf8
      ? new TextDecoder('iso-8859-1').decode(result)
      : utf8Text;

    parse<ParticipanteCSV>(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results: ParseResult<ParticipanteCSV>) => {
        const dadosValidos = results.data.filter(d => d.nome && d.email1);
        setPreview(dadosValidos);
        setErro(null);
      },
      error: (error: any) => {
        console.error('Erro ao ler CSV:', error);
        setErro('Erro ao processar o arquivo. Verifique o formato.');
      }
    });
  };

  reader.readAsArrayBuffer(file); // importante: usa array buffer para poder decodificar corretamente
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
        <a
          href="/MODELO_IMPORTE_PARTICIPANTES.xlsx"
          download
          className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          Baixar Modelo (.xlsx)
        </a>
        <p className="text-sm text-gray-600">
          Selecione um arquivo <strong>.csv</strong>
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
                    <th className="px-3 py-2 text-left">Empresa</th>
                    <th className="px-3 py-2 text-left">Nome Crachá</th>
                    <th className="px-3 py-2 text-left">Empresa Crachá</th>
                    <th className="px-3 py-2 text-left">Cargo</th>
                    <th className="px-3 py-2 text-left">Email 1</th>
                    <th className="px-3 py-2 text-left">Email 2</th>
                    <th className="px-3 py-2 text-left">Celular</th>
                    <th className="px-3 py-2 text-left">Telefone</th>
                    <th className="px-3 py-2 text-left">Categoria</th>
                    <th className="px-3 py-2 text-left">Observação</th>
                    <th className="px-3 py-2 text-left">CPF</th>
                    <th className="px-3 py-2 text-left">RG</th>
                    <th className="px-3 py-2 text-left">CNPJ</th>
                    <th className="px-3 py-2 text-left">Código Cliente</th>
                    <th className="px-3 py-2 text-left">Opção 1</th>
                    <th className="px-3 py-2 text-left">Opção 2</th>
                    <th className="px-3 py-2 text-left">Opção 3</th>
                    <th className="px-3 py-2 text-left">Opção 4</th>
                    <th className="px-3 py-2 text-left">Opção 5</th>
                    <th className="px-3 py-2 text-left">Opção 6</th>
                    <th className="px-3 py-2 text-left">Opção 7</th>
                    <th className="px-3 py-2 text-left">Opção 8</th>
                    <th className="px-3 py-2 text-left">Opção 9</th>
                    <th className="px-3 py-2 text-left">Opção 10</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.map((p, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-1">{p.nome}</td>
                        <td className="px-3 py-1">{p.empresa}</td>
                        <td className="px-3 py-1">{p.nomeCracha}</td>
                        <td className="px-3 py-1">{p.empresaCracha}</td>
                        <td className="px-3 py-1">{p.cargo}</td>
                        <td className="px-3 py-1">{p.email1}</td>
                        <td className="px-3 py-1">{p.email2}</td>
                        <td className="px-3 py-1">{p.celular}</td>
                        <td className="px-3 py-1">{p.telefone}</td>
                        <td className="px-3 py-1">{p.categoria}</td>
                        <td className="px-3 py-1">{p.observacao}</td>
                        <td className="px-3 py-1">{p.cpf}</td>
                        <td className="px-3 py-1">{p.rg}</td>
                        <td className="px-3 py-1">{p.cnpj}</td>
                        <td className="px-3 py-1">{p.codigoCliente}</td>
                        <td className="px-3 py-1">{p.opcao1}</td>
                        <td className="px-3 py-1">{p.opcao2}</td>
                        <td className="px-3 py-1">{p.opcao3}</td>
                        <td className="px-3 py-1">{p.opcao4}</td>
                        <td className="px-3 py-1">{p.opcao5}</td>
                        <td className="px-3 py-1">{p.opcao6}</td>
                        <td className="px-3 py-1">{p.opcao7}</td>
                        <td className="px-3 py-1">{p.opcao8}</td>
                        <td className="px-3 py-1">{p.opcao9}</td>
                        <td className="px-3 py-1">{p.opcao10}</td>
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
