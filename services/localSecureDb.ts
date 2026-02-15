import { decryptData, encryptData } from './cryptoService';
import { HiddenPhotoEntry, IdentityEntry, PasswordEntry, VisitRecord } from '../types';

const DB_NAME = 'guardiapass_secure_local_db';
const DB_VERSION = 1;
const STORE_NAME = 'secure_records';

interface SecureRecord {
  key: string;
  cipher: string;
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function putRecord(key: string, value: unknown): Promise<void> {
  const payload = JSON.stringify(value ?? null);
  const cipher = await encryptData(payload);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE_NAME).put({
      key,
      cipher,
      updatedAt: Date.now(),
    } satisfies SecureRecord);
  });
}

async function getRecord<T>(key: string, fallback: T): Promise<T> {
  const db = await openDb();
  const record = await new Promise<SecureRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    tx.onerror = () => reject(tx.error);
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result as SecureRecord | undefined);
    req.onerror = () => reject(req.error);
  });
  if (!record?.cipher) return fallback;
  const plaintext = await decryptData(record.cipher);
  if (!plaintext) return fallback;
  try {
    return JSON.parse(plaintext) as T;
  } catch {
    return fallback;
  }
}

const keyFor = (type: string, userEmail: string) => `${type}:${userEmail.toLowerCase()}`;

export const localSecureDb = {
  getPasswords: (userEmail: string) =>
    getRecord<PasswordEntry[]>(keyFor('passwords', userEmail), []),
  savePasswords: (userEmail: string, passwords: PasswordEntry[]) =>
    putRecord(keyFor('passwords', userEmail), passwords),

  getIdentities: (userEmail: string) =>
    getRecord<IdentityEntry[]>(keyFor('identities', userEmail), []),
  saveIdentities: (userEmail: string, identities: IdentityEntry[]) =>
    putRecord(keyFor('identities', userEmail), identities),

  getVisits: (userEmail: string) =>
    getRecord<VisitRecord[]>(keyFor('visits', userEmail), []),
  saveVisits: (userEmail: string, visits: VisitRecord[]) =>
    putRecord(keyFor('visits', userEmail), visits),

  getHiddenPhotos: (userEmail: string) =>
    getRecord<HiddenPhotoEntry[]>(keyFor('hidden-photos', userEmail), []),
  saveHiddenPhotos: (userEmail: string, photos: HiddenPhotoEntry[]) =>
    putRecord(keyFor('hidden-photos', userEmail), photos),
};
