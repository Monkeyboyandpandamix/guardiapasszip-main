import { VerificationResult, PageContent, AddressSuggestion, GroundingLink } from "../types";
import { aiApi } from "./api";
import { getOrCreateAssistant, getOrCreateThread, sendMessage as sendBackboardMessage } from "./backboardService";

const AI_TIMEOUT_MS = 1000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    promise
      .then((value) => {
        clearTimeout(id);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(id);
        reject(error);
      });
  });
}

async function askBackboard(prompt: string): Promise<string | null> {
  try {
    const assistantId = await getOrCreateAssistant();
    const threadId = await getOrCreateThread(assistantId);
    const response = await sendBackboardMessage(threadId, prompt);
    return response || null;
  } catch {
    return null;
  }
}

function inferThreatLevel(text: string): 'Low' | 'Medium' | 'High' {
  const normalized = text.replace(/\*\*/g, '').toLowerCase();

  const explicitLevel =
    normalized.match(/threat level\s*[:\-]\s*(low|medium|high)/i)?.[1] ||
    normalized.match(/\b(low|medium|high)\s+risk\b/i)?.[1];
  if (explicitLevel) {
    const value = explicitLevel.toLowerCase();
    if (value === 'high') return 'High';
    if (value === 'medium') return 'Medium';
    return 'Low';
  }

  if (/(official domain|generally safe|reputable|legitimate|safe to browse|no major red flags)/i.test(normalized)) {
    return 'Low';
  }

  if (/(critical|unsafe|phishing|credential theft|do not enter credentials|known malicious)/i.test(normalized)) return 'High';
  if (/(suspicious|caution|risky|unverified|mixed signals)/i.test(normalized)) return 'Medium';
  return 'Low';
}

function toFallbackVerification(url: string, responseText: string): VerificationResult {
  const lines = responseText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const summaryLine = lines.find((line) => /verdict/i.test(line)) || lines[0];
  const cleanSummary = (summaryLine || `Security assessment generated for ${url}.`)
    .replace(/^[-*]\s*/, '')
    .replace(/^\d+\)\s*/, '')
    .replace(/\*\*/g, '');

  const threatLevel = inferThreatLevel(responseText);
  const isSafe = threatLevel === 'Low';
  return {
    isSafe,
    threatLevel,
    summary: cleanSummary,
    details: lines.slice(1, 7).map((line) => line.replace(/^[-*]\s*/, '')) || [],
    certificateInfo: {
      issuer: 'Unknown',
      validUntil: 'Unknown',
      isTrusted: threatLevel === 'Low',
      protocol: 'Unknown',
    },
  };
}

const HOMOGLYPH_MAP: Record<string, string> = {
  '0': 'o', 'о': 'o', 'ο': 'o', 'ⲟ': 'o', 'ᴏ': 'o',
  '1': 'l', 'і': 'i', 'ⅰ': 'i', 'ɩ': 'i', 'ı': 'i',
  '3': 'e', 'є': 'e', 'ε': 'e', 'ᴇ': 'e',
  '4': 'a', 'а': 'a', 'ɑ': 'a', 'α': 'a',
  '5': 's', 'ѕ': 's', 'ꜱ': 's',
  '6': 'g', '9': 'g',
  '7': 't',
  '8': 'b',
  '@': 'a',
  'ⅱ': 'ii',
  'rn': 'm', 'vv': 'w', 'cl': 'd',
  'ɡ': 'g', 'ɢ': 'g',
  'ḅ': 'b', 'ƅ': 'b',
  'ⅼ': 'l',
  'ṅ': 'n', 'ñ': 'n',
  'ρ': 'p', 'р': 'p',
  'ⲥ': 'c', 'ϲ': 'c', 'с': 'c',
  'ᥙ': 'u', 'υ': 'u', 'ц': 'u',
  'ν': 'v',
  'х': 'x', 'ⅹ': 'x',
  'у': 'y', 'γ': 'y',
  'ᴢ': 'z',
};

const KNOWN_BRANDS: Record<string, string[]> = {
  'google': ['google.com', 'google.org', 'google.co', 'googleapis.com', 'googleusercontent.com', 'gstatic.com', 'googlesyndication.com', 'googleadservices.com', 'google.co.uk', 'google.ca', 'google.com.au', 'google.de', 'google.fr', 'google.co.jp', 'google.co.in'],
  'microsoft': ['microsoft.com', 'live.com', 'outlook.com', 'office.com', 'office365.com', 'windows.com', 'azure.com', 'microsoftonline.com', 'bing.com', 'msn.com', 'skype.com', 'xbox.com'],
  'apple': ['apple.com', 'icloud.com', 'apple.co'],
  'amazon': ['amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr', 'amazon.co.jp', 'amazonaws.com', 'aws.amazon.com', 'amzn.to', 'amzn.com'],
  'facebook': ['facebook.com', 'fb.com', 'fbcdn.net', 'fb.me', 'meta.com', 'instagram.com', 'whatsapp.com'],
  'paypal': ['paypal.com', 'paypal.me'],
  'netflix': ['netflix.com'],
  'twitter': ['twitter.com', 'x.com', 't.co', 'twimg.com'],
  'youtube': ['youtube.com', 'youtu.be', 'ytimg.com'],
  'linkedin': ['linkedin.com'],
  'github': ['github.com', 'github.io', 'githubusercontent.com'],
  'reddit': ['reddit.com', 'redd.it', 'redditstatic.com'],
  'wikipedia': ['wikipedia.org', 'wikimedia.org'],
  'spotify': ['spotify.com'],
  'dropbox': ['dropbox.com', 'dropboxusercontent.com'],
  'chase': ['chase.com', 'jpmorganchase.com'],
  'bankofamerica': ['bankofamerica.com', 'bofa.com'],
  'wellsfargo': ['wellsfargo.com'],
  'yahoo': ['yahoo.com', 'yahooapis.com'],
  'ebay': ['ebay.com'],
  'walmart': ['walmart.com'],
  'target': ['target.com'],
  'bestbuy': ['bestbuy.com'],
  'usps': ['usps.com'],
  'fedex': ['fedex.com'],
  'ups': ['ups.com'],
  'dhl': ['dhl.com'],
};

function normalizeHomoglyphs(str: string): string {
  let result = str.toLowerCase();
  const multiChar = [['rn', 'm'], ['vv', 'w'], ['cl', 'd']];
  for (const [from, to] of multiChar) {
    result = result.split(from).join(to);
  }
  let normalized = '';
  for (const char of result) {
    normalized += HOMOGLYPH_MAP[char] || char;
  }
  return normalized;
}

const MULTI_PART_TLDS = ['co.uk', 'co.jp', 'co.in', 'co.kr', 'co.nz', 'co.za', 'com.au', 'com.br', 'com.cn', 'com.mx', 'com.sg', 'com.tw', 'org.uk', 'net.au', 'ac.uk', 'gov.uk'];

function extractDomain(input: string): string {
  let cleaned = input.trim().toLowerCase();
  cleaned = cleaned.replace(/^(https?:\/\/)?(www\.)?/, '');
  cleaned = cleaned.split('/')[0].split('?')[0].split('#')[0];
  return cleaned;
}

function extractDomainBase(domain: string): string {
  for (const tld of MULTI_PART_TLDS) {
    if (domain.endsWith('.' + tld)) {
      const withoutTld = domain.slice(0, -(tld.length + 1));
      const parts = withoutTld.split('.');
      return parts[parts.length - 1];
    }
  }
  const parts = domain.split('.');
  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }
  return parts[0];
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

interface TyposquatResult {
  isTyposquat: boolean;
  targetBrand: string | null;
  confidence: number;
  reasons: string[];
}

function detectTyposquatting(rawUrl: string): TyposquatResult {
  const domain = extractDomain(rawUrl);
  const domainBase = extractDomainBase(domain);
  const normalizedDomain = normalizeHomoglyphs(domainBase);
  const reasons: string[] = [];
  let bestMatch: { brand: string; score: number } | null = null;

  for (const [brand, legitimateDomains] of Object.entries(KNOWN_BRANDS)) {
    if (legitimateDomains.some(ld => domain === ld || domain.endsWith('.' + ld))) {
      return { isTyposquat: false, targetBrand: null, confidence: 0, reasons: [] };
    }
  }

  for (const [brand] of Object.entries(KNOWN_BRANDS)) {
    const normalizedBrand = normalizeHomoglyphs(brand);

    if (normalizedDomain === normalizedBrand && domainBase !== brand) {
      reasons.push(`Homoglyph attack detected: "${domainBase}" normalizes to "${brand}"`);
      return { isTyposquat: true, targetBrand: brand, confidence: 98, reasons };
    }

    if (normalizedDomain.includes(normalizedBrand) && domainBase !== brand) {
      const hasSuspiciousSuffix = /-(login|secure|verify|account|support|update|alert|confirm|signin|auth|check|help|service|team|info|billing|payment|recovery|reset)/.test(domain);
      const hasSuspiciousPrefix = domain.startsWith(brand + '-') || domain.startsWith(brand + '.') && !KNOWN_BRANDS[brand]?.includes(domain);
      if (hasSuspiciousSuffix || hasSuspiciousPrefix) {
        reasons.push(`Brand impersonation: domain contains "${brand}" with suspicious modifier`);
        return { isTyposquat: true, targetBrand: brand, confidence: 90, reasons };
      }
    }

    const dist = levenshtein(domainBase, brand);
    if (dist > 0 && dist <= 2 && domainBase.length >= brand.length - 1) {
      const score = 95 - (dist * 15);
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { brand, score };
        reasons.push(`Typosquatting: "${domainBase}" is ${dist} edit(s) from "${brand}"`);
      }
    }

    if (domainBase !== brand && normalizedDomain !== normalizedBrand) {
      const stripped = domainBase.replace(/[^a-z]/g, '');
      const brandStripped = brand.replace(/[^a-z]/g, '');
      if (stripped === brandStripped && domainBase !== brand) {
        reasons.push(`Character insertion attack: "${domainBase}" contains disguised "${brand}"`);
        return { isTyposquat: true, targetBrand: brand, confidence: 92, reasons };
      }
    }
  }

  if (bestMatch && bestMatch.score >= 70) {
    return { isTyposquat: true, targetBrand: bestMatch.brand, confidence: bestMatch.score, reasons };
  }

  const suspiciousPatterns = [
    { pattern: /login|signin|verify|secure|account|update|confirm|auth/i, reason: 'Contains authentication-related keywords commonly used in phishing' },
    { pattern: /\d{3,}/, reason: 'Contains suspicious numeric sequences' },
    { pattern: /-{2,}|_{2,}/, reason: 'Contains suspicious repeated separators' },
    { pattern: /\.(tk|ml|ga|cf|gq|buzz|top|xyz|club|work|date|stream|download|click|link|racing|review|country|science|party|cricket|win|bid|trade|webcam|faith|accountant|loan|men)\b/, reason: 'Uses a TLD commonly associated with phishing campaigns' },
  ];

  for (const { pattern, reason } of suspiciousPatterns) {
    if (pattern.test(domain)) {
      reasons.push(reason);
    }
  }

  if (reasons.length >= 2) {
    return { isTyposquat: true, targetBrand: null, confidence: 65, reasons };
  }

  return { isTyposquat: false, targetBrand: null, confidence: 0, reasons };
}

export const verifyUrlSafety = async (url: string): Promise<VerificationResult> => {
  const typosquatCheck = detectTyposquatting(url);

  if (typosquatCheck.isTyposquat && typosquatCheck.confidence >= 80) {
    const brandWarning = typosquatCheck.targetBrand
      ? `This domain is impersonating "${typosquatCheck.targetBrand}".`
      : 'This domain exhibits multiple phishing characteristics.';

    return {
      isSafe: false,
      threatLevel: 'High',
      summary: `PHISHING ALERT: ${brandWarning} Our typosquatting detection engine flagged this with ${typosquatCheck.confidence}% confidence. DO NOT enter any credentials on this site.`,
      details: [
        ...typosquatCheck.reasons.map(r => `⚠ ${r}`),
        typosquatCheck.targetBrand ? `Legitimate domain: ${KNOWN_BRANDS[typosquatCheck.targetBrand]?.[0] || typosquatCheck.targetBrand + '.com'}` : '',
        `Detection confidence: ${typosquatCheck.confidence}%`,
        'This is a known phishing technique designed to steal your credentials',
      ].filter(Boolean),
      certificateInfo: { issuer: 'UNTRUSTED', validUntil: 'N/A', isTrusted: false, protocol: 'SUSPECT' },
    };
  }

  const typosquatContext = typosquatCheck.reasons.length > 0
    ? `\n\nPRE-ANALYSIS WARNING: Our local typosquatting detector found these concerns: ${typosquatCheck.reasons.join('; ')}. Factor this into your analysis.`
    : '';

  try {
    const result = await withTimeout(aiApi.verifyUrl(url, typosquatContext), AI_TIMEOUT_MS, 'verify-url');
    return result as VerificationResult;
  } catch {
    const fallbackPrompt = `Perform a fast security verdict for URL: ${url}.
Give:
1) One-line verdict
2) Threat level (LOW/MEDIUM/HIGH)
3) 3-5 concise risk indicators.
If unsure, be conservative and explain uncertainty.`;
    const fallbackText = await askBackboard(fallbackPrompt);
    if (fallbackText) {
      return toFallbackVerification(url, fallbackText);
    }
    throw new Error('URL verification unavailable from both primary and fallback AI providers.');
  }
};

export const askPageQuestion = async (page: PageContent, question: string, history: { role: 'user' | 'model', text: string }[]): Promise<string> => {
  const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  const safeQuestion = question.trim().slice(0, 1200);
  const pageSummary = [
    `URL: ${page.url}`,
    `Title: ${page.title}`,
    page.description ? `Description: ${page.description}` : '',
    Array.isArray(page.headings) && page.headings.length > 0 ? `Headings: ${page.headings.slice(0, 8).join(' | ')}` : '',
    `Page content: ${page.text.substring(0, 3000)}`,
  ].filter(Boolean).join('\n');

  contents.push({ role: 'user', parts: [{ text: `I'm currently viewing this webpage.\n${pageSummary}` }] });
  contents.push({ role: 'model', parts: [{ text: `I can see you're on ${page.title} (${page.url}). I'm ready to answer any questions about this page.` }] });
  for (const h of history) {
    contents.push({ role: h.role, parts: [{ text: h.text }] });
  }
  contents.push({ role: 'user', parts: [{ text: safeQuestion }] });

  try {
    const result = await withTimeout(
      aiApi.chat(contents, "You are the Neural Scout AI assistant integrated into the GuardiaPass browser extension. Answer questions about the current website the user is viewing. Be helpful, concise, and informative."),
      AI_TIMEOUT_MS,
      'page-chat'
    );
    return result.text || "I couldn't generate a response. Please try again.";
  } catch {
    const fallbackPrompt = `You are a web safety assistant. The user is viewing:
URL: ${page.url}
Title: ${page.title}
Description: ${page.description || 'N/A'}
Headings: ${Array.isArray(page.headings) ? page.headings.join(' | ') : 'N/A'}
Page content excerpt: ${page.text.substring(0, 2500)}

Question: ${safeQuestion}

Answer concisely and include concrete safety guidance if relevant.`;
    const fallback = await askBackboard(fallbackPrompt);
    return fallback || "I couldn't generate a response right now. Please try again.";
  }
};

export const analyzePasswordStrength = async (password: string) => {
  return aiApi.analyzePassword(password);
};

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{}?';

function randomChar(chars: string): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return chars[bytes[0] % chars.length];
}

export function generateLocalStrongPassword(length = 18): string {
  const safeLength = Math.max(12, Math.min(48, length));
  const all = UPPER + LOWER + DIGITS + SYMBOLS;
  const chars: string[] = [
    randomChar(UPPER),
    randomChar(LOWER),
    randomChar(DIGITS),
    randomChar(SYMBOLS),
  ];
  while (chars.length < safeLength) {
    chars.push(randomChar(all));
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export const generateNeuralPassphrase = async (theme: string) => {
  try {
    const result = await aiApi.generatePassphrase(theme);
    const candidate = String(result?.password || '').trim();
    if (candidate.length >= 12 && /[A-Z]/.test(candidate) && /[a-z]/.test(candidate) && /\d/.test(candidate)) {
      return candidate;
    }
  } catch {
    // Fall back to local strong password generator when AI is unavailable.
  }
  return generateLocalStrongPassword(18);
};

export interface WebPageScanResult {
  title: string;
  summary: string;
  securityNotes: string[];
}

export const scanWebPage = async (url: string): Promise<WebPageScanResult> => {
  return aiApi.scanPage(url);
};

export const suggestAddresses = async (query: string) => {
  const normalized = String(query || '').trim();
  if (normalized.length < 3) return [];
  const fallbackSuggestions = () => {
    const curated = [
      '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
      '1 Apple Park Way, Cupertino, CA 95014, USA',
      '1 Microsoft Way, Redmond, WA 98052, USA',
      '1455 Market St, San Francisco, CA 94103, USA',
      '111 8th Ave, New York, NY 10011, USA',
      '350 5th Ave, New York, NY 10118, USA',
      '500 S Buena Vista St, Burbank, CA 91521, USA',
      '1200 Getty Center Dr, Los Angeles, CA 90049, USA',
      '233 S Wacker Dr, Chicago, IL 60606, USA',
      '600 Congress Ave, Austin, TX 78701, USA',
      '401 Terry Ave N, Seattle, WA 98109, USA',
      '151 3rd St, San Francisco, CA 94103, USA',
    ];
    const q = normalized.toLowerCase().replace(/\s+/g, ' ').trim();
    const tokens = q.split(' ').filter(Boolean);
    const score = (candidate: string) => {
      const c = candidate.toLowerCase();
      let points = 0;
      if (c.startsWith(q)) points += 6;
      if (c.includes(q)) points += 4;
      for (const t of tokens) {
        if (c.includes(t)) points += 1;
      }
      return points;
    };
    const matched = curated
      .map((address) => ({ address, s: score(address) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 5)
      .map((x) => ({ address: x.address }));

    if (matched.length > 0) return matched;

    // If nothing matches, provide structured examples based on user input.
    const compact = normalized.replace(/\s{2,}/g, ' ').trim();
    return [
      { address: `${compact}, CA, USA` },
      { address: `${compact}, NY, USA` },
      { address: `${compact}, TX, USA` },
    ];
  };

  try {
    const results = await aiApi.suggestAddresses(normalized);
    if (Array.isArray(results) && results.length > 0) {
      const deduped = results
        .filter((r) => r && typeof r.address === 'string' && r.address.trim().length > 0)
        .map((r) => ({ address: r.address.trim(), sources: r.sources }))
        .filter((r, idx, arr) => arr.findIndex((x) => x.address.toLowerCase() === r.address.toLowerCase()) === idx)
        .slice(0, 5);
      if (deduped.length > 0) return deduped;
    }
  } catch {
    // Use local fallback suggestions.
  }
  return fallbackSuggestions();
};
