import express from 'express';
import pg from 'pg';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line
      .slice(idx + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadDotEnvFile(path.join(projectRoot, '.env'));
loadDotEnvFile(path.join(projectRoot, '.env.local'));

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5000',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'https://guardiapass.replit.app',
];
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);
const CORS_ALLOWLIST = new Set(ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : DEFAULT_ALLOWED_ORIGINS);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
});

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (CORS_ALLOWLIST.has(origin)) return callback(null, true);
    callback(new Error('CORS origin denied'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: false,
}));

let pool = null;
let dbAvailable = false;
const rateWindowMs = 60_000;
const rateState = new Map();

if (process.env.DATABASE_URL) {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

const GEMINI_API_KEY = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const GEMINI_BASE_URL = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || undefined;
const HUNTER_API_KEY = process.env.HUNTER_API_KEY || '';
const BACKBOARD_API_KEY = process.env.BACKBOARD_API_KEY || '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
const NVD_API_KEY = process.env.NVD_API_KEY || '';
const CYBER_INTEL_CACHE_MS = Number(process.env.CYBER_INTEL_CACHE_MS || 6 * 60 * 60 * 1000);
const CYBER_INTEL_EMPTY_CACHE_MS = Number(process.env.CYBER_INTEL_EMPTY_CACHE_MS || 15 * 60 * 1000);
let aiFactoryOverride = null;
let fetchImplOverride = null;
const cyberIntelCache = {
  updatedAt: 0,
  data: null,
};
const CYBER_INTEL_HEADERS = {
  'User-Agent': 'GuardiaPass/1.0 (+local app)',
  'Accept': 'application/json,text/csv,*/*',
};
const EMERGENCY_CVE_FALLBACK = [
  {
    cveId: 'CVE-2024-4577',
    published: '2024-06-07T00:00:00.000Z',
    lastModified: null,
    description: 'PHP-CGI argument injection vulnerability (emergency fallback entry).',
    severity: 'HIGH',
    score: 9.8,
    vector: '',
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2024-4577'],
    exploitedInWild: true,
    kev: null,
  },
];

export function __setAIFactoryForTests(factory) {
  aiFactoryOverride = factory;
}

export function __setFetchForTests(fetchImpl) {
  fetchImplOverride = fetchImpl;
}

const KNOWN_DOMAIN_BREACHES = {
  'linkedin.com': [
    {
      name: 'LinkedIn Scraped Data',
      date: '2021',
      description: 'Publicly reported large-scale scraping exposure affecting LinkedIn profile/account data.',
    },
    {
      name: 'LinkedIn Breach',
      date: '2012',
      description: 'Historic credential exposure involving LinkedIn account data and password hashes.',
    },
  ],
  'yahoo.com': [
    {
      name: 'Yahoo Account Breach',
      date: '2013-2014',
      description: 'Publicly disclosed large-scale Yahoo account incidents affecting user data.',
    },
  ],
  'adobe.com': [
    {
      name: 'Adobe Breach',
      date: '2013',
      description: 'Publicly reported Adobe breach affecting user account records.',
    },
  ],
  'dropbox.com': [
    {
      name: 'Dropbox Breach',
      date: '2012',
      description: 'Publicly disclosed credential-related breach affecting Dropbox users.',
    },
  ],
  'canva.com': [
    {
      name: 'Canva Breach',
      date: '2019',
      description: 'Publicly reported incident impacting Canva user accounts and profile data.',
    },
  ],
  'myfitnesspal.com': [
    {
      name: 'MyFitnessPal Breach',
      date: '2018',
      description: 'Publicly disclosed incident involving MyFitnessPal account data exposure.',
    },
  ],
};

function safeParseJson(text, fallback = {}) {
  if (!text || typeof text !== 'string') return fallback;
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return fallback;
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(email));
}

function normalizeUsername(username) {
  return String(username || '').trim();
}

function isValidUsername(username) {
  return /^[a-zA-Z0-9._@-]{3,50}$/.test(username);
}

function normalizeBreachPayload(result) {
  const breaches = Array.isArray(result?.breaches)
    ? result.breaches
        .filter((b) => b && typeof b === 'object')
        .map((b) => ({
          name: String(b.name || '').trim(),
          date: String(b.date || '').trim(),
          description: String(b.description || '').trim(),
        }))
        .filter((b) => b.name && b.description)
    : [];

  const merged = new Map();
  for (const b of breaches) {
    const key = b.name.toLowerCase();
    if (!merged.has(key)) merged.set(key, b);
  }

  const normalizedBreaches = [...merged.values()];
  const found = Boolean(result?.found) || normalizedBreaches.length > 0;
  const count = normalizedBreaches.length;
  const summary = String(result?.summary || '').trim();

  return {
    found,
    count,
    breaches: normalizedBreaches,
    summary: summary || (found ? 'Potential exposure indicators found in public breach intelligence.' : 'No reliable public breach indicators found for this query.'),
  };
}

function applyRateLimit(key, limit) {
  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const bucketKey = `${key}:${ip}`;
    const bucket = rateState.get(bucketKey) || { count: 0, resetAt: now + rateWindowMs };
    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + rateWindowMs;
    }
    bucket.count += 1;
    rateState.set(bucketKey, bucket);
    if (bucket.count > limit) {
      return res.status(429).json({ error: 'Too many requests. Please retry shortly.' });
    }
    return next();
  };
}

function getKnownDomainBreaches(domain) {
  const lookup = domain.toLowerCase();
  const direct = KNOWN_DOMAIN_BREACHES[lookup] || [];
  if (direct.length > 0) return direct;
  const parts = lookup.split('.');
  if (parts.length > 2) {
    const apex = parts.slice(-2).join('.');
    return KNOWN_DOMAIN_BREACHES[apex] || [];
  }
  return [];
}

async function initDB() {
  if (!pool) {
    console.log('[DB] No DATABASE_URL set — running without database (vault data will not persist)');
    return;
  }
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS vault_passwords (
          id TEXT PRIMARY KEY,
          user_email TEXT NOT NULL,
          name TEXT NOT NULL,
          url TEXT DEFAULT '',
          username TEXT DEFAULT '',
          password_cipher TEXT DEFAULT '',
          category TEXT DEFAULT 'Other',
          last_modified BIGINT DEFAULT 0,
          is_encrypted BOOLEAN DEFAULT true,
          security_analysis JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS vault_identities (
          id TEXT PRIMARY KEY,
          user_email TEXT NOT NULL,
          label TEXT NOT NULL,
          first_name TEXT DEFAULT '',
          last_name TEXT DEFAULT '',
          email TEXT DEFAULT '',
          password_cipher TEXT DEFAULT '',
          phone TEXT DEFAULT '',
          address TEXT DEFAULT '',
          city TEXT DEFAULT '',
          state TEXT DEFAULT '',
          zip_code TEXT DEFAULT '',
          country TEXT DEFAULT '',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        ALTER TABLE vault_identities
        ADD COLUMN IF NOT EXISTS password_cipher TEXT DEFAULT '';

        CREATE TABLE IF NOT EXISTS visits (
          id TEXT PRIMARY KEY,
          user_email TEXT NOT NULL,
          url TEXT NOT NULL,
          timestamp BIGINT NOT NULL,
          is_threat BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_passwords_user ON vault_passwords(user_email);
        CREATE INDEX IF NOT EXISTS idx_identities_user ON vault_identities(user_email);
        CREATE INDEX IF NOT EXISTS idx_visits_user ON visits(user_email);
      `);
      dbAvailable = true;
      console.log('[DB] Tables initialized');
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('[DB] Connection failed — running without database (vault data will not persist):', err.message);
  }
}

app.get('/api/health', async (req, res) => {
  if (!dbAvailable) {
    return res.json({ status: 'ok', db: 'unavailable', message: 'Running without database' });
  }
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', db: 'connected', time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/status', (req, res) => {
  res.json({
    gemini: !!GEMINI_API_KEY,
    hunter: !!HUNTER_API_KEY,
    backboard: !!BACKBOARD_API_KEY,
    elevenlabs: !!ELEVENLABS_API_KEY,
    database: dbAvailable,
  });
});

app.get('/api/vault/passwords/:userEmail', async (req, res) => {
  if (!dbAvailable) return res.json([]);
  try {
    const { rows } = await pool.query(
      'SELECT * FROM vault_passwords WHERE user_email = $1 ORDER BY last_modified DESC',
      [req.params.userEmail]
    );
    const passwords = rows.map(r => ({
      id: r.id,
      name: r.name,
      url: r.url,
      username: r.username,
      password: r.password_cipher,
      category: r.category,
      lastModified: Number(r.last_modified),
      isEncrypted: r.is_encrypted,
      ownerEmail: r.user_email,
      securityAnalysis: r.security_analysis,
    }));
    res.json(passwords);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vault/passwords', async (req, res) => {
  if (!dbAvailable) return res.json({ success: true, persisted: false });
  try {
    const { id, userEmail, name, url, username, password, category, lastModified, isEncrypted, securityAnalysis } = req.body;
    await pool.query(
      `INSERT INTO vault_passwords (id, user_email, name, url, username, password_cipher, category, last_modified, is_encrypted, security_analysis)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET name=$3, url=$4, username=$5, password_cipher=$6, category=$7, last_modified=$8, is_encrypted=$9, security_analysis=$10`,
      [id, userEmail, name, url || '', username || '', password || '', category || 'Other', lastModified || Date.now(), isEncrypted !== false, securityAnalysis ? JSON.stringify(securityAnalysis) : null]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/vault/passwords/:id', async (req, res) => {
  if (!dbAvailable) return res.json({ success: true, persisted: false });
  try {
    const { securityAnalysis } = req.body;
    if (securityAnalysis !== undefined) {
      await pool.query(
        'UPDATE vault_passwords SET security_analysis = $1 WHERE id = $2',
        [JSON.stringify(securityAnalysis), req.params.id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/vault/passwords/:id', async (req, res) => {
  if (!dbAvailable) return res.json({ success: true, persisted: false });
  try {
    await pool.query('DELETE FROM vault_passwords WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/vault/identities/:userEmail', async (req, res) => {
  if (!dbAvailable) return res.json([]);
  try {
    const { rows } = await pool.query(
      'SELECT * FROM vault_identities WHERE user_email = $1 ORDER BY created_at DESC',
      [req.params.userEmail]
    );
    const identities = rows.map(r => ({
      id: r.id,
      label: r.label,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      password: r.password_cipher || '',
      phone: r.phone,
      address: r.address,
      city: r.city,
      state: r.state,
      zipCode: r.zip_code,
      country: r.country,
    }));
    res.json(identities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vault/identities', async (req, res) => {
  if (!dbAvailable) return res.json({ success: true, persisted: false });
  try {
    const { id, userEmail, label, firstName, lastName, email, password, phone, address, city, state, zipCode, country } = req.body;
    await pool.query(
      `INSERT INTO vault_identities (id, user_email, label, first_name, last_name, email, password_cipher, phone, address, city, state, zip_code, country)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO UPDATE SET label=$3, first_name=$4, last_name=$5, email=$6, password_cipher=$7, phone=$8, address=$9, city=$10, state=$11, zip_code=$12, country=$13`,
      [id, userEmail, label, firstName || '', lastName || '', email || '', password || '', phone || '', address || '', city || '', state || '', zipCode || '', country || '']
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/vault/identities/:id', async (req, res) => {
  if (!dbAvailable) return res.json({ success: true, persisted: false });
  try {
    await pool.query('DELETE FROM vault_identities WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/visits/:userEmail', async (req, res) => {
  if (!dbAvailable) return res.json([]);
  try {
    const { rows } = await pool.query(
      'SELECT * FROM visits WHERE user_email = $1 ORDER BY timestamp DESC LIMIT 200',
      [req.params.userEmail]
    );
    const visits = rows.map(r => ({
      id: r.id,
      url: r.url,
      timestamp: Number(r.timestamp),
      isThreat: r.is_threat,
    }));
    res.json(visits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/visits', async (req, res) => {
  if (!dbAvailable) return res.json({ success: true, persisted: false });
  try {
    const { id, userEmail, url, timestamp, isThreat } = req.body;
    await pool.query(
      `INSERT INTO visits (id, user_email, url, timestamp, is_threat) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      [id, userEmail, url, timestamp || Date.now(), isThreat || false]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/visits/batch', async (req, res) => {
  if (!dbAvailable) return res.json({ success: true, persisted: false });
  try {
    const { visits, userEmail } = req.body;
    for (const v of visits) {
      await pool.query(
        `INSERT INTO visits (id, user_email, url, timestamp, is_threat) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [v.id, userEmail, v.url, v.timestamp, v.isThreat || false]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const GEMINI_MODEL = 'gemini-2.5-flash';

async function getGemini() {
  if (aiFactoryOverride) {
    return aiFactoryOverride();
  }
  const { GoogleGenAI, Type } = await import('@google/genai');
  const opts = { apiKey: GEMINI_API_KEY };
  if (GEMINI_BASE_URL) {
    opts.httpOptions = { apiVersion: '', baseUrl: GEMINI_BASE_URL };
  }
  return { ai: new GoogleGenAI(opts), Type };
}

function getFetchImpl() {
  return fetchImplOverride || globalThis.fetch;
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 4500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await getFetchImpl()(url, {
      ...options,
      headers: { ...CYBER_INTEL_HEADERS, ...(options.headers || {}) },
      signal: controller.signal
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Request failed (${response.status})${text ? `: ${text.slice(0, 180)}` : ''}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTextWithTimeout(url, options = {}, timeoutMs = 4500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await getFetchImpl()(url, {
      ...options,
      headers: { ...CYBER_INTEL_HEADERS, ...(options.headers || {}) },
      signal: controller.signal
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Request failed (${response.status})${text ? `: ${text.slice(0, 180)}` : ''}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function pickBestCvss(cve) {
  const metrics = cve?.metrics || {};
  const all = [
    ...(Array.isArray(metrics.cvssMetricV40) ? metrics.cvssMetricV40 : []),
    ...(Array.isArray(metrics.cvssMetricV31) ? metrics.cvssMetricV31 : []),
    ...(Array.isArray(metrics.cvssMetricV30) ? metrics.cvssMetricV30 : []),
    ...(Array.isArray(metrics.cvssMetricV2) ? metrics.cvssMetricV2 : []),
  ];
  const chosen = all[0];
  if (!chosen) return { score: null, severity: 'UNKNOWN', vector: '' };
  const data = chosen.cvssData || {};
  return {
    score: typeof data.baseScore === 'number' ? data.baseScore : null,
    severity: String(data.baseSeverity || chosen.baseSeverity || 'UNKNOWN'),
    vector: String(data.vectorString || ''),
  };
}

async function fetchNvdByWindow(windowHours) {
  const now = new Date();
  const start = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
  const nvdUrl = new URL('https://services.nvd.nist.gov/rest/json/cves/2.0');
  nvdUrl.searchParams.set('pubStartDate', start.toISOString());
  nvdUrl.searchParams.set('pubEndDate', now.toISOString());
  nvdUrl.searchParams.set('resultsPerPage', '80');
  nvdUrl.searchParams.set('startIndex', '0');
  const nvdHeaders = NVD_API_KEY ? { apiKey: NVD_API_KEY } : undefined;
  return fetchJsonWithTimeout(nvdUrl.toString(), { headers: nvdHeaders });
}

async function fetchNvdLatest() {
  const nvdUrl = new URL('https://services.nvd.nist.gov/rest/json/cves/2.0');
  nvdUrl.searchParams.set('resultsPerPage', '80');
  nvdUrl.searchParams.set('startIndex', '0');
  const nvdHeaders = NVD_API_KEY ? { apiKey: NVD_API_KEY } : undefined;
  return fetchJsonWithTimeout(nvdUrl.toString(), { headers: nvdHeaders });
}

function splitCsvLine(line) {
  const out = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cell);
      cell = '';
      continue;
    }
    cell += ch;
  }
  out.push(cell);
  return out.map((v) => v.replace(/^\uFEFF/, '').trim());
}

async function fetchCirclLatest() {
  const payload = await fetchJsonWithTimeout('https://cve.circl.lu/api/last/30');
  const rows = Array.isArray(payload) ? payload : [];
  return rows.map((r) => ({
    cveId: String(r?.id || '').toUpperCase(),
    published: r?.Published || r?.published || null,
    lastModified: r?.Modified || r?.last_modified || null,
    description: String(r?.summary || r?.description || 'No description available.'),
    severity: String(r?.cvss3 ? (r.cvss3 >= 9 ? 'CRITICAL' : r.cvss3 >= 7 ? 'HIGH' : r.cvss3 >= 4 ? 'MEDIUM' : 'LOW') : (r?.cvss ? (r.cvss >= 7 ? 'HIGH' : 'MEDIUM') : 'UNKNOWN')),
    score: typeof r?.cvss3 === 'number' ? r.cvss3 : (typeof r?.cvss === 'number' ? r.cvss : null),
    vector: '',
    references: Array.isArray(r?.references) ? r.references.slice(0, 3) : [],
    exploitedInWild: false,
    kev: null,
  })).filter((x) => x.cveId);
}

async function fetchKevCatalog() {
  try {
    return await fetchJsonWithTimeout('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json');
  } catch (firstErr) {
    const csvText = await fetchTextWithTimeout('https://www.cisa.gov/sites/default/files/csv/known_exploited_vulnerabilities.csv').catch(() => null);
    if (!csvText) throw firstErr;
    const lines = csvText.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) throw firstErr;
    const header = splitCsvLine(lines[0]).map((h) => h.replace(/^"|"$/g, '').trim().replace(/^\uFEFF/, ''));
    const idx = (name) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    const cveIdx = idx('cveID');
    const vendorIdx = idx('vendorProject');
    const productIdx = idx('product');
    const vulnIdx = idx('vulnerabilityName');
    const dateIdx = idx('dateAdded');
    const ransomIdx = idx('knownRansomwareCampaignUse');
    const descIdx = idx('shortDescription');
    if (cveIdx < 0) throw firstErr;
    const rows = lines.slice(1).map((line) => {
      const cols = splitCsvLine(line).map((v) => v.replace(/^"|"$/g, '').trim());
      return {
        cveID: cols[cveIdx] || '',
        vendorProject: cols[vendorIdx] || '',
        product: cols[productIdx] || '',
        vulnerabilityName: cols[vulnIdx] || '',
        dateAdded: cols[dateIdx] || '',
        knownRansomwareCampaignUse: cols[ransomIdx] || '',
        shortDescription: cols[descIdx] || '',
      };
    }).filter((r) => r.cveID);
    return { vulnerabilities: rows };
  }
}

async function fetchCyberIntel(windowHours = 336) {
  const nvdHeaders = NVD_API_KEY ? { apiKey: NVD_API_KEY } : undefined;
  void nvdHeaders;
  const [nvdResult, kevResult] = await Promise.allSettled([
    fetchNvdByWindow(windowHours),
    fetchKevCatalog(),
  ]);

  let nvdPayload = nvdResult.status === 'fulfilled' ? nvdResult.value : null;
  const kevPayload = kevResult.status === 'fulfilled' ? kevResult.value : { vulnerabilities: [] };
  const kevList = Array.isArray(kevPayload?.vulnerabilities) ? kevPayload.vulnerabilities : [];

  const firstNvdRows = Array.isArray(nvdPayload?.vulnerabilities) ? nvdPayload.vulnerabilities : [];
  if (firstNvdRows.length === 0 && kevList.length === 0) {
    try {
      const latest = await fetchNvdLatest();
      const latestRows = Array.isArray(latest?.vulnerabilities) ? latest.vulnerabilities : [];
      if (latestRows.length > 0) nvdPayload = latest;
    } catch (e) {
      // keep original payload/error state and continue with KEV-only if possible
    }
  }

  let circlRows = [];
  let circlError = null;
  if (!nvdPayload && kevList.length === 0) {
    try {
      circlRows = await fetchCirclLatest();
    } catch (e) {
      circlError = e;
    }
  }

  if (!nvdPayload && kevList.length === 0 && circlRows.length === 0) {
    throw new Error(`NVD failed (${nvdResult.reason?.message || 'unknown'}); KEV failed (${kevResult.reason?.message || 'unknown'}); CIRCL failed (${circlError?.message || 'unknown'})`);
  }
  const kevByCve = new Map();
  for (const item of kevList) {
    const cveId = String(item?.cveID || '').trim().toUpperCase();
    if (!cveId) continue;
    kevByCve.set(cveId, item);
  }

  const nvdRows = Array.isArray(nvdPayload?.vulnerabilities) ? nvdPayload.vulnerabilities : [];
  const cves = nvdRows
    .map((row) => {
      const cve = row?.cve || {};
      const cveId = String(cve.id || '').trim().toUpperCase();
      if (!cveId) return null;
      const description = (Array.isArray(cve.descriptions) ? cve.descriptions : [])
        .find((d) => d?.lang === 'en')?.value || 'No description available.';
      const refs = (Array.isArray(cve.references) ? cve.references : []).map((r) => r?.url).filter(Boolean);
      const cvss = pickBestCvss(cve);
      const kevMatch = kevByCve.get(cveId);
      return {
        cveId,
        published: cve.published || null,
        lastModified: cve.lastModified || null,
        description: String(description).replace(/\s+/g, ' ').trim(),
        severity: cvss.severity,
        score: cvss.score,
        vector: cvss.vector,
        references: refs.slice(0, 3),
        exploitedInWild: Boolean(kevMatch),
        kev: kevMatch
          ? {
              vendorProject: kevMatch.vendorProject || '',
              product: kevMatch.product || '',
              vulnerabilityName: kevMatch.vulnerabilityName || '',
              dateAdded: kevMatch.dateAdded || '',
              knownRansomwareCampaignUse: kevMatch.knownRansomwareCampaignUse || '',
            }
          : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.published || 0).getTime() - new Date(a.published || 0).getTime());

  const kevOnly = kevList
    .map((item) => {
      const cveId = String(item?.cveID || '').trim().toUpperCase();
      if (!cveId || cves.some((c) => c.cveId === cveId)) return null;
      return {
        cveId,
        published: null,
        lastModified: null,
        description: String(item?.shortDescription || item?.vulnerabilityName || 'Known exploited vulnerability'),
        severity: 'KNOWN-EXPLOITED',
        score: null,
        vector: '',
        references: [],
        exploitedInWild: true,
        kev: {
          vendorProject: item.vendorProject || '',
          product: item.product || '',
          vulnerabilityName: item.vulnerabilityName || '',
          dateAdded: item.dateAdded || '',
          knownRansomwareCampaignUse: item.knownRansomwareCampaignUse || '',
        },
      };
    })
    .filter(Boolean)
    .slice(0, 20);

  const mergedRows = [...cves.slice(0, 40), ...kevOnly];
  const finalRows = mergedRows.length > 0 ? mergedRows : circlRows.slice(0, 30);
  const withEmergencyFallback = finalRows.length > 0 ? finalRows : EMERGENCY_CVE_FALLBACK;

  return {
    updatedAt: Date.now(),
    sourceWindowHours: windowHours,
    cves: withEmergencyFallback,
    totalNvdItems: nvdRows.length,
    totalKevItems: kevList.length,
    sourceStatus: {
      nvd: nvdResult.status === 'fulfilled' ? 'ok' : 'degraded',
      kev: kevResult.status === 'fulfilled' ? 'ok' : 'degraded',
      circl: circlRows.length > 0 ? 'ok' : 'degraded',
    },
    sourceErrors: {
      nvd: nvdResult.status === 'rejected' ? String(nvdResult.reason?.message || 'failed') : null,
      kev: kevResult.status === 'rejected' ? String(kevResult.reason?.message || 'failed') : null,
      circl: circlError ? String(circlError.message || 'failed') : null,
    },
  };
}

function buildEmergencyIntelPayload(message, windowHours = 336) {
  return {
    updatedAt: Date.now(),
    sourceWindowHours: windowHours,
    cves: EMERGENCY_CVE_FALLBACK,
    totalNvdItems: 0,
    totalKevItems: 0,
    sourceStatus: { nvd: 'degraded', kev: 'degraded', circl: 'degraded' },
    sourceErrors: { nvd: message, kev: message, circl: message },
    warning: message,
  };
}

function hasGeminiConfigured() {
  return Boolean(aiFactoryOverride || GEMINI_API_KEY);
}

function ensureGeminiConfigured(res) {
  if (!hasGeminiConfigured()) {
    res.status(503).json({ error: 'Gemini API key is not configured.' });
    return false;
  }
  return true;
}

app.post('/api/ai/verify-url', applyRateLimit('ai-verify-url', 60), async (req, res) => {
  try {
    if (!ensureGeminiConfigured(res)) return;
    const { ai, Type } = await getGemini();
    const { url, typosquatContext } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'A valid URL is required.' });
    }
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format.' });
    }

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Perform a thorough security audit on the URL: ${url}.${typosquatContext || ''}

      ANALYSIS CHECKLIST:
      1. TYPOSQUATTING CHECK: Does the domain use character substitution (0→o, 1→l, rn→m, vv→w), extra/missing characters, or homoglyphs to mimic a known brand?
      2. BRAND IMPERSONATION: Does the domain contain a brand name with suspicious prefixes/suffixes?
      3. LEGITIMATE CHECK: Is this an actual well-known domain?
      4. SUSPICIOUS TLD: Does it use high-risk TLDs (.tk, .ml, .xyz, .buzz, .top, .click)?
      5. URL STRUCTURE: Excessive subdomains, IP addresses, or encoded characters?
      
      CRITICAL: ANY character substitution in a brand name = HIGH threat.`,
      config: {
        systemInstruction: "You are an elite cybersecurity URL auditor specializing in phishing detection. You are EXTREMELY good at catching typosquatting, homoglyph attacks, and brand impersonation. Missing a phishing site is far worse than a false positive. You must respond with valid JSON only.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSafe: { type: Type.BOOLEAN },
            threatLevel: { type: Type.STRING },
            summary: { type: Type.STRING },
            details: { type: Type.ARRAY, items: { type: Type.STRING } },
            certificateInfo: {
              type: Type.OBJECT,
              properties: {
                issuer: { type: Type.STRING },
                validUntil: { type: Type.STRING },
                isTrusted: { type: Type.BOOLEAN },
                protocol: { type: Type.STRING }
              },
              required: ["issuer", "validUntil", "isTrusted", "protocol"]
            }
          },
          required: ["isSafe", "threatLevel", "summary", "details", "certificateInfo"]
        }
      }
    });

    const result = safeParseJson(response.text, {});
    if (!result || typeof result !== 'object') {
      return res.status(502).json({ error: 'AI returned an invalid verification response.' });
    }
    result.sources = [];
    res.json(result);
  } catch (err) {
    console.error('[API] verify-url error:', err.message);
    res.status(500).json({ error: 'URL verification failed: ' + err.message });
  }
});

app.post('/api/ai/chat', applyRateLimit('ai-chat', 90), async (req, res) => {
  try {
    if (!ensureGeminiConfigured(res)) return;
    const { ai } = await getGemini();
    const { contents, systemInstruction } = req.body;
    const instruction = typeof systemInstruction === 'string' ? systemInstruction.slice(0, 5000) : undefined;
    const isArray = Array.isArray(contents);
    const isString = typeof contents === 'string';
    if (!isArray && !isString) {
      return res.status(400).json({ error: 'Invalid chat payload.' });
    }

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: isString ? contents.slice(0, 12000) : contents.slice(0, 24),
      config: { systemInstruction: instruction || undefined }
    });
    res.json({ text: response.text });
  } catch (err) {
    console.error('[API] chat error:', err.message);
    res.status(500).json({ error: 'AI chat failed: ' + err.message });
  }
});

app.post('/api/ai/analyze-password', applyRateLimit('ai-analyze-password', 90), async (req, res) => {
  try {
    if (!ensureGeminiConfigured(res)) return;
    const { ai, Type } = await getGemini();
    const { password } = req.body;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Audit this password for strength and vulnerabilities: ${password}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            feedback: { type: Type.STRING },
            vulnerabilities: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });
    res.json(JSON.parse(response.text.trim()));
  } catch (err) {
    res.status(500).json({ error: 'Password analysis failed: ' + err.message });
  }
});

app.post('/api/ai/generate-passphrase', applyRateLimit('ai-generate-passphrase', 90), async (req, res) => {
  try {
    if (!ensureGeminiConfigured(res)) return;
    const { ai } = await getGemini();
    const { theme } = req.body;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Generate a single secure password themed "${theme}". Return ONLY the password string, nothing else.`
    });
    res.json({ password: response.text.trim() });
  } catch (err) {
    res.status(500).json({ error: 'Passphrase generation failed: ' + err.message });
  }
});

app.post('/api/ai/scan-page', applyRateLimit('ai-scan-page', 60), async (req, res) => {
  try {
    if (!ensureGeminiConfigured(res)) return;
    const { ai, Type } = await getGemini();
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'A valid URL is required.' });
    }
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format.' });
    }

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Visit and analyze this web page: ${url}

      Provide:
      1. The page title
      2. A comprehensive summary of the page content
      3. Security notes about the page`,
      config: {
        systemInstruction: "You are a web page analyst for the GuardiaPass security dashboard. Analyze URLs and provide security assessments. You must respond with valid JSON only.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            securityNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["title", "summary", "securityNotes"]
        }
      }
    });
    const parsed = safeParseJson(response.text, null);
    if (!parsed) {
      return res.status(502).json({ error: 'Failed to parse AI scan response.' });
    }
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: 'Page scan failed: ' + err.message });
  }
});

app.post('/api/ai/suggest-addresses', applyRateLimit('ai-suggest-addresses', 90), async (req, res) => {
  try {
    if (!ensureGeminiConfigured(res)) return;
    const { ai } = await getGemini();
    const { query } = req.body;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Suggest 3 real addresses matching "${query}". Return each address on a new line.`
    });
    const lines = response.text.split('\n').filter(l => l.trim());
    res.json(lines.map(line => ({ address: line.trim(), sources: [] })));
  } catch (err) {
    res.status(500).json({ error: 'Address suggestion failed: ' + err.message });
  }
});

app.post('/api/breach/password', applyRateLimit('breach-password', 120), async (req, res) => {
  try {
    const { hash } = req.body;
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);

    const response = await getFetchImpl()(`https://api.pwnedpasswords.com/range/${prefix}`);
    if (!response.ok) throw new Error('HIBP API error');

    const text = await response.text();
    const lines = text.split('\n');
    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(':');
      if (hashSuffix.trim() === suffix) {
        return res.json({ found: true, count: parseInt(countStr.trim(), 10) });
      }
    }
    res.json({ found: false, count: 0 });
  } catch (err) {
    res.status(500).json({ error: 'Password breach check failed: ' + err.message });
  }
});

app.post('/api/breach/email', applyRateLimit('breach-email', 90), async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    if (!ensureGeminiConfigured(res)) return;
    const { ai, Type } = await getGemini();

    const domain = email.split('@')[1];
    const knownBreaches = getKnownDomainBreaches(domain);

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `You are checking public breach intelligence for the email "${email}".
Return only high-confidence, publicly known incidents. Do not guess.
If there is no reliable evidence, return found=false and an empty breaches array.
Never fabricate breach names or dates.
Focus on well-documented incidents affecting the email's domain (${domain}) and common account exposure patterns.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            found: { type: Type.BOOLEAN },
            count: { type: Type.NUMBER },
            breaches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  date: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ['name', 'date', 'description'],
              },
            },
            summary: { type: Type.STRING },
          },
          required: ['found', 'count', 'breaches', 'summary'],
        },
      },
    });

    const aiPayload = normalizeBreachPayload(safeParseJson(response.text, {}));
    const merged = normalizeBreachPayload({
      ...aiPayload,
      breaches: [...aiPayload.breaches, ...knownBreaches],
    });

    if (!merged.found && knownBreaches.length === 0) {
      merged.summary = 'No reliable public breach indicators were found for this email. This does not guarantee zero exposure.';
    } else if (knownBreaches.length > 0 && !aiPayload.found) {
      merged.summary = `This email domain (${domain}) has known historical breach exposure records. Use caution and rotate credentials for accounts tied to this domain.`;
    }

    res.json(merged);
  } catch (err) {
    res.status(500).json({ error: 'Email breach check failed: ' + err.message });
  }
});

app.post('/api/breach/username', applyRateLimit('breach-username', 90), async (req, res) => {
  try {
    const username = normalizeUsername(req.body?.username);
    if (!isValidUsername(username)) {
      return res.status(400).json({ error: 'Username must be 3-50 chars and use letters, numbers, ".", "_", "-", or "@".' });
    }

    if (isValidEmail(username)) {
      const domain = username.toLowerCase().split('@')[1];
      const knownBreaches = getKnownDomainBreaches(domain);
      return res.json({
        found: knownBreaches.length > 0,
        count: knownBreaches.length,
        breaches: knownBreaches,
        summary: knownBreaches.length > 0
          ? `Input appears to be an email. This domain (${domain}) has known historical breach exposure records.`
          : 'Input appears to be an email. No reliable public breach indicators were found for the domain.',
      });
    }
    if (!ensureGeminiConfigured(res)) return;
    const { ai, Type } = await getGemini();

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Assess whether the username "${username}" appears in well-documented public breach incidents.
Be conservative: if uncertain, return found=false and no breaches.
Return only specific, named incidents where this username pattern is plausibly linked.
Do not fabricate data and do not claim dark-web certainty without public evidence.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            found: { type: Type.BOOLEAN },
            count: { type: Type.NUMBER },
            breaches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  date: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ['name', 'date', 'description'],
              },
            },
            summary: { type: Type.STRING },
          },
          required: ['found', 'count', 'breaches', 'summary'],
        },
      },
    });

    const normalized = normalizeBreachPayload(safeParseJson(response.text, {}));
    if (!normalized.found) {
      normalized.summary = 'No reliable public breach match was found for this username. That does not guarantee it was never exposed.';
    }
    res.json(normalized);
  } catch (err) {
    res.status(500).json({ error: 'Username breach check failed: ' + err.message });
  }
});

app.post('/api/hunter/verify', applyRateLimit('hunter-verify', 60), async (req, res) => {
  try {
    if (!HUNTER_API_KEY) {
      return res.status(503).json({ error: 'Hunter API key is not configured.' });
    }
    const { email } = req.body;
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    const response = await getFetchImpl()(
      `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${HUNTER_API_KEY}`
    );
    if (!response.ok) throw new Error(`Hunter API error: ${response.status}`);
    const data = await response.json();
    res.json(data.data);
  } catch (err) {
    res.status(500).json({ error: 'Email verification failed: ' + err.message });
  }
});

app.post('/api/tts/elevenlabs', applyRateLimit('tts-elevenlabs', 60), async (req, res) => {
  try {
    if (!ELEVENLABS_API_KEY) {
      return res.status(503).json({ error: 'ElevenLabs API key is not configured.' });
    }
    const text = String(req.body?.text || '').trim();
    if (!text) {
      return res.status(400).json({ error: 'Text is required for TTS.' });
    }
    if (text.length > 2000) {
      return res.status(400).json({ error: 'Text too long. Limit is 2000 characters.' });
    }

    const response = await getFetchImpl()(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(ELEVENLABS_VOICE_ID)}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: ELEVENLABS_MODEL_ID,
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.75,
            style: 0.2,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const apiError = await response.text().catch(() => '');
      throw new Error(`ElevenLabs API error ${response.status}${apiError ? `: ${apiError}` : ''}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    if (audioBuffer.length === 0) {
      return res.status(502).json({ error: 'ElevenLabs returned empty audio.' });
    }

    res.json({
      audioBase64: audioBuffer.toString('base64'),
      mimeType: 'audio/mpeg',
      voiceId: ELEVENLABS_VOICE_ID,
      modelId: ELEVENLABS_MODEL_ID,
    });
  } catch (err) {
    res.status(500).json({ error: 'ElevenLabs TTS failed: ' + err.message });
  }
});

app.get('/api/cyberacademy/cves', applyRateLimit('cyberacademy-cves', 60), async (req, res) => {
  const forceRefresh = req.query.refresh === '1';
  const windowHoursRaw = Number(req.query.windowHours || 336);
  const windowHours = Number.isFinite(windowHoursRaw) ? Math.min(Math.max(windowHoursRaw, 24), 720) : 336;
  const cachedCount = Array.isArray(cyberIntelCache.data?.cves) ? cyberIntelCache.data.cves.length : 0;
  const ttl = cachedCount === 0 ? CYBER_INTEL_EMPTY_CACHE_MS : CYBER_INTEL_CACHE_MS;
  const stale = Date.now() - cyberIntelCache.updatedAt > ttl;

  if (!forceRefresh && cyberIntelCache.data && !stale) {
    return res.json({ ...cyberIntelCache.data, cache: { hit: true, stale: false, ttlMs: ttl } });
  }

  try {
    const intel = await Promise.race([
      fetchCyberIntel(windowHours),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Live intel fetch timeout')), 9000)),
    ]);
    cyberIntelCache.data = intel;
    cyberIntelCache.updatedAt = Date.now();
    res.json({ ...intel, cache: { hit: false, stale: false, ttlMs: intel.cves.length === 0 ? CYBER_INTEL_EMPTY_CACHE_MS : CYBER_INTEL_CACHE_MS } });
  } catch (err) {
    if (cyberIntelCache.data) {
      return res.json({
        ...cyberIntelCache.data,
        cache: { hit: true, stale: true, ttlMs: ttl },
        warning: `Live refresh failed; showing cached results. ${err.message}`,
      });
    }
    const fallback = buildEmergencyIntelPayload(`Live refresh unavailable; showing emergency intel. ${err.message}`, windowHours);
    cyberIntelCache.data = fallback;
    cyberIntelCache.updatedAt = Date.now();
    res.json({ ...fallback, cache: { hit: false, stale: false, ttlMs: CYBER_INTEL_EMPTY_CACHE_MS } });
  }
});

app.post('/api/backboard/assistants', applyRateLimit('backboard-assistants', 30), async (req, res) => {
  try {
    const response = await getFetchImpl()('https://app.backboard.io/api/assistants', {
      method: 'POST',
      headers: { 'X-API-Key': BACKBOARD_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    if (!response.ok) throw new Error(`Backboard error: ${response.status}`);
    res.json(await response.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backboard/threads/:assistantId', applyRateLimit('backboard-threads', 45), async (req, res) => {
  try {
    const response = await getFetchImpl()(`https://app.backboard.io/api/assistants/${req.params.assistantId}/threads`, {
      method: 'POST',
      headers: { 'X-API-Key': BACKBOARD_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    if (!response.ok) throw new Error(`Backboard error: ${response.status}`);
    res.json(await response.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backboard/messages/:threadId', applyRateLimit('backboard-messages', 90), async (req, res) => {
  try {
    const formData = new URLSearchParams();
    formData.append('content', req.body.content);
    formData.append('stream', 'false');

    const response = await getFetchImpl()(`https://app.backboard.io/api/threads/${req.params.threadId}/messages`, {
      method: 'POST',
      headers: { 'X-API-Key': BACKBOARD_API_KEY },
      body: formData,
    });
    if (!response.ok) {
      if (response.status === 404) return res.status(404).json({ error: 'Thread not found' });
      throw new Error(`Backboard error: ${response.status}`);
    }
    res.json(await response.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('/{*path}', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'));
  }
});

const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 5000 : 3001);
export { app };

if (process.env.GUARDIAPASS_DISABLE_AUTOSTART !== '1') {
  initDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[GuardiaPass] Server running on port ${PORT}`);
      console.log(`[GuardiaPass] Database: ${dbAvailable ? 'connected' : 'unavailable (running without persistence)'}`);
      console.log(`[GuardiaPass] API keys: Gemini=${GEMINI_API_KEY ? 'SET' : 'MISSING'}, Hunter=${HUNTER_API_KEY ? 'SET' : 'MISSING'}, Backboard=${BACKBOARD_API_KEY ? 'SET' : 'MISSING'}, ElevenLabs=${ELEVENLABS_API_KEY ? 'SET' : 'MISSING'}`);
    });
  });
}
