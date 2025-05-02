import { ReactNode } from 'react';
import Navbar from '../common/Navbar';
import { useAuth, UserRole } from '../../contexts/AuthContext';

interface LayoutDefaultProps {
  children: ReactNode;
  title: string;
  backUrl?: string;
}

const LayoutDefault: React.FC<LayoutDefaultProps> = ({ 
  children, 
  title,
  backUrl
}) => {
  const { userData } = useAuth();
  const role = userData?.role || 'admin' as UserRole;
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar role={role} />
      
      <main className="flex-grow">
        <div className="page-container">
          <div className="flex items-center mb-6">
            {backUrl && (
              <a 
                href={backUrl} 
                className="mr-4 text-primary hover:text-primary-600"
              >
                ← Voltar
              </a>
            )}
            <h1 className="text-2xl font-bold text-primary">{title}</h1>
          </div>
          
          {children}
        </div>
      </main>
      
      <footer className="bg-primary py-4 text-center text-white text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} IN-TRADA Sistema de Credenciamento. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default LayoutDefault;