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
import { ModeloCracha, ModeloPainel, ComponenteEditor } from '../models/types';

// Criar novo modelo de crachá
export const criarModeloCracha = async (
  modelo: Omit<ModeloCracha, 'id' | 'criadoEm' | 'atualizadoEm'>
): Promise<string> => {
  try {
    const modeloRef = await addDoc(collection(db, 'modelosCracha'), {
      ...modelo,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
    
    return modeloRef.id;
  } catch (error) {
    console.error('Erro ao criar modelo de crachá:', error);
    throw error;
  }
};

// Obter todos os modelos de crachá por evento
export const obterModelosCrachaPorEvento = async (eventoId: string): Promise<ModeloCracha[]> => {
  try {
    const modelosRef = collection(db, 'modelosCracha');
    const q = query(modelosRef, where('eventoId', '==', eventoId));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        criadoEm: data.criadoEm instanceof Timestamp ? data.criadoEm.toDate().toISOString() : data.criadoEm,
        atualizadoEm: data.atualizadoEm instanceof Timestamp ? data.atualizadoEm.toDate().toISOString() : data.atualizadoEm,
      } as ModeloCracha;
    });
  } catch (error) {
    console.error('Erro ao obter modelos de crachá por evento:', error);
    throw error;
  }
};

// Obter modelo de crachá por ID
export const obterModeloCrachaPorId = async (id: string): Promise<ModeloCracha | null> => {
  try {
    const modeloRef = doc(db, 'modelosCracha', id);
    const snapshot = await getDoc(modeloRef);
    
    if (!snapshot.exists()) {
      return null;
    }
    
    const data = snapshot.data();
    return {
      id: snapshot.id,
      ...data,
      criadoEm: data.criadoEm instanceof Timestamp ? data.criadoEm.toDate().toISOString() : data.criadoEm,
      atualizadoEm: data.atualizadoEm instanceof Timestamp ? data.atualizadoEm.toDate().toISOString() : data.atualizadoEm,
    } as ModeloCracha;
  } catch (error) {
    console.error('Erro ao obter modelo de crachá por ID:', error);
    throw error;
  }
};

// Atualizar modelo de crachá
export const atualizarModeloCracha = async (
  id: string,
  modeloAtualizado: Partial<Omit<ModeloCracha, 'id' | 'criadoEm' | 'atualizadoEm'>>
): Promise<void> => {
  try {
    const modeloRef = doc(db, 'modelosCracha', id);
    await updateDoc(modeloRef, {
      ...modeloAtualizado,
      atualizadoEm: serverTimestamp(),
    });
  } catch (error) {
    console.error('Erro ao atualizar modelo de crachá:', error);
    throw error;
  }
};

// Excluir modelo de crachá
export const excluirModeloCracha = async (id: string): Promise<void> => {
  try {
    const modeloRef = doc(db, 'modelosCracha', id);
    await deleteDoc(modeloRef);
  } catch (error) {
    console.error('Erro ao excluir modelo de crachá:', error);
    throw error;
  }
};

// Criar novo modelo de painel
export const criarModeloPainel = async (
  modelo: Omit<ModeloPainel, 'id' | 'criadoEm' | 'atualizadoEm'>
): Promise<string> => {
  try {
    const modeloRef = await addDoc(collection(db, 'modelosPainel'), {
      ...modelo,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
    
    return modeloRef.id;
  } catch (error) {
    console.error('Erro ao criar modelo de painel:', error);
    throw error;
  }
};

// Obter todos os modelos de painel por evento
export const obterModelosPainelPorEvento = async (eventoId: string): Promise<ModeloPainel[]> => {
  try {
    const modelosRef = collection(db, 'modelosPainel');
    const q = query(modelosRef, where('eventoId', '==', eventoId));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        criadoEm: data.criadoEm instanceof Timestamp ? data.criadoEm.toDate().toISOString() : data.criadoEm,
        atualizadoEm: data.atualizadoEm instanceof Timestamp ? data.atualizadoEm.toDate().toISOString() : data.atualizadoEm,
      } as ModeloPainel;
    });
  } catch (error) {
    console.error('Erro ao obter modelos de painel por evento:', error);
    throw error;
  }
};

// Obter modelo de painel por ID
export const obterModeloPainelPorId = async (id: string): Promise<ModeloPainel | null> => {
  try {
    const modeloRef = doc(db, 'modelosPainel', id);
    const snapshot = await getDoc(modeloRef);
    
    if (!snapshot.exists()) {
      return null;
    }
    
    const data = snapshot.data();
    return {
      id: snapshot.id,
      ...data,
      criadoEm: data.criadoEm instanceof Timestamp ? data.criadoEm.toDate().toISOString() : data.criadoEm,
      atualizadoEm: data.atualizadoEm instanceof Timestamp ? data.atualizadoEm.toDate().toISOString() : data.atualizadoEm,
    } as ModeloPainel;
  } catch (error) {
    console.error('Erro ao obter modelo de painel por ID:', error);
    throw error;
  }
};

// Atualizar modelo de painel
export const atualizarModeloPainel = async (
  id: string,
  modeloAtualizado: Partial<Omit<ModeloPainel, 'id' | 'criadoEm' | 'atualizadoEm'>>
): Promise<void> => {
  try {
    const modeloRef = doc(db, 'modelosPainel', id);
    await updateDoc(modeloRef, {
      ...modeloAtualizado,
      atualizadoEm: serverTimestamp(),
    });
  } catch (error) {
    console.error('Erro ao atualizar modelo de painel:', error);
    throw error;
  }
};

// Excluir modelo de painel
export const excluirModeloPainel = async (id: string): Promise<void> => {
  try {
    const modeloRef = doc(db, 'modelosPainel', id);
    await deleteDoc(modeloRef);
  } catch (error) {
    console.error('Erro ao excluir modelo de painel:', error);
    throw error;
  }
};