import { demoMode } from './demoMode';
import { HiddenPhotoEntry, IdentityEntry, PasswordEntry, VisitRecord } from '../types';
import { localSecureDb } from './localSecureDb';

const API_BASE = '/api';
const LOCAL_SECURE_ONLY = true;
const VISIT_RETENTION_LIMIT = 10000;

async function apiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(data.error || `API error: ${response.status}`);
  }

  return response.json();
}

const demoNoop = () => Promise.resolve({ success: true });

export const vaultApi = {
  getPasswords: async (userEmail: string) => {
    if (demoMode.isActive) return [];
    if (LOCAL_SECURE_ONLY) return localSecureDb.getPasswords(userEmail);
    return apiCall(`/vault/passwords/${encodeURIComponent(userEmail)}`);
  },
  savePassword: async (data: PasswordEntry & { userEmail: string }) => {
    if (demoMode.isActive) return demoNoop();
    if (LOCAL_SECURE_ONLY) {
      const existing = await localSecureDb.getPasswords(data.userEmail);
      const next = [...existing.filter((p) => p.id !== data.id), { ...data, ownerEmail: data.userEmail }];
      await localSecureDb.savePasswords(data.userEmail, next);
      return { success: true };
    }
    return apiCall('/vault/passwords', { method: 'POST', body: JSON.stringify(data) });
  },
  updatePassword: async (id: string, data: any) => {
    if (demoMode.isActive) return demoNoop();
    if (LOCAL_SECURE_ONLY) {
      const userEmail = data.userEmail || data.ownerEmail;
      if (!userEmail) return { success: false };
      const existing = await localSecureDb.getPasswords(userEmail);
      const next = existing.map((p) => (p.id === id ? { ...p, ...data } : p));
      await localSecureDb.savePasswords(userEmail, next);
      return { success: true };
    }
    return apiCall(`/vault/passwords/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  deletePassword: async (id: string, userEmail?: string) => {
    if (demoMode.isActive) return demoNoop();
    if (LOCAL_SECURE_ONLY) {
      if (!userEmail) return { success: false };
      const existing = await localSecureDb.getPasswords(userEmail);
      await localSecureDb.savePasswords(userEmail, existing.filter((p) => p.id !== id));
      return { success: true };
    }
    return apiCall(`/vault/passwords/${id}`, { method: 'DELETE' });
  },
  getIdentities: async (userEmail: string) => {
    if (demoMode.isActive) return [];
    if (LOCAL_SECURE_ONLY) return localSecureDb.getIdentities(userEmail);
    return apiCall(`/vault/identities/${encodeURIComponent(userEmail)}`);
  },
  saveIdentity: async (data: IdentityEntry & { userEmail: string }) => {
    if (demoMode.isActive) return demoNoop();
    if (LOCAL_SECURE_ONLY) {
      const existing = await localSecureDb.getIdentities(data.userEmail);
      const next = [...existing.filter((i) => i.id !== data.id), data];
      await localSecureDb.saveIdentities(data.userEmail, next);
      return { success: true };
    }
    return apiCall('/vault/identities', { method: 'POST', body: JSON.stringify(data) });
  },
  deleteIdentity: async (id: string, userEmail?: string) => {
    if (demoMode.isActive) return demoNoop();
    if (LOCAL_SECURE_ONLY) {
      if (!userEmail) return { success: false };
      const existing = await localSecureDb.getIdentities(userEmail);
      await localSecureDb.saveIdentities(userEmail, existing.filter((i) => i.id !== id));
      return { success: true };
    }
    return apiCall(`/vault/identities/${id}`, { method: 'DELETE' });
  },
  getHiddenPhotos: async (userEmail: string) => {
    if (demoMode.isActive) return [];
    return localSecureDb.getHiddenPhotos(userEmail);
  },
  saveHiddenPhotos: async (userEmail: string, photos: HiddenPhotoEntry[]) => {
    if (demoMode.isActive) return demoNoop();
    await localSecureDb.saveHiddenPhotos(userEmail, photos);
    return { success: true };
  },
};

export const visitsApi = {
  getVisits: async (userEmail: string) => {
    if (demoMode.isActive) return [];
    if (LOCAL_SECURE_ONLY) return localSecureDb.getVisits(userEmail);
    return apiCall(`/visits/${encodeURIComponent(userEmail)}`);
  },
  saveVisit: async (data: VisitRecord & { userEmail: string }) => {
    if (demoMode.isActive) return demoNoop();
    if (LOCAL_SECURE_ONLY) {
      const existing = await localSecureDb.getVisits(data.userEmail);
      const next = [data, ...existing]
        .sort((a, b) => b.timestamp - a.timestamp)
        .filter((v, idx, arr) => arr.findIndex((x) => x.id === v.id) === idx)
        .slice(0, VISIT_RETENTION_LIMIT);
      await localSecureDb.saveVisits(data.userEmail, next);
      return { success: true };
    }
    return apiCall('/visits', { method: 'POST', body: JSON.stringify(data) });
  },
  saveBatch: async (visits: VisitRecord[], userEmail: string) => {
    if (demoMode.isActive) return demoNoop();
    if (LOCAL_SECURE_ONLY) {
      const existing = await localSecureDb.getVisits(userEmail);
      const merged = [...visits, ...existing]
        .sort((a, b) => b.timestamp - a.timestamp)
        .filter((v, idx, arr) => arr.findIndex((x) => x.id === v.id) === idx)
        .slice(0, VISIT_RETENTION_LIMIT);
      await localSecureDb.saveVisits(userEmail, merged);
      return { success: true };
    }
    return apiCall('/visits/batch', { method: 'POST', body: JSON.stringify({ visits, userEmail }) });
  },
};

export const aiApi = {
  verifyUrl: (url: string, typosquatContext?: string) =>
    apiCall('/ai/verify-url', { method: 'POST', body: JSON.stringify({ url, typosquatContext }) }),
  chat: (contents: any, systemInstruction?: string) =>
    apiCall('/ai/chat', { method: 'POST', body: JSON.stringify({ contents, systemInstruction }) }),
  analyzePassword: (password: string) =>
    apiCall('/ai/analyze-password', { method: 'POST', body: JSON.stringify({ password }) }),
  generatePassphrase: (theme: string) =>
    apiCall('/ai/generate-passphrase', { method: 'POST', body: JSON.stringify({ theme }) }),
  scanPage: (url: string) =>
    apiCall('/ai/scan-page', { method: 'POST', body: JSON.stringify({ url }) }),
  suggestAddresses: (query: string) =>
    apiCall('/ai/suggest-addresses', { method: 'POST', body: JSON.stringify({ query }) }),
};

export const breachApi = {
  checkPassword: (hash: string) =>
    apiCall('/breach/password', { method: 'POST', body: JSON.stringify({ hash }) }),
  checkEmail: (email: string) =>
    apiCall('/breach/email', { method: 'POST', body: JSON.stringify({ email }) }),
  checkUsername: (username: string) =>
    apiCall('/breach/username', { method: 'POST', body: JSON.stringify({ username }) }),
};

export const hunterApi = {
  verify: (email: string) =>
    apiCall('/hunter/verify', { method: 'POST', body: JSON.stringify({ email }) }),
};

export const backboardApi = {
  createAssistant: (data: any) =>
    apiCall('/backboard/assistants', { method: 'POST', body: JSON.stringify(data) }),
  createThread: (assistantId: string) =>
    apiCall(`/backboard/threads/${assistantId}`, { method: 'POST', body: JSON.stringify({}) }),
  sendMessage: (threadId: string, content: string) =>
    apiCall(`/backboard/messages/${threadId}`, { method: 'POST', body: JSON.stringify({ content }) }),
};
