# Public article index

`npm run docs:build` generates `src/.vuepress/dist/posts.json` from VuePress's final page paths. The existing Pages deployment publishes it at https://blog.for-each.cn/posts.json.

## AI summaries

The build's `onGenerated` hook updates summaries only when `GENERATE_AI_SUMMARIES=true`. Actions supplies this flag and the repository secret `DEEPSEEK_API_KEY`. An optional repository variable `DEEPSEEK_MODEL` overrides the default `deepseek-chat`. Local builds use cached summaries without API calls by default.

Successful results are stored in `.cache/ai-summaries.json`, committed back to main using GITHUB_TOKEN. Cache-only changes are excluded from the push trigger. The publishing workflow is serialized; it rebases cache-only commits without force-pushing and skips deployment when newer source changes exist. A branch protection rule forbidding bot pushes must be addressed before automatic cache persistence can work.

The SHA-256 covers title and normalized Markdown body (including code), excluding frontmatter. New articles, changed hashes, changed models or changed PROMPT_VERSION trigger generation. Each successful result is saved immediately. API calls have a 60-second timeout. Failed calls preserve the previous hash and summary so the next build retries. Missing keys or API failures do not prevent export. Articles longer than 24,000 Unicode characters send only the first 24,000 characters to the model; their hash still covers the entire body.

The first enabled build processes all public articles sequentially and incurs API usage. Following builds only process cache misses. Do not put API keys in source files.

## Public contract

The document contains `version: 1`, `generatedAt`, and `posts`. Each post has `id`, `title`, `url`, `date` (ISO date or null), `author`, `categories`, `tags`, `summary`, `summaryStatus` (`cached`, `stale`, `missing`), `preview`, `previewTruncated`, and `featured`.

Preview is the first 300 Unicode characters of readable paragraphs, excluding headings, tables, code blocks and images. Render summary and preview as text, not v-html. A failed new summary is empty; show the preview alone. Explicit frontmatter date wins; otherwise the oldest Git author date for that file is used. Keep checkout fetch-depth: 0 for reliable dates.

Only Markdown under src/posts is included. README/index directory pages, draft: true, article: false, feed: false, password/encrypt protected pages and paths covered by the shared theme encryption config are excluded before text extraction or API calls. Removed/private entries are purged from the current cache during enabled builds; already committed Git history is not erased.

Use category/tag frontmatter for taxonomy and featured: true for homepage selections. Encryption configuration now lives in src/.vuepress/encryption.ts, shared with the theme and exporter.

## Checks

Run `node --test scripts/posts-index.test.mjs`, then `npm run docs:build`. The tests use a mock AI service and do not spend API credits. The generated JSON can be inspected locally before deployment. The build-only hook does not serve posts.json in docs:dev.
