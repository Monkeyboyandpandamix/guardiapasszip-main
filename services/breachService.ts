import { breachApi } from './api';

export interface BreachResult {
  found: boolean;
  count: number;
  breaches: { name: string; date: string; description: string }[];
  summary: string;
}

export interface PasswordBreachResult {
  found: boolean;
  count: number;
}

async function sha1Hash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export const checkPasswordBreach = async (password: string): Promise<PasswordBreachResult> => {
  const hash = await sha1Hash(password);
  return breachApi.checkPassword(hash);
};

export const checkEmailBreach = async (email: string): Promise<BreachResult> => {
  return breachApi.checkEmail(email);
};

export const checkUsernameBreach = async (username: string): Promise<BreachResult> => {
  return breachApi.checkUsername(username);
};
