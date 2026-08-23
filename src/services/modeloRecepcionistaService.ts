import { db } from '../firebase/config';
import { collection, addDoc, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { ModeloRecepcionista } from '../models/types';

const COLLECTION = 'modelosRecepcionista';

export const criarModeloRecepcionista = async (modelo: Omit<ModeloRecepcionista, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<string> => {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...modelo,
    criadoEm: now,
    atualizadoEm: now
  });
  return docRef.id;
};

export const obterModeloRecepcionistaPorEvento = async (eventoId: string): Promise<ModeloRecepcionista | null> => {
  const q = query(collection(db, COLLECTION), where('eventoId', '==', eventoId));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const docSnap = snapshot.docs[0];
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<ModeloRecepcionista, 'id'>)
  };
};

export const atualizarModeloRecepcionista = async (
  id: string,
  dados: Partial<ModeloRecepcionista>
): Promise<void> => {
  const ref = doc(db, COLLECTION, id);
  await updateDoc(ref, {
    ...dados,
    atualizadoEm: new Date().toISOString()
  });
};
