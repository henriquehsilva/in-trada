// firebase.ts
import { getApp, getApps, initializeApp } from 'firebase/app'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  persistentSingleTabManager,
  memoryLocalCache,
  getFirestore,
  disableNetwork,
  enableNetwork,
} from 'firebase/firestore'
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  getAuth,
} from 'firebase/auth'
import { getStorage } from 'firebase/storage'

const app = getApps().length
  ? getApp()
  : initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    })

// Firestore com cache persistente e fallbacks
export const db = (() => {
  try {
    // múltiplas abas compartilhando o cache (⚠ settings exigido)
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(), // <- passou {}
        cacheSizeBytes: 100 * 1024 * 1024,
      }),
    })
  } catch {
    try {
      // single tab (kiosk) (⚠ settings exigido)
      return initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentSingleTabManager({}), // <- passou {}
        }),
      })
    } catch {
      // memória (não persistente)
      return initializeFirestore(app, {
        localCache: memoryLocalCache(),
      })
    }
  }
})()

// Auth com persistência local (IndexedDB -> localStorage)
export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    })
  } catch {
    return getAuth(app)
  }
})()

export const storage = getStorage(app)

// Helpers para simular offline/online
export const goOffline = () => disableNetwork(db)
export const goOnline = () => enableNetwork(db)
