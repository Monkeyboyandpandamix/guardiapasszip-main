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
app.use(express.json({ limit: '10mb' }));
app.use(cors());

let pool = null;
let dbAvailable = false;

if (process.env.DATABASE_URL) {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

const GEMINI_API_KEY = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const GEMINI_BASE_URL = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || undefined;
const HUNTER_API_KEY = process.env.HUNTER_API_KEY || '';
const BACKBOARD_API_KEY = process.env.BACKBOARD_API_KEY || '';
let aiFactoryOverride = null;
let fetchImplOverride = null;

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

app.post('/api/ai/verify-url', async (req, res) => {
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

app.post('/api/ai/chat', async (req, res) => {
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

app.post('/api/ai/analyze-password', async (req, res) => {
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

app.post('/api/ai/generate-passphrase', async (req, res) => {
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

app.post('/api/ai/scan-page', async (req, res) => {
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

app.post('/api/ai/suggest-addresses', async (req, res) => {
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

app.post('/api/breach/password', async (req, res) => {
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

app.post('/api/breach/email', async (req, res) => {
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

app.post('/api/breach/username', async (req, res) => {
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

app.post('/api/hunter/verify', async (req, res) => {
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

app.post('/api/backboard/assistants', async (req, res) => {
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

app.post('/api/backboard/threads/:assistantId', async (req, res) => {
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

app.post('/api/backboard/messages/:threadId', async (req, res) => {
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
      console.log(`[GuardiaPass] API keys: Gemini=${GEMINI_API_KEY ? 'SET' : 'MISSING'}, Hunter=${HUNTER_API_KEY ? 'SET' : 'MISSING'}, Backboard=${BACKBOARD_API_KEY ? 'SET' : 'MISSING'}`);
    });
  });
}
