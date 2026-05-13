import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createGitLabClient } from '../src/gitlab/client.js';

function mockFetch(responses) {
  let callIndex = 0;
  return async (url, opts) => {
    const response = responses[callIndex++] ?? { ok: true, json: async () => [] };
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      statusText: response.statusText ?? 'OK',
      json: async () => response.data ?? response,
    };
  };
}

describe('createGitLabClient', () => {
  const config = {
    GITLAB_URL: 'https://gitlab.example.com',
    GITLAB_TOKEN: 'test-token',
    GITLAB_PROJECT_ID: '42',
  };

  it('lists open merge requests', async () => {
    const fetch = mockFetch([{ data: [{ iid: 1, title: 'Test MR' }] }]);
    const client = createGitLabClient(config, fetch);
    const mrs = await client.listOpenMRs();
    assert.equal(mrs.length, 1);
    assert.equal(mrs[0].iid, 1);
  });

  it('fetches MR diff and parses hunks', async () => {
    const fetch = mockFetch([{
      data: {
        changes: [{
          old_path: 'src/app.js',
          diff: '@@ -10,3 +10,4 @@\n+new line\n',
        }],
      },
    }]);
    const client = createGitLabClient(config, fetch);
    const diff = await client.getMRDiff(1);
    assert.equal(diff.length, 1);
    assert.equal(diff[0].file, 'src/app.js');
    assert.equal(diff[0].hunks.length, 1);
    assert.equal(diff[0].hunks[0].oldStart, 10);
  });

  it('posts a comment to an MR', async () => {
    let capturedBody;
    const fetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ id: 1 }) };
    };
    const client = createGitLabClient(config, fetch);
    await client.postComment(1, '## Review Results');
    assert.equal(capturedBody.body, '## Review Results');
  });

  it('throws on API errors', async () => {
    const fetch = async () => ({ ok: false, status: 401, statusText: 'Unauthorized' });
    const client = createGitLabClient(config, fetch);
    await assert.rejects(() => client.listOpenMRs(), /401/);
  });
});
