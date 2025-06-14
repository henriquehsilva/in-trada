import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut, 
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

export type UserRole = 'admin' | 'operador' | 'recepcionista';

interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  eventoId?: string; // Para recepcionistas
}

interface AuthContextType {
  currentUser: User | null;
  userData: UserData | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        // Busca dados adicionais do usuário no Firestore
        const userDocRef = doc(db, 'usuarios', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        console.log('user:', user);
        console.log('userDoc.exists:', userDoc.exists());
        console.log('userDoc.data:', userDoc.data());

        if (userDoc.exists()) {
          const userDataFromFirestore = userDoc.data() as Omit<UserData, 'uid' | 'email' | 'displayName'>;
          setUserData({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            ...userDataFromFirestore
          });
        } else {
          console.error('Dados do usuário não encontrados no Firestore');
        }
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signup = async (email: string, password: string, name: string, role: UserRole) => {
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      
      // Atualiza o displayName
      await updateProfile(user, { displayName: name });
      
      // Armazena informações adicionais no Firestore
      await setDoc(doc(db, 'usuarios', user.uid), {
        role,
        createdAt: new Date().toISOString()
      });
      
      setCurrentUser(user);
      setUserData({
        uid: user.uid,
        email: user.email,
        displayName: name,
        role
      });
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Erro ao enviar email de recuperação de senha:', error);
      throw error;
    }
  };

  const value = {
    currentUser,
    userData,
    login,
    signup,
    logout,
    resetPassword,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
