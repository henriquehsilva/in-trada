// scripts/seed.ts
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, addDoc } from 'firebase/firestore';

const app = initializeApp({ projectId: 'demo-project' as any });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);

async function main() {
  // cria o evento e captura a referência
  const eventoRef = await addDoc(collection(db, 'eventos'), {
    nome: 'INTRADA CREDENCIAMENTOS',
    local: 'TESTE',
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    dataInicio: new Date().toISOString(),
    dataFim: new Date().toISOString(),
  });

  console.log('Evento criado com ID:', eventoRef.id);

  // usa o id do evento como eventoId do usuário
  await addDoc(collection(db, 'usuarios'), {
    nome: 'Wanderley',
    email: 'wanderley@intradacredenciamentos.com.br',
    eventoId: eventoRef.id,  // <-- aqui
    role: 'operador',
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  });

  console.log('Usuário criado vinculado ao evento', eventoRef.id);
}
main();
