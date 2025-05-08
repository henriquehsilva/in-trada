import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase/config';
import { AuthProvider } from './contexts/AuthContext';
import { LoadingScreen } from './components/common/LoadingScreen';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { Toaster } from 'react-hot-toast';

// Páginas públicas
import Login from './pages/auth/Login';
import Cadastro from './pages/auth/Cadastro';
import RecuperarSenha from './pages/auth/RecuperarSenha';

// Páginas de Admin
import AdminDashboard from './pages/admin/Dashboard';
import GerenciarEventos from './pages/admin/GerenciarEventos';
import GerenciarOperadores from './pages/admin/GerenciarOperadores';
import CriarEvento from './pages/admin/eventos/CriarEvento';
import EditarEvento from './pages/admin/eventos/EditarEvento';
import CriarOperador from './pages/admin/operadores/CriarOperador';
import EditarOperador from './pages/admin/operadores/EditarOperador';

// Páginas de Operador
import OperadorDashboard from './pages/operador/Dashboard';
import GerenciarRecepcionistas from './pages/operador/GerenciarRecepcionistas';
import EditorCrachas from './pages/operador/EditorCrachas';
import EditorPainel from './pages/operador/EditorPainel';
import GerenciarParticipantes from './pages/operador/GerenciarParticipantes';
import CriarRecepcionista from './pages/operador/recepcionistas/CriarRecepcionista';
import EditarRecepcionista from './pages/operador/recepcionistas/EditarRecepcionista'; 
import CriarParticipante from './pages/operador/participantes/CriarParticipante';
import EditarParticipante from './pages/operador/participantes/EditarParticipante'; 

// Páginas de Recepcionista
import RecepcionistaDashboard from './pages/recepcionista/Dashboard';
import PainelRecepcao from './pages/recepcionista/PainelRecepcao';

function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, () => {
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <Routes>
        {/* Rotas públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/recuperar-senha" element={<RecuperarSenha />} />

        {/* Rotas de Admin */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/eventos/novo" 
          element={
            <ProtectedRoute requiredRole="admin">
              <CriarEvento />
            </ProtectedRoute>
          } 
        />
        <Route
          path="/admin/eventos/:id"
          element={
            <ProtectedRoute requiredRole="admin">
              <EditarEvento />
            </ProtectedRoute>
          }
        />        
        <Route 
          path="/admin/eventos" 
          element={
            <ProtectedRoute requiredRole="admin">
              <GerenciarEventos />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/operadores" 
          element={
            <ProtectedRoute requiredRole="admin">
              <GerenciarOperadores />
            </ProtectedRoute>
          } 
        />
        <Route
          path="/admin/operadores/novo"
          element={
            <ProtectedRoute requiredRole="admin">
              <CriarOperador />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/operadores/:id"
          element={
            <ProtectedRoute requiredRole="admin">
              <EditarOperador />
            </ProtectedRoute>
          }
        />        
        {/* Rotas de Operador */}
        <Route 
          path="/operador" 
          element={
            <ProtectedRoute requiredRole="operador">
              <OperadorDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/operador/recepcionistas" 
          element={
            <ProtectedRoute requiredRole="operador">
              <GerenciarRecepcionistas />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/operador/recepcionistas/novo" 
          element={
            <ProtectedRoute requiredRole="operador">
              <CriarRecepcionista />
            </ProtectedRoute>
          }
        />
        <Route 
          path="/operador/recepcionistas/:id" 
          element={
            <ProtectedRoute requiredRole="operador">
              <EditarRecepcionista />
            </ProtectedRoute>
          }
        />
        <Route
          path="/operador/participantes/:eventoId/novo" 
          element={
            <ProtectedRoute requiredRole="operador">
              <CriarParticipante />
            </ProtectedRoute>
          }
        />
        <Route
          path="/operador/participantes/:eventoId/:id/editar" 
          element={
            <ProtectedRoute requiredRole="operador">
              <EditarParticipante />
            </ProtectedRoute>
          }
        />
        <Route 
          path="/operador/editor-crachas/:eventoId" 
          element={
            <ProtectedRoute requiredRole="operador">
              <EditorCrachas />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/operador/editor-painel/:eventoId" 
          element={
            <ProtectedRoute requiredRole="operador">
              <EditorPainel />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/operador/participantes" 
          element={
            <ProtectedRoute requiredRole="operador">
              <GerenciarParticipantes />
            </ProtectedRoute>
          } 
        />

        {/* Rotas de Recepcionista */}
        <Route 
          path="/recepcionista" 
          element={
            <ProtectedRoute requiredRole="recepcionista">
              <RecepcionistaDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/recepcionista/painel/:eventoId" 
          element={
            <ProtectedRoute requiredRole="recepcionista">
              <PainelRecepcao />
            </ProtectedRoute>
          } 
        />

        {/* Redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;