// firebase.ts
import { getApp, getApps, initializeApp } from 'firebase/app'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  getFirestore, disableNetwork, enableNetwork
} from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'

const app = getApps().length ? getApp() : initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

// Persistência offline já na criação (single tab; troque por multipleTab se quiser)
initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) })
})

export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)

// (opcionais) helpers para alternar rede manualmente em testes
export const goOffline = () => disableNetwork(db)
export const goOnline  = () => enableNetwork(db)
