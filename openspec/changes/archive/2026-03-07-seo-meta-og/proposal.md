# Proposal: seo-meta-og

## Problem

The VitePress docs site at `openpencil.dev` has minimal SEO and social metadata:

- **Open Graph tags** are incomplete — `og:image`, `og:url`, `og:site_name`, `twitter:card`, `twitter:image` are all missing. Social shares on X/Twitter, Slack, Discord show no preview image.
- **Structured data (JSON-LD)** is absent — no `SoftwareApplication` schema, so Google can't render rich results for the app.
- **Canonical URL** is missing — no `og:url` or `<link rel="canonical">` per page.
- **Per-page meta descriptions** — many pages have frontmatter `title` + `description`, but non-frontmatter pages (guides, reference) have no `<meta name="description">`. VitePress does pick up frontmatter but the site-level fallback is fine; the real gap is OG tags.
- **Twitter/X Card** — `twitter:card`, `twitter:site`, `twitter:image` not set. Links pasted to X show no card.
- **Sitemap** — VitePress supports `sitemap` config but it isn't enabled. Google can only discover pages by crawling.
- **`og:image`** — `screenshot.png` (2784×1824) already exists in `public/` and is perfect for OG image (recommended: 1200×630 crop or use as-is since most crawlers handle oversized).

## What changes

1. **`config.ts`** — add complete `head[]` array with OG, Twitter Card, and canonical base URL; enable sitemap; add `og:image` pointing to `/screenshot.png`
2. **`config.ts`** — add `transformPageData` hook to inject per-page `og:title`, `og:description`, `og:url` dynamically
3. **`index.md`** — add frontmatter `title` for cleaner OG title on homepage
4. **JSON-LD component** — `SchemaOrg.vue` injecting `SoftwareApplication` structured data on the homepage
5. **`theme/index.ts`** — register SchemaOrg component for homepage

## Why

Search engines and social platforms rely on these signals. Without OG image, links to `openpencil.dev` shared anywhere show a blank card. Without JSON-LD, Google won't show the app in rich results. Sitemap speeds up discovery of all 50+ doc pages.
