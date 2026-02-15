import { backboardApi } from './api';

const STORAGE_KEYS = {
  assistantId: 'gp_bb_assistant_id',
  threadId: 'gp_bb_thread_id',
};

const SYSTEM_PROMPT = `You are GuardiaPass AI Security Advisor — an elite cybersecurity expert embedded inside the GuardiaPass security dashboard. Your role is to help users stay safe online.

Your capabilities:
- Analyze URLs, domains, and emails for phishing and fraud indicators
- Explain security concepts in simple, clear language
- Provide actionable advice on password hygiene, 2FA, VPNs, and encryption
- Help users understand data breach notifications and what steps to take
- Assess the security posture of websites and services
- Guide users through security incident response
- Educate about social engineering, malware, and network threats

Guidelines:
- Be concise but thorough. Use bullet points for clarity.
- Flag genuine threats with clear severity levels (LOW / MEDIUM / HIGH / CRITICAL)
- Never ask users to share actual passwords or sensitive credentials
- Remember context from previous conversations to provide personalized advice
- If you detect a pattern of risky behavior, proactively warn the user
- Reference real-world security frameworks (NIST, OWASP) when relevant
- Stay up to date with current threat landscape and attack vectors`;

export async function getOrCreateAssistant(): Promise<string> {
  const stored = localStorage.getItem(STORAGE_KEYS.assistantId);
  if (stored) return stored;

  const data = await backboardApi.createAssistant({
    name: 'GuardiaPass Security Advisor',
    system_prompt: SYSTEM_PROMPT,
  });

  const id = data.assistant_id;
  localStorage.setItem(STORAGE_KEYS.assistantId, id);
  return id;
}

export async function getOrCreateThread(assistantId: string): Promise<string> {
  const stored = localStorage.getItem(STORAGE_KEYS.threadId);
  if (stored) return stored;

  const data = await backboardApi.createThread(assistantId);
  const id = data.thread_id;
  localStorage.setItem(STORAGE_KEYS.threadId, id);
  return id;
}

export async function sendMessage(threadId: string, content: string): Promise<string> {
  const data = await backboardApi.sendMessage(threadId, content);
  return data.content || data.message || 'No response received.';
}

export async function startNewThread(): Promise<string> {
  const assistantId = await getOrCreateAssistant();
  localStorage.removeItem(STORAGE_KEYS.threadId);
  return getOrCreateThread(assistantId);
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEYS.assistantId);
  localStorage.removeItem(STORAGE_KEYS.threadId);
}

export function isConfigured(): boolean {
  return true;
}
