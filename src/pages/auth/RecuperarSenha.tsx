import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AlertCircle, Mail, ArrowLeft } from 'lucide-react';

const RecuperarSenha: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setError('');
      setMessage('');
      setLoading(true);
      
      await resetPassword(email);
      setMessage('Verifique seu email para instruções de recuperação de senha.');
    } catch (err) {
      console.error('Erro ao recuperar senha:', err);
      setError('Não foi possível enviar o email de recuperação. Verifique se o email está correto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-extrabold text-primary">IN-TRADA</h1>
          <h2 className="mt-6 text-center text-2xl font-bold text-gray-900">
            Recuperar senha
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Digite seu email para receber um link de recuperação
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-error-light p-3 rounded-md flex items-start text-error">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          {message && (
            <div className="bg-success-light p-3 rounded-md flex items-start text-success">
              <Mail className="h-5 w-5 mr-2 flex-shrink-0" />
              <span>{message}</span>
            </div>
          )}
          
          <div>
            <label htmlFor="email-address" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email-address"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary focus:border-primary focus:z-10 sm:text-sm"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-70"
            >
              {loading ? 'Enviando...' : 'Enviar instruções'}
            </button>
          </div>
          
          <div className="text-center mt-4">
            <Link
              to="/login"
              className="inline-flex items-center font-medium text-primary hover:text-primary-500"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar para o login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecuperarSenha;