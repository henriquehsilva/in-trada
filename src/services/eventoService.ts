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
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Evento, CampoPersonalizado } from '../models/types';

// Criar novo evento
export const criarEvento = async (
  evento: Omit<Evento, 'id' | 'criadoEm' | 'atualizadoEm'>
): Promise<string> => {
  try {
    const eventoRef = await addDoc(collection(db, 'eventos'), {
      ...evento,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
    
    return eventoRef.id;
  } catch (error) {
    console.error('Erro ao criar evento:', error);
    throw error;
  }
};

// Obter todos os eventos
export const obterEventos = async (): Promise<Evento[]> => {
  try {
    const eventosRef = collection(db, 'eventos');
    const snapshot = await getDocs(eventosRef);

    const eventos = await Promise.all(snapshot.docs.map(async docSnap => {
      const data = docSnap.data();

      const participantesQuery = query(
        collection(db, 'participantes'),
        where('eventoId', '==', docSnap.id)
      );
      const participantesSnap = await getDocs(participantesQuery);
      const quantidadeParticipantes = participantesSnap.size;

      return {
        id: docSnap.id,
        ...data,
        quantidadeParticipantes,
        criadoEm: data.criadoEm instanceof Timestamp ? data.criadoEm.toDate().toISOString() : data.criadoEm,
        atualizadoEm: data.atualizadoEm instanceof Timestamp ? data.atualizadoEm.toDate().toISOString() : data.atualizadoEm,
      } as Evento;
    }));

    return eventos;
  } catch (error) {
    console.error('Erro ao obter eventos:', error);
    throw error;
  }
};


// Obter evento por ID
export const obterEventoPorId = async (id: string): Promise<Evento | null> => {
  try {
    const eventoRef = doc(db, 'eventos', id);
    const snapshot = await getDoc(eventoRef);
    
    if (!snapshot.exists()) {
      return null;
    }
    
    const data = snapshot.data();
    return {
      id: snapshot.id,
      ...data,
      criadoEm: data.criadoEm instanceof Timestamp ? data.criadoEm.toDate().toISOString() : data.criadoEm,
      atualizadoEm: data.atualizadoEm instanceof Timestamp ? data.atualizadoEm.toDate().toISOString() : data.atualizadoEm,
    } as Evento;
  } catch (error) {
    console.error('Erro ao obter evento por ID:', error);
    throw error;
  }
};

// Atualizar evento
export const atualizarEvento = async (
  id: string,
  eventoAtualizado: Partial<Omit<Evento, 'id' | 'criadoEm' | 'atualizadoEm'>>
): Promise<void> => {
  try {
    const eventoRef = doc(db, 'eventos', id);
    await updateDoc(eventoRef, {
      ...eventoAtualizado,
      atualizadoEm: serverTimestamp(),
    });
  } catch (error) {
    console.error('Erro ao atualizar evento:', error);
    throw error;
  }
};

// Excluir evento
export const excluirEvento = async (id: string): Promise<void> => {
  try {
    const eventoRef = doc(db, 'eventos', id);
    await deleteDoc(eventoRef);
  } catch (error) {
    console.error('Erro ao excluir evento:', error);
    throw error;
  }
};

// Adicionar campo personalizado ao evento
export const adicionarCampoPersonalizado = async (
  eventoId: string,
  campo: CampoPersonalizado
): Promise<void> => {
  try {
    const eventoRef = doc(db, 'eventos', eventoId);
    const snapshot = await getDoc(eventoRef);
    
    if (!snapshot.exists()) {
      throw new Error('Evento não encontrado');
    }
    
    const data = snapshot.data();
    const camposAtuais = data.camposPersonalizados || [];
    
    await updateDoc(eventoRef, {
      camposPersonalizados: [...camposAtuais, campo],
      atualizadoEm: serverTimestamp(),
    });
  } catch (error) {
    console.error('Erro ao adicionar campo personalizado:', error);
    throw error;
  }
};

// Remover campo personalizado do evento
export const removerCampoPersonalizado = async (
  eventoId: string,
  campoId: string
): Promise<void> => {
  try {
    const eventoRef = doc(db, 'eventos', eventoId);
    const snapshot = await getDoc(eventoRef);
    
    if (!snapshot.exists()) {
      throw new Error('Evento não encontrado');
    }
    
    const data = snapshot.data();
    const camposAtuais = data.camposPersonalizados || [];
    const camposAtualizados = camposAtuais.filter((campo: CampoPersonalizado) => campo.id !== campoId);
    
    await updateDoc(eventoRef, {
      camposPersonalizados: camposAtualizados,
      atualizadoEm: serverTimestamp(),
    });
  } catch (error) {
    console.error('Erro ao remover campo personalizado:', error);
    throw error;
  }
};