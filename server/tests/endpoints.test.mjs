import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';

process.env.GUARDIAPASS_DISABLE_AUTOSTART = '1';
process.env.NODE_ENV = 'test';

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

function invokeJson(method, url, body) {
  const payload = JSON.stringify(body ?? {});
  const req = Readable.from([payload]);
  req.method = method;
  req.url = url;
  req.headers = {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload).toString(),
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
