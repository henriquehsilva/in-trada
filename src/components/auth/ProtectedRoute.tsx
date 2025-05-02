import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '../../contexts/AuthContext';
import { LoadingScreen } from '../common/LoadingScreen';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole: UserRole;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRole 
}) => {
  const { currentUser, userData, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!currentUser) {
    // Redirecionar para login se não estiver autenticado
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!userData || userData.role !== requiredRole) {
    // Redirecionar para a página correta com base na função do usuário
    if (userData?.role === 'admin') {
      return <Navigate to="/admin" replace />;
    } else if (userData?.role === 'operador') {
      return <Navigate to="/operador" replace />;
    } else if (userData?.role === 'recepcionista') {
      return <Navigate to="/recepcionista" replace />;
    } else {
      // Fallback para login se o papel do usuário for desconhecido
      return <Navigate to="/login" replace />;
    }
  }

  // Se autenticado e com a função correta, renderizar as crianças
  return <>{children}</>;
};

export default ProtectedRoute;