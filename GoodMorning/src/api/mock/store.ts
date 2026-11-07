/**
 * Mock 後端的持久化：IndexedDB（可存 Blob）。不可用時（無痕模式、預覽環境）退回記憶體。
 */
const DB = 'good-morning-mock'
const STORE = 'kv'

let dbPromise: Promise<IDBDatabase | null> | null = null
const memory = new Map<string, unknown>()

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await open()
  if (!db) return memory.get(key) as T | undefined
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      req.onsuccess = () => resolve(req.result as T | undefined)
      req.onerror = () => resolve(memory.get(key) as T | undefined)
    } catch {
      resolve(memory.get(key) as T | undefined)
    }
  })
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  memory.set(key, value)
  const db = await open()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

export async function kvClear(): Promise<void> {
  memory.clear()
  const db = await open()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}
