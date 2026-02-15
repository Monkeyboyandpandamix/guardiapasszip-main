import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';

process.env.GUARDIAPASS_DISABLE_AUTOSTART = '1';
process.env.NODE_ENV = 'test';
process.env.ELEVENLABS_API_KEY = 'test-elevenlabs-key';

const { app, __setAIFactoryForTests, __setFetchForTests } = await import('../index.js');

const Type = {
  OBJECT: 'object',
  ARRAY: 'array',
  STRING: 'string',
  BOOLEAN: 'boolean',
  NUMBER: 'number',
};

const mockAi = {
  models: {
    async generateContent({ contents }) {
      const prompt = typeof contents === 'string' ? contents : JSON.stringify(contents);

      if (prompt.includes('public breach intelligence for the email')) {
        return {
          text: JSON.stringify({
            found: false,
            count: 0,
            breaches: [],
            summary: 'No direct hit in model context.',
          }),
        };
      }

      if (prompt.includes('Assess whether the username')) {
        return {
          text: JSON.stringify({
            found: true,
            count: 1,
            breaches: [
              {
                name: 'Example Exposure',
                date: '2024',
                description: 'Username observed in a publicly discussed exposure dataset.',
              },
            ],
            summary: 'Potential username exposure found.',
          }),
        };
      }

      return { text: 'Mock chat response' };
    },
  },
};

__setAIFactoryForTests(async () => ({ ai: mockAi, Type }));
__setFetchForTests(async (url) => {
  const asString = String(url);
  if (asString.includes('api.pwnedpasswords.com/range/12345')) {
    return new Response('ABCDEF:42\n', { status: 200 });
  }
  if (asString.includes('services.nvd.nist.gov/rest/json/cves/2.0')) {
    return new Response(JSON.stringify({
      vulnerabilities: [
        {
          cve: {
            id: 'CVE-2026-0001',
            published: '2026-02-01T00:00:00.000Z',
            lastModified: '2026-02-02T00:00:00.000Z',
            descriptions: [{ lang: 'en', value: 'Sample test vulnerability description.' }],
            references: [{ url: 'https://nvd.nist.gov/vuln/detail/CVE-2026-0001' }],
            metrics: {
              cvssMetricV31: [
                { cvssData: { baseScore: 9.1, baseSeverity: 'CRITICAL', vectorString: 'AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' } }
              ],
            },
          },
        },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (asString.includes('known_exploited_vulnerabilities.json')) {
    return new Response(JSON.stringify({
      vulnerabilities: [
        {
          cveID: 'CVE-2026-0001',
          vendorProject: 'Test Vendor',
          product: 'Test Product',
          vulnerabilityName: 'Sample exploited bug',
          dateAdded: '2026-02-03',
          knownRansomwareCampaignUse: 'Unknown',
          shortDescription: 'Sample KEV description',
        },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (asString.includes('api.elevenlabs.io/v1/text-to-speech/')) {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6]);
    return new Response(bytes, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
  }
  return new Response(JSON.stringify({ data: {} }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

test('POST /api/ai/chat rejects invalid payload shape', async () => {
  const response = await invokeJson('POST', '/api/ai/chat', { contents: { bad: true } });
  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /Invalid chat payload/i);
});

test('POST /api/ai/chat returns AI response for valid payload', async () => {
  const response = await invokeJson('POST', '/api/ai/chat', { contents: 'hello' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.text, 'Mock chat response');
});

test('POST /api/breach/email validates email format', async () => {
  const response = await invokeJson('POST', '/api/breach/email', { email: 'bad-email' });
  assert.equal(response.statusCode, 400);
});

test('POST /api/breach/email enriches with known domain breaches', async () => {
  const response = await invokeJson('POST', '/api/breach/email', { email: 'user@linkedin.com' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.found, true);
  assert.ok(response.body.count >= 1);
  assert.ok(Array.isArray(response.body.breaches));
  assert.ok(response.body.breaches.some((b) => /linkedin/i.test(b.name)));
});

test('POST /api/breach/username validates username format', async () => {
  const response = await invokeJson('POST', '/api/breach/username', { username: 'a' });
  assert.equal(response.statusCode, 400);
});

test('POST /api/breach/password checks k-anon suffix matching', async () => {
  const response = await invokeJson('POST', '/api/breach/password', { hash: '12345ABCDEF' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.found, true);
  assert.equal(response.body.count, 42);
});

test('POST /api/ai/chat returns 500 when provider fails', async () => {
  __setAIFactoryForTests(async () => ({
    ai: {
      models: {
        async generateContent() {
          throw new Error('provider failure');
        },
      },
    },
    Type,
  }));
  const response = await invokeJson('POST', '/api/ai/chat', { contents: 'hello' });
  assert.equal(response.statusCode, 500);
  assert.match(response.body.error, /AI chat failed/i);
  __setAIFactoryForTests(async () => ({ ai: mockAi, Type }));
});

test('POST /api/tts/elevenlabs validates text payload', async () => {
  const response = await invokeJson('POST', '/api/tts/elevenlabs', { text: '' });
  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /Text is required/i);
});

test('POST /api/tts/elevenlabs returns base64 audio payload', async () => {
  const response = await invokeJson('POST', '/api/tts/elevenlabs', { text: 'Read this sample text aloud.' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.mimeType, 'audio/mpeg');
  assert.equal(typeof response.body.audioBase64, 'string');
  assert.ok(response.body.audioBase64.length > 0);
});

test('GET /api/cyberacademy/cves returns recent technical intel', async () => {
  const response = await invokeJson('GET', '/api/cyberacademy/cves', null);
  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(response.body.cves));
  assert.ok(response.body.cves.length >= 1);
  assert.equal(response.body.cves[0].cveId, 'CVE-2026-0001');
  assert.equal(response.body.cves[0].exploitedInWild, true);
});

function invokeJson(method, url, body) {
  const hasBody = body !== null && body !== undefined;
  const payload = hasBody ? JSON.stringify(body) : '';
  const req = hasBody ? Readable.from([payload]) : Readable.from([]);
  req.method = method;
  req.url = url;
  req.headers = {
    'content-type': 'application/json',
    'content-length': hasBody ? Buffer.byteLength(payload).toString() : '0',
  };
  req.connection = {};
  req.socket = {};

  const res = new EventEmitter();
  const headers = new Map();
  const chunks = [];
  res.statusCode = 200;
  res.setHeader = (key, value) => headers.set(String(key).toLowerCase(), value);
  res.getHeader = (key) => headers.get(String(key).toLowerCase());
  res.writeHead = (statusCode, hdrs = {}) => {
    res.statusCode = statusCode;
    for (const [k, v] of Object.entries(hdrs)) {
      res.setHeader(k, v);
    }
  };
  res.write = (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    return true;
  };
  res.end = (chunk) => {
    if (chunk !== undefined) res.write(chunk);
    res.emit('finish');
  };

  return new Promise((resolve, reject) => {
    res.once('finish', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let parsed = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = { raw };
      }
      resolve({
        statusCode: res.statusCode,
        body: parsed,
        text: raw,
      });
    });
    res.once('error', reject);
    app.handle(req, res);
  });
}
