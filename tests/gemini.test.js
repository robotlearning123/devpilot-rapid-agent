import { describe, it, assert } from 'vitest';
import { createGeminiClient } from '../src/cloud/gemini.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a mock fetch that resolves with a standard Gemini response. */
function mockFetchOK(text = 'AI response') {
  return async (url, opts) => {
    mockFetchOK.lastUrl = url;
    mockFetchOK.lastOpts = opts;
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text }] } }],
      }),
    };
  };
}

/** Create a mock fetch that rejects. */
function mockFetchError(status, body = 'fail') {
  return async () => ({
    ok: false,
    status,
    statusText: body,
    text: async () => body,
  });
}

// ---------------------------------------------------------------------------
// createGeminiClient — no credentials (heuristic fallback)
// ---------------------------------------------------------------------------

describe('createGeminiClient — heuristic fallback', () => {
  it('generate() falls back when no credentials', async () => {
    const client = createGeminiClient({});
    const result = await client.generate('Review code with eval() usage');
    assert.ok(result.includes('eval()'));
  });

  it('review() falls back when no credentials', async () => {
    const client = createGeminiClient({});
    const result = await client.review('Code with password = "x"');
    assert.ok(result.includes('credential'));
  });

  it('chat() falls back when no credentials', async () => {
    const client = createGeminiClient({});
    const result = await client.chat([
      { role: 'user', text: 'Review eval(input)' },
    ]);
    assert.ok(result.includes('eval()'));
  });

  it('heuristic detects innerHTML', async () => {
    const client = createGeminiClient({});
    const result = await client.generate('el.innerHTML = userInput');
    assert.ok(result.includes('innerHTML'));
  });

  it('heuristic detects document.write', async () => {
    const client = createGeminiClient({});
    const result = await client.generate('document.write(data)');
    assert.ok(result.includes('document.write'));
  });

  it('heuristic returns clean for good code', async () => {
    const client = createGeminiClient({});
    const result = await client.generate('const x = 1 + 2;');
    assert.ok(result.includes('No issues'));
  });

  it('heuristic detects TODO/FIXME', async () => {
    const client = createGeminiClient({});
    const result = await client.generate('function foo() { TODO: refactor }');
    assert.ok(result.includes('TODO'));
  });

  it('heuristic detects console.log', async () => {
    const client = createGeminiClient({});
    const result = await client.generate('console.log("debug")');
    assert.ok(result.includes('console.log'));
  });

  it('heuristic detects empty catch', async () => {
    const client = createGeminiClient({});
    const result = await client.generate('try { x() } catch () {}');
    assert.ok(result.includes('Empty catch'));
  });
});

// ---------------------------------------------------------------------------
// createGeminiClient — API key auth
// ---------------------------------------------------------------------------

describe('createGeminiClient — API key auth', () => {
  it('generate() calls Google AI endpoint with API key', async () => {
    const fetch = mockFetchOK('hello');
    const client = createGeminiClient(
      { GEMINI_API_KEY: 'test-key' },
      { fetch },
    );
    const result = await client.generate('hi');
    assert.equal(result, 'hello');
    assert.ok(mockFetchOK.lastUrl.includes('generativelanguage.googleapis.com'));
    assert.ok(mockFetchOK.lastUrl.includes('key=test-key'));
  });

  it('generate() sends systemInstruction in generation config', async () => {
    const fetch = mockFetchOK('sys');
    const client = createGeminiClient(
      { GEMINI_API_KEY: 'k' },
      { fetch },
    );
    await client.generate('prompt', { systemInstruction: 'be helpful' });
    const body = JSON.parse(mockFetchOK.lastOpts.body);
    assert.ok(Array.isArray(body.contents));
    assert.equal(body.contents[0].role, 'user');
  });

  it('generate() respects temperature and maxOutputTokens options', async () => {
    const fetch = mockFetchOK('t');
    const client = createGeminiClient(
      { GEMINI_API_KEY: 'k' },
      { fetch },
    );
    await client.generate('p', { temperature: 0.5, maxOutputTokens: 512 });
    const body = JSON.parse(mockFetchOK.lastOpts.body);
    assert.equal(body.generationConfig.temperature, 0.5);
    assert.equal(body.generationConfig.maxOutputTokens, 512);
  });

  it('generate() uses defaults when options omitted', async () => {
    const fetch = mockFetchOK('d');
    const client = createGeminiClient(
      { GEMINI_API_KEY: 'k' },
      { fetch },
    );
    await client.generate('p');
    const body = JSON.parse(mockFetchOK.lastOpts.body);
    assert.equal(body.generationConfig.temperature, 0.2);
    assert.equal(body.generationConfig.maxOutputTokens, 1024);
  });

  it('generate() throws on non-ok response', async () => {
    const fetch = mockFetchError(429, 'rate limited');
    const client = createGeminiClient(
      { GEMINI_API_KEY: 'k' },
      { fetch },
    );
    let threw = false;
    try {
      await client.generate('p');
    } catch (e) {
      threw = true;
      assert.ok(e.message.includes('Gemini API 429'));
    }
    assert.ok(threw, 'expected an error to be thrown');
  });

  it('generate() handles res.text() rejection gracefully', async () => {
    const fetch = async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => { throw new Error('no body'); },
    });
    const client = createGeminiClient(
      { GEMINI_API_KEY: 'k' },
      { fetch },
    );
    let threw = false;
    try {
      await client.generate('p');
    } catch (e) {
      threw = true;
      assert.ok(e.message.includes('Gemini API 500'));
    }
    assert.ok(threw, 'expected an error to be thrown');
  });

  it('uses custom GEMINI_MODEL when provided', async () => {
    const fetch = mockFetchOK('m');
    const client = createGeminiClient(
      { GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-1.5-pro' },
      { fetch },
    );
    await client.generate('p');
    assert.ok(mockFetchOK.lastUrl.includes('gemini-1.5-pro'));
  });
});

// ---------------------------------------------------------------------------
// createGeminiClient — Vertex AI auth (project-based)
// ---------------------------------------------------------------------------

describe('createGeminiClient — Vertex AI auth', () => {
  it('generate() calls Vertex AI endpoint with project', async () => {
    const fetch = mockFetchOK('vertex');
    const client = createGeminiClient(
      { GOOGLE_CLOUD_PROJECT: 'my-project' },
      { fetch },
    );
    const result = await client.generate('p');
    assert.equal(result, 'vertex');
    assert.ok(mockFetchOK.lastUrl.includes('aiplatform.googleapis.com'));
    assert.ok(mockFetchOK.lastUrl.includes('my-project'));
    assert.ok(mockFetchOK.lastUrl.includes('us-central1'));
  });

  it('uses custom GOOGLE_CLOUD_LOCATION', async () => {
    const fetch = mockFetchOK('loc');
    const client = createGeminiClient(
      { GOOGLE_CLOUD_PROJECT: 'proj', GOOGLE_CLOUD_LOCATION: 'europe-west1' },
      { fetch },
    );
    await client.generate('p');
    assert.ok(mockFetchOK.lastUrl.includes('europe-west1'));
  });
});

// ---------------------------------------------------------------------------
// review()
// ---------------------------------------------------------------------------

describe('review()', () => {
  it('uses code review system prompt', async () => {
    const fetch = mockFetchOK('review');
    const client = createGeminiClient(
      { GEMINI_API_KEY: 'k' },
      { fetch },
    );
    await client.review('some code');
    // review() passes systemInstruction + temperature override
    const body = JSON.parse(mockFetchOK.lastOpts.body);
    assert.equal(body.generationConfig.temperature, 0.1);
  });

  it('falls back to heuristic on API error', async () => {
    const fetch = mockFetchError(500);
    const client = createGeminiClient(
      { GEMINI_API_KEY: 'k' },
      { fetch },
    );
    const result = await client.review('Code with eval()');
    assert.ok(result.includes('eval()'));
  });

  it('allows overriding review options', async () => {
    const fetch = mockFetchOK('r');
    const client = createGeminiClient(
      { GEMINI_API_KEY: 'k' },
      { fetch },
    );
    await client.review('code', { temperature: 0.7 });
    const body = JSON.parse(mockFetchOK.lastOpts.body);
    assert.equal(body.generationConfig.temperature, 0.7);
  });
});

// ---------------------------------------------------------------------------
// chat()
// ---------------------------------------------------------------------------

describe('chat()', () => {
  it('sends multi-turn messages with role mapping', async () => {
    const fetch = mockFetchOK('chat');
    const client = createGeminiClient(
      { GEMINI_API_KEY: 'k' },
      { fetch },
    );
    const result = await client.chat([
      { role: 'user', text: 'hello' },
      { role: 'assistant', text: 'hi there' },
      { role: 'user', text: 'review this' },
    ]);
    assert.equal(result, 'chat');
    const body = JSON.parse(mockFetchOK.lastOpts.body);
    assert.equal(body.contents.length, 3);
    assert.equal(body.contents[0].role, 'user');
    assert.equal(body.contents[1].role, 'model'); // assistant → model
    assert.equal(body.contents[2].role, 'user');
  });

  it('sends systemInstruction in chat body', async () => {
    const fetch = mockFetchOK('sys-chat');
    const client = createGeminiClient(
      { GEMINI_API_KEY: 'k' },
      { fetch },
    );
    await client.chat(
      [{ role: 'user', text: 'hi' }],
      { systemInstruction: 'be concise' },
    );
    const body = JSON.parse(mockFetchOK.lastOpts.body);
    assert.deepEqual(body.systemInstruction, { parts: [{ text: 'be concise' }] });
  });

  it('omits systemInstruction when not provided', async () => {
    const fetch = mockFetchOK('no-sys');
    const client = createGeminiClient(
      { GEMINI_API_KEY: 'k' },
      { fetch },
    );
    await client.chat([{ role: 'user', text: 'hi' }]);
    const body = JSON.parse(mockFetchOK.lastOpts.body);
    assert.equal(body.systemInstruction, undefined);
  });

  it('uses default chat temperature 0.3', async () => {
    const fetch = mockFetchOK('t');
    const client = createGeminiClient(
      { GEMINI_API_KEY: 'k' },
      { fetch },
    );
    await client.chat([{ role: 'user', text: 'hi' }]);
    const body = JSON.parse(mockFetchOK.lastOpts.body);
    assert.equal(body.generationConfig.temperature, 0.3);
  });

  it('throws on Vertex AI error', async () => {
    const fetch = mockFetchError(403, 'denied');
    const client = createGeminiClient(
      { GOOGLE_CLOUD_PROJECT: 'proj' },
      { fetch },
    );
    let threw = false;
    try {
      await client.chat([{ role: 'user', text: 'hi' }]);
    } catch (e) {
      threw = true;
      assert.ok(e.message.includes('Gemini API 403'));
    }
    assert.ok(threw, 'expected an error to be thrown');
  });
});

// ---------------------------------------------------------------------------
// extractText — edge cases via generate()
// ---------------------------------------------------------------------------

describe('response edge cases', () => {
  it('returns "No response generated" for empty candidates', async () => {
    const fetch = async () => ({
      ok: true,
      json: async () => ({ candidates: [] }),
    });
    const client = createGeminiClient(
      { GEMINI_API_KEY: 'k' },
      { fetch },
    );
    const result = await client.generate('p');
    assert.equal(result, 'No response generated');
  });

  it('returns safety message when blocked by safety filters', async () => {
    const fetch = async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }],
      }),
    });
    const client = createGeminiClient(
      { GEMINI_API_KEY: 'k' },
      { fetch },
    );
    const result = await client.generate('p');
    assert.ok(result.includes('safety'));
  });

  it('returns "No text in response" for empty parts', async () => {
    const fetch = async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{}] } }],
      }),
    });
    const client = createGeminiClient(
      { GEMINI_API_KEY: 'k' },
      { fetch },
    );
    const result = await client.generate('p');
    assert.equal(result, 'No text in response');
  });

  it('concatenates multiple text parts', async () => {
    const fetch = async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'hello ' }, { text: 'world' }] } }],
      }),
    });
    const client = createGeminiClient(
      { GEMINI_API_KEY: 'k' },
      { fetch },
    );
    const result = await client.generate('p');
    assert.equal(result, 'hello world');
  });
});
