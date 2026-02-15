import { demoMode } from './demoMode';

const API_BASE = '/api';

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
  getPasswords: (userEmail: string) => demoMode.isActive ? Promise.resolve([]) : apiCall(`/vault/passwords/${encodeURIComponent(userEmail)}`),
  savePassword: (data: any) => demoMode.isActive ? demoNoop() : apiCall('/vault/passwords', { method: 'POST', body: JSON.stringify(data) }),
  updatePassword: (id: string, data: any) => demoMode.isActive ? demoNoop() : apiCall(`/vault/passwords/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePassword: (id: string) => demoMode.isActive ? demoNoop() : apiCall(`/vault/passwords/${id}`, { method: 'DELETE' }),
  getIdentities: (userEmail: string) => demoMode.isActive ? Promise.resolve([]) : apiCall(`/vault/identities/${encodeURIComponent(userEmail)}`),
  saveIdentity: (data: any) => demoMode.isActive ? demoNoop() : apiCall('/vault/identities', { method: 'POST', body: JSON.stringify(data) }),
  deleteIdentity: (id: string) => demoMode.isActive ? demoNoop() : apiCall(`/vault/identities/${id}`, { method: 'DELETE' }),
};

export const visitsApi = {
  getVisits: (userEmail: string) => demoMode.isActive ? Promise.resolve([]) : apiCall(`/visits/${encodeURIComponent(userEmail)}`),
  saveVisit: (data: any) => demoMode.isActive ? demoNoop() : apiCall('/visits', { method: 'POST', body: JSON.stringify(data) }),
  saveBatch: (visits: any[], userEmail: string) => demoMode.isActive ? demoNoop() : apiCall('/visits/batch', { method: 'POST', body: JSON.stringify({ visits, userEmail }) }),
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
