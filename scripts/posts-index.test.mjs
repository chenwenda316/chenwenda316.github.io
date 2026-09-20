import test from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import { hashArticle, isPublicArticle, plainPreview, resolveSummary, requestSummary } from './posts-index.mjs';

test('only public source articles are eligible, including encoded encryption paths', () => {
  const page = { filePathRelative: 'posts/杂记/a.md', path: '/posts/%E6%9D%82%E8%AE%B0/a.html', frontmatter: {} };
  assert.equal(isPublicArticle(page), true);
  assert.equal(isPublicArticle(page, { config: { '/posts/杂记/': 'secret' } }), false);
  for (const frontmatter of [{ draft: true }, { article: false }, { feed: false }, { password: 'secret' }]) {
    assert.equal(isPublicArticle({ ...page, frontmatter }), false);
  }
  assert.equal(isPublicArticle({ ...page, filePathRelative: 'posts/README.md' }), false);
  assert.equal(isPublicArticle({ ...page, filePathRelative: 'demo/a.md' }), false);
});

test('preview uses prose without titles, code, tables, image paths or HTML', () => {
  const text = plainPreview(new MarkdownIt({ html: true }), '# Title\n\nHello **world** [link](https://example.com) ![alt](secret.png)\n\n| a | b |\n| - | - |\n| hidden | table |\n\n```js\nsecretCode()\n```\n\nNext 😀 paragraph.');
  assert.equal(text, 'Hello world link Next 😀 paragraph.');
});

test('hash is stable across line endings but detects title and code changes', () => {
  assert.equal(hashArticle('a', 'a\r\nb'), hashArticle('a', 'a\nb'));
  assert.notEqual(hashArticle('a', 'code1'), hashArticle('a', 'code2'));
  assert.notEqual(hashArticle('a', 'code'), hashArticle('b', 'code'));
});

test('incremental summaries reuse cache and preserve old hash on failure', async () => {
  const entries = {};
  const article = { id: 'posts/a.md', title: 'a', content: 'first' };
  let calls = 0;
  const options = { enabled: true, apiKey: 'test', model: 'test', generate: async () => { calls++; return '测试摘要'; } };
  assert.equal((await resolveSummary(article, entries, options)).status, 'generated');
  assert.equal((await resolveSummary(article, entries, options)).status, 'cached');
  assert.equal(calls, 1);
  const original = structuredClone(entries);
  const failed = { ...options, generate: async () => { throw new Error('failure'); } };
  assert.equal((await resolveSummary({ ...article, content: 'changed' }, entries, failed)).status, 'stale');
  assert.deepEqual(entries, original);
  assert.equal((await resolveSummary({ ...article, id: 'new' }, entries, failed)).status, 'missing');
  assert.equal(entries.new, undefined);
  assert.equal((await resolveSummary(article, entries, { ...options, model: 'new-model' })).status, 'generated');
});

test('API adapter submits article as data and rejects incomplete responses', async () => {
  let body;
  const fetchImpl = async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: '有效摘要' } }] }) };
  };
  assert.equal(await requestSummary({ title: 'title', content: 'body', model: 'test', apiKey: 'test', fetchImpl }), '有效摘要');
  assert.deepEqual(JSON.parse(body.messages[1].content), { title: 'title', article: 'body' });
  await assert.rejects(requestSummary({ title: 'a', content: 'b', model: 'test', apiKey: 'test', fetchImpl: async () => ({ ok: false, status: 401 }) }), /401/);
});
