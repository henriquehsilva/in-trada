import { deleteApp, getApps, initializeApp } from 'firebase/app'
import {
  collection,
  doc,
  getDocsFromServer,
  initializeFirestore,
  memoryLocalCache,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/config'

const COLLECTIONS = [
  'eventos',
  'usuarios',
  'participantes',
  'modelosCracha',
  'modelosPainel',
  'modelosRecepcionista',
] as const

const BATCH_SIZE = 400
const PRODUCTION_APP_NAME = 'firebase-production-sync'

export interface ResultadoSincronizacao {
  total: number
  porColecao: Record<string, number>
}

export async function baixarFirestoreParaEmulator(): Promise<ResultadoSincronizacao> {
  if (import.meta.env.VITE_USE_EMULATORS !== '1') {
    throw new Error('A sincronização só pode ser executada no ambiente de emuladores.')
  }

  const existingApp = getApps().find(app => app.name === PRODUCTION_APP_NAME)
  if (existingApp) await deleteApp(existingApp)

  const productionApp = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }, PRODUCTION_APP_NAME)
  // Esta instância nunca deve reutilizar o cache do emulador. Além disso, a
  // detecção de long polling evita falhas do canal WebSocket em alguns
  // navegadores, proxies e ambientes locais.
  const productionDb = initializeFirestore(productionApp, {
    localCache: memoryLocalCache(),
    experimentalAutoDetectLongPolling: true,
  })
  const porColecao: Record<string, number> = {}

  try {
    for (const collectionName of COLLECTIONS) {
      let snapshot

      try {
        snapshot = await getDocsFromServer(
          collection(productionDb, collectionName),
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'erro desconhecido'
        throw new Error(`Falha ao baixar a coleção "${collectionName}": ${message}`)
      }
      porColecao[collectionName] = snapshot.size

      for (let start = 0; start < snapshot.docs.length; start += BATCH_SIZE) {
        const batch = writeBatch(db)
        const documents = snapshot.docs.slice(start, start + BATCH_SIZE)

        documents.forEach(sourceDocument => {
          batch.set(
            doc(db, collectionName, sourceDocument.id),
            sourceDocument.data(),
          )
        })

        await batch.commit()
      }
    }

    return {
      total: Object.values(porColecao).reduce((sum, count) => sum + count, 0),
      porColecao,
    }
  } finally {
    await deleteApp(productionApp)
  }
}
