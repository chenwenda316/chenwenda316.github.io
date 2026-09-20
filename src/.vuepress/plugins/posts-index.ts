import type { Plugin } from 'vuepress/core';
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import encryption from '../encryption.js';
import { isPublicArticle, plainPreview, readCache, saveCache, resolveSummary } from '../../../scripts/posts-index.mjs';

const list = (value: unknown): string[] => (Array.isArray(value) ? value : value ? [value] : []).filter(v => typeof v === 'string');
const dateString = (value: unknown): string | null => {
  if (!value) return null;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

export default (): Plugin => ({
  name: 'vuepress-plugin-public-posts-index',
  async onGenerated(app) {
    const cachePath = resolve(app.dir.source(), '../.cache/ai-summaries.json');
    const cache = await readCache(cachePath);
    const before = JSON.stringify(cache);
    const enabled = process.env.GENERATE_AI_SUMMARIES === 'true';
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    if (enabled && !apiKey) console.warn('[posts] DEEPSEEK_API_KEY missing; using cached summaries only.');
    const pages = app.pages.filter(page => isPublicArticle(page, encryption));
    const publicIds = new Set(pages.map(page => page.filePathRelative));
    // Purge deleted or newly protected articles from the persisted cache, too.
    for (const id of Object.keys(cache.entries)) if (!publicIds.has(id)) delete cache.entries[id];
    const posts = [];
    const counts: Record<string, number> = {};
    for (const page of pages) {
      const fm = page.frontmatter;
      const content = page.content.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
      const text = plainPreview(app.markdown, content);
      const characters = [...text];
      const result = await resolveSummary({ id: page.filePathRelative, title: page.title, content }, cache.entries, {
        enabled, apiKey, model, warn: (message: string) => console.warn('[posts]', message),
      });
      counts[result.status] = (counts[result.status] ?? 0) + 1;
      if (enabled && result.status === 'generated') await saveCache(cachePath, cache);
      let date = dateString(fm.date);
      if (!date && page.filePath) {
        try {
          const dates = execFileSync('git', ['log', '--follow', '--format=%aI', '--', page.filePath], { cwd: app.dir.source(), encoding: 'utf8' }).trim().split('\n');
          date = dateString(dates.at(-1));
        } catch { /* Untracked articles have no publish date yet. */ }
      }
      posts.push({
        id: page.filePathRelative, title: page.title,
        url: new URL(page.path, 'https://blog.for-each.cn').href,
        date, author: typeof fm.author === 'string' ? fm.author : 'for-each',
        categories: list(fm.category), tags: list(fm.tag),
        summary: result.summary, summaryStatus: result.status === 'generated' ? 'cached' : result.status,
        preview: characters.slice(0, 300).join(''), previewTruncated: characters.length > 300,
        featured: fm.featured === true,
      });
    }
    if (enabled && JSON.stringify(cache) !== before) await saveCache(cachePath, cache);
    posts.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.id!.localeCompare(b.id!));
    await writeFile(app.dir.dest('posts.json'), JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), posts }, null, 2) + '\n');
    console.log(`[posts] Exported ${posts.length} public articles: ${JSON.stringify(counts)}`);
  },
});
