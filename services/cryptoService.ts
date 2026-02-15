
/**
 * GuardiaPass Core Crypto v3.1
 * High-performance memoized AES-GCM-256 implementation
 */

const LEGACY_SALT: Uint8Array<ArrayBuffer> = new Uint8Array(
  new TextEncoder().encode("guardiapass_v3_neural_core_salt")
);
const LEGACY_MASTER_KEY = 'guardiapass_master_pass';
const RUNTIME_MASTER_KEY = 'gp_runtime_master_pass';
const MASTER_VERIFIER_KEY = 'gp_master_verifier_v1';
const KDF_SALT_KEY = 'gp_kdf_salt_v1';

// Key Cache with size limit to prevent memory bloat
const _keyCache = new Map<string, CryptoKey>();
const CACHE_LIMIT = 10;
const B64_CHUNK_SIZE = 0x8000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += B64_CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + B64_CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const manageCache = (key: string, cryptoKey: CryptoKey) => {
  if (_keyCache.size >= CACHE_LIMIT) {
    const firstKey = _keyCache.keys().next().value;
    if (firstKey) _keyCache.delete(firstKey);
  }
  _keyCache.set(key, cryptoKey);
};

export const isBiometricAvailable = async (): Promise<boolean> => {
  if (!window.PublicKeyCredential) return false;
  return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
};

async function getDerivation(
  password: string,
  salt: Uint8Array<ArrayBuffer>
): Promise<CryptoKey> {
  const cacheKey = `${password}_${btoa(String.fromCharCode(...salt))}`;
  if (_keyCache.has(cacheKey)) return _keyCache.get(cacheKey)!;

  const enc = new TextEncoder();
  const material = await window.crypto.subtle.importKey(
    "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
  );
  const key = await window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  
  manageCache(cacheKey, key);
  return key;
}

function bytesToBase64Safe(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytesSafe(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function getOrCreateKdfSalt(): Uint8Array {
  const existing = localStorage.getItem(KDF_SALT_KEY);
  if (existing) {
    try {
      const parsed = base64ToBytesSafe(existing);
      if (parsed.length >= 16) return parsed;
    } catch {}
  }
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(KDF_SALT_KEY, bytesToBase64Safe(salt));
  return salt;
}

async function digestMaster(password: string): Promise<string> {
  const salt = getOrCreateKdfSalt();
  const data = new TextEncoder().encode(`gp-master-v1:${bytesToBase64Safe(salt)}:${password}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return bytesToBase64(new Uint8Array(hash));
}

function getRuntimeMasterPassword(): string {
  return sessionStorage.getItem(RUNTIME_MASTER_KEY) || '';
}

function setRuntimeMasterPassword(password: string): void {
  sessionStorage.setItem(RUNTIME_MASTER_KEY, password);
}

async function resolveMasterPasswordForCrypto(): Promise<string | null> {
  const runtime = getRuntimeMasterPassword();
  if (runtime) return runtime;
  const hasVerifier = !!localStorage.getItem(MASTER_VERIFIER_KEY);
  if (hasVerifier) return null;
  // Legacy fallback path for pre-migration installs.
  return localStorage.getItem(LEGACY_MASTER_KEY) || "admin123";
}

export const encryptData = async (text: string): Promise<string> => {
  const master = await resolveMasterPasswordForCrypto();
  if (!master) throw new Error('Vault locked');
  const key = await getDerivation(master, getOrCreateKdfSalt());
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ct = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
  const out = new Uint8Array(iv.length + ct.byteLength);
  out.set(iv); out.set(new Uint8Array(ct), 12);
  return bytesToBase64(out);
};

export const decryptData = async (encrypted: string): Promise<string | null> => {
  try {
    const bytes = base64ToBytes(encrypted);
    const runtimeOrLegacy = await resolveMasterPasswordForCrypto();
    if (runtimeOrLegacy) {
      try {
        const key = await getDerivation(runtimeOrLegacy, getOrCreateKdfSalt());
        const dec = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, key, bytes.slice(12));
        return new TextDecoder().decode(dec);
      } catch {}
    }
    // Legacy salt fallback for existing encrypted payloads prior to migration.
    const legacyMaster = localStorage.getItem(LEGACY_MASTER_KEY) || runtimeOrLegacy || "admin123";
    const legacyKey = await getDerivation(legacyMaster, LEGACY_SALT);
    const decLegacy = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, legacyKey, bytes.slice(12));
    return new TextDecoder().decode(decLegacy);
  } catch (e) { return null; }
};

export const requestBiometricAuth = async (): Promise<boolean> => {
  try {
    const options: any = {
      publicKey: {
        challenge: window.crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "GuardiaPass Core" },
        user: { id: window.crypto.getRandomValues(new Uint8Array(16)), name: "neural_user", displayName: "User" },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }],
        authenticatorSelection: { userVerification: "required" },
        timeout: 60000
      }
    };
    return !!(await navigator.credentials.create(options));
  } catch (err) { return false; }
};

export const verifyMasterPassword = async (input: string): Promise<boolean> => {
  const verifier = localStorage.getItem(MASTER_VERIFIER_KEY);
  if (verifier) {
    const digest = await digestMaster(input);
    const ok = digest === verifier;
    if (ok) setRuntimeMasterPassword(input);
    return ok;
  }

  // Legacy migration path.
  const legacy = localStorage.getItem(LEGACY_MASTER_KEY) || "admin123";
  const ok = input === legacy;
  if (ok) {
    setRuntimeMasterPassword(input);
    localStorage.setItem(MASTER_VERIFIER_KEY, await digestMaster(input));
    localStorage.removeItem(LEGACY_MASTER_KEY);
  }
  return ok;
};

export const changeMasterPassword = async (newPassword: string): Promise<void> => {
  _keyCache.clear();
  localStorage.setItem(MASTER_VERIFIER_KEY, await digestMaster(newPassword));
  localStorage.removeItem(LEGACY_MASTER_KEY);
  setRuntimeMasterPassword(newPassword);
};

export const getMasterPassword = (): string => {
  return getRuntimeMasterPassword();
};
