
/**
 * GuardiaPass Core Crypto v3.1
 * High-performance memoized AES-GCM-256 implementation
 */

const SALT: Uint8Array<ArrayBuffer> = new Uint8Array(
  new TextEncoder().encode("guardiapass_v3_neural_core_salt")
);

// Key Cache with size limit to prevent memory bloat
const _keyCache = new Map<string, CryptoKey>();
const CACHE_LIMIT = 10;

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

export const encryptData = async (text: string): Promise<string> => {
  const master = localStorage.getItem('guardiapass_master_pass') || "admin123";
  const key = await getDerivation(master, SALT);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ct = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
  const out = new Uint8Array(iv.length + ct.byteLength);
  out.set(iv); out.set(new Uint8Array(ct), 12);
  return btoa(String.fromCharCode(...out));
};

export const decryptData = async (encrypted: string): Promise<string | null> => {
  try {
    const master = localStorage.getItem('guardiapass_master_pass') || "admin123";
    const key = await getDerivation(master, SALT);
    const bytes = new Uint8Array(atob(encrypted).split("").map(c => c.charCodeAt(0)));
    const dec = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, key, bytes.slice(12));
    return new TextDecoder().decode(dec);
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

export const verifyMasterPassword = (input: string): boolean => {
  return input === (localStorage.getItem('guardiapass_master_pass') || "admin123");
};

export const changeMasterPassword = async (newPassword: string): Promise<void> => {
  _keyCache.clear();
  localStorage.setItem('guardiapass_master_pass', newPassword);
};

export const getMasterPassword = (): string => {
  return localStorage.getItem('guardiapass_master_pass') || "admin123";
};
