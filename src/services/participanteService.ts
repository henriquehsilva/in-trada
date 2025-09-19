// src/services/participanteService.ts
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocsFromCache,
  getDocsFromServer,
  getDocFromCache,
  getDocFromServer,
  query,
  where,
  serverTimestamp,
  Timestamp,
  orderBy,
  limit,
  onSnapshot,
  type QueryConstraint,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { Participante } from '../models/types'

const COL = 'participantes'

// ------- helpers -------
function toISO(v: any) {
  return v instanceof Timestamp ? v.toDate().toISOString() : v
}
function normalizeDoc<T = any>(id: string, data: any): T {
  return {
    id,
    ...data,
    criadoEm: toISO(data.criadoEm),
    atualizadoEm: toISO(data.atualizadoEm),
  }
}

// Criar novo participante (funciona offline; sincroniza quando online)
export const criarParticipante = async (
  participante: Omit<Participante, 'id' | 'criadoEm' | 'atualizadoEm'>
): Promise<string> => {
  const ref = await addDoc(collection(db, COL), {
    ...participante,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  })
  return ref.id
}

// Obter todos os participantes de um evento (cache → server)
export const obterParticipantesPorEvento = async (eventoId: string): Promise<Participante[]> => {
  const qy = query(collection(db, COL), where('eventoId', '==', eventoId), orderBy('nome', 'asc'))
  let cached: Participante[] | undefined

  try {
    const cs = await getDocsFromCache(qy)
    cached = cs.docs.map(d => normalizeDoc<Participante>(d.id, d.data()))
  } catch {}

  try {
    const ss = await getDocsFromServer(qy)
    return ss.docs.map(d => normalizeDoc<Participante>(d.id, d.data()))
  } catch {
    // offline: devolve cache se existir
    if (cached) return cached
    // sem cache nem server: lista vazia
    return []
  }
}

// Buscar participantes por termo (puxa base cache→server e filtra local)
export const buscarParticipantes = async (eventoId: string, termo: string): Promise<Participante[]> => {
  const base = await obterParticipantesPorEvento(eventoId)
  const t = termo.trim().toLowerCase()
  if (!t) return base
  return base.filter((p: any) => {
    const arr = [p.nome, p.email1, p.email2, p.empresa, p.categoria, p.id].map((v: any) =>
      (v || '').toString().toLowerCase()
    )
    return arr.some((v: string) => v.includes(t))
  })
}

// Obter participante por ID (cache → server)
export const obterParticipantePorId = async (id: string): Promise<Participante | null> => {
  const ref = doc(db, COL, id)

  try {
    const c = await getDocFromCache(ref)
    if (c.exists()) return normalizeDoc<Participante>(c.id, c.data())
  } catch {}

  const s = await getDocFromServer(ref)
  return s.exists() ? normalizeDoc<Participante>(s.id, s.data()) : null
}

// Atualizar participante (offline-friendly)
export const atualizarParticipante = async (
  id: string,
  participanteAtualizado: Partial<Omit<Participante, 'id' | 'criadoEm' | 'atualizadoEm'>>
): Promise<void> => {
  const ref = doc(db, COL, id)
  await updateDoc(ref, {
    ...participanteAtualizado,
    atualizadoEm: serverTimestamp(),
  })
}

// Excluir participante
export const excluirParticipante = async (id: string): Promise<void> => {
  const ref = doc(db, COL, id)
  await deleteDoc(ref)
}

// Fazer check-in (offline-friendly; sincroniza depois)
export const fazerCheckin = async (id: string): Promise<void> => {
  const ref = doc(db, 'participantes', id)
  try {
    await updateDoc(ref, {
      status: 'credenciado',
      atualizadoEm: serverTimestamp(),
      checkinEm: serverTimestamp(),
    } as any)
  } catch (err: any) {
    // Se for “unavailable/offline”, seguimos otimistas (a UI já trata)
    const msg = String(err?.message || '')
    if (msg.includes('unavailable') || msg.includes('offline') || msg.includes('Failed to get')) {
      // opcional: log
      console.warn('Check-in offline (otimista):', err)
      return
    }
    throw err
  }
}

/**
 * Reservar etiqueta “apenas 1x” (cliente otimista)
 * - Atualiza local/offline; na sincronização o servidor valida.
 * - Para garantia real no backend, crie regra no Firestore
 *   impedindo sobrescrita quando `etiquetaImpressaEm` já existe.
 */
export const reservarEtiquetaUmaVez = async (id: string, usuarioId: string): Promise<void> => {
  const ref = doc(db, COL, id)
  await updateDoc(ref, {
    etiquetaImpressaEm: serverTimestamp(),
    etiquetaImpressaPorId: usuarioId,
    atualizadoEm: serverTimestamp(),
  } as any)
}

// Estatísticas (cache → server)
export const obterEstatisticasParticipantes = async (eventoId: string): Promise<{
  total: number
  porStatus: { [key: string]: number }
  porCategoria: { [key: string]: number }
}> => {
  const qy = query(collection(db, COL), where('eventoId', '==', eventoId))
  let docs: Participante[] = []

  try {
    const cs = await getDocsFromCache(qy)
    docs = cs.docs.map(d => normalizeDoc<Participante>(d.id, d.data()))
  } catch {}

  try {
    const ss = await getDocsFromServer(qy)
    docs = ss.docs.map(d => normalizeDoc<Participante>(d.id, d.data()))
  } catch {
    // mantém o que tiver no cache
  }

  const total = docs.length
  const porStatus = docs.reduce((acc, curr) => {
    const k = (curr as any).status || 'indefinido'
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const porCategoria = docs.reduce((acc, curr) => {
    const k = (curr as any).categoria || 'indefinida'
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return { total, porStatus, porCategoria }
}

/**
 * Assinatura para “aquecer” o cache e manter base local atualizada
 * (opcional, mas recomendado para telas que ficam abertas)
 */
export function subscribeParticipantesDoEvento(
  eventoId: string,
  cb: (lista: Participante[]) => void,
  ...extras: QueryConstraint[]
) {
  const qy = query(collection(db, COL), where('eventoId', '==', eventoId), ...extras)
  return onSnapshot(qy, (snap) => {
    const arr = snap.docs.map(d => normalizeDoc<Participante>(d.id, d.data()))
    cb(arr)
  })
}
