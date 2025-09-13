// firebase.ts (Vite + TS)
import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  getFirestore,
  disableNetwork,
  enableNetwork,
} from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const app = getApps().length ? getApp() : initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
})

// ✅ Inicialize o Firestore já com cache persistente
initializeFirestore(app, {
  localCache: persistentLocalCache({
    // use multipleTab se quiser várias abas sincronizadas
    tabManager: persistentSingleTabManager({}),
  }),
})

export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)

// (opcional) helpers para alternar rede manualmente
export const goOffline = () => disableNetwork(db)
export const goOnline = () => enableNetwork(db)

export default app
