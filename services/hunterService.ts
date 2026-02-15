import { hunterApi } from './api';

export interface HunterVerificationResult {
  email: string;
  status: 'valid' | 'invalid' | 'risky' | 'accept_all' | 'unknown';
  score: number;
  disposable: boolean;
  gibberish: boolean;
  webmail: boolean;
  mx_records: boolean;
  smtp_server: boolean;
  smtp_check: boolean;
  accept_all: boolean;
  block: boolean;
}

const verificationCache = new Map<string, HunterVerificationResult>();

export const verifyEmail = async (email: string): Promise<HunterVerificationResult> => {
  if (verificationCache.has(email)) {
    return verificationCache.get(email)!;
  }

  const result = await hunterApi.verify(email) as HunterVerificationResult;
  verificationCache.set(email, result);
  return result;
};
