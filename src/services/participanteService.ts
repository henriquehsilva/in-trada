import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Participante } from '../models/types';

// Criar novo participante
export const criarParticipante = async (
  participante: Omit<Participante, 'id' | 'criadoEm' | 'atualizadoEm'>
): Promise<string> => {
  try {
    const participanteRef = await addDoc(collection(db, 'participantes'), {
      ...participante,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
    
    return participanteRef.id;
  } catch (error) {
    console.error('Erro ao criar participante:', error);
    throw error;
  }
};

// Obter todos os participantes de um evento
export const obterParticipantesPorEvento = async (eventoId: string): Promise<Participante[]> => {
  try {
    const participantesRef = collection(db, 'participantes');
    const q = query(
      participantesRef,
      where('eventoId', '==', eventoId),
      orderBy('nome', 'asc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        criadoEm: data.criadoEm instanceof Timestamp ? data.criadoEm.toDate().toISOString() : data.criadoEm,
        atualizadoEm: data.atualizadoEm instanceof Timestamp ? data.atualizadoEm.toDate().toISOString() : data.atualizadoEm,
      } as Participante;
    });
  } catch (error) {
    console.error('Erro ao obter participantes por evento:', error);
    throw error;
  }
};

// Buscar participantes por termo de busca
export const buscarParticipantes = async (
  eventoId: string,
  termo: string
): Promise<Participante[]> => {
  try {
    // Implementação simples - em uma aplicação real, usar alguma solução de busca
    // como Algolia ou implementação específica do Firestore
    const participantesRef = collection(db, 'participantes');
    const q = query(
      participantesRef,
      where('eventoId', '==', eventoId)
    );
    const snapshot = await getDocs(q);
    
    const participantes = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        criadoEm: data.criadoEm instanceof Timestamp ? data.criadoEm.toDate().toISOString() : data.criadoEm,
        atualizadoEm: data.atualizadoEm instanceof Timestamp ? data.atualizadoEm.toDate().toISOString() : data.atualizadoEm,
      } as Participante;
    });
    
    // Realizar busca local nos resultados
    const termoLowerCase = termo.toLowerCase();
    return participantes.filter(p => 
      p.nome.toLowerCase().includes(termoLowerCase) ||
      p.email.toLowerCase().includes(termoLowerCase) ||
      p.empresa.toLowerCase().includes(termoLowerCase)
    );
  } catch (error) {
    console.error('Erro ao buscar participantes:', error);
    throw error;
  }
};

// Obter participante por ID
export const obterParticipantePorId = async (id: string): Promise<Participante | null> => {
  try {
    const participanteRef = doc(db, 'participantes', id);
    const snapshot = await getDoc(participanteRef);
    
    if (!snapshot.exists()) {
      return null;
    }
    
    const data = snapshot.data();
    return {
      id: snapshot.id,
      ...data,
      criadoEm: data.criadoEm instanceof Timestamp ? data.criadoEm.toDate().toISOString() : data.criadoEm,
      atualizadoEm: data.atualizadoEm instanceof Timestamp ? data.atualizadoEm.toDate().toISOString() : data.atualizadoEm,
    } as Participante;
  } catch (error) {
    console.error('Erro ao obter participante por ID:', error);
    throw error;
  }
};

// Atualizar participante
export const atualizarParticipante = async (
  id: string,
  participanteAtualizado: Partial<Omit<Participante, 'id' | 'criadoEm' | 'atualizadoEm'>>
): Promise<void> => {
  try {
    const participanteRef = doc(db, 'participantes', id);
    await updateDoc(participanteRef, {
      ...participanteAtualizado,
      atualizadoEm: serverTimestamp(),
    });
  } catch (error) {
    console.error('Erro ao atualizar participante:', error);
    throw error;
  }
};

// Excluir participante
export const excluirParticipante = async (id: string): Promise<void> => {
  try {
    const participanteRef = doc(db, 'participantes', id);
    await deleteDoc(participanteRef);
  } catch (error) {
    console.error('Erro ao excluir participante:', error);
    throw error;
  }
};

// Fazer check-in de participante
export const fazerCheckin = async (id: string): Promise<void> => {
  try {
    const participanteRef = doc(db, 'participantes', id);
    await updateDoc(participanteRef, {
      status: 'credenciado',
      atualizadoEm: serverTimestamp(),
    });
  } catch (error) {
    console.error('Erro ao fazer check-in de participante:', error);
    throw error;
  }
};

// Obter estatísticas de participantes por evento
export const obterEstatisticasParticipantes = async (eventoId: string): Promise<{
  total: number;
  porStatus: { [key: string]: number };
  porCategoria: { [key: string]: number };
}> => {
  try {
    const participantesRef = collection(db, 'participantes');
    const q = query(participantesRef, where('eventoId', '==', eventoId));
    const snapshot = await getDocs(q);
    
    const participantes = snapshot.docs.map(doc => doc.data() as Participante);
    const total = participantes.length;
    
    // Contagem por status
    const porStatus = participantes.reduce((acc, curr) => {
      const status = curr.status;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
    
    // Contagem por categoria
    const porCategoria = participantes.reduce((acc, curr) => {
      const categoria = curr.categoria;
      acc[categoria] = (acc[categoria] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
    
    return {
      total,
      porStatus,
      porCategoria,
    };
  } catch (error) {
    console.error('Erro ao obter estatísticas de participantes:', error);
    throw error;
  }
};