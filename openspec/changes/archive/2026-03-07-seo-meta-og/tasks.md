# Tasks: seo-meta-og

## 1. Global head tags + transformPageData

- [x] 1.1 `packages/docs/.vitepress/config.ts` — add to root `head[]`: `og:site_name`, `og:image` (+ width/height/alt), `twitter:card`, `twitter:site`, `twitter:image`
- [x] 1.2 `packages/docs/.vitepress/config.ts` — add `transformPageData` hook that for every page injects into `frontmatter.head`:
  - `<link rel="canonical">` with full locale-specific URL
  - `<meta property="og:url">` with full locale-specific URL
  - `<meta property="og:locale">` matching current page language (e.g. `de_DE`)
  - `<meta property="og:locale:alternate">` for all other 5 locales
  - `<link rel="alternate" hreflang="...">` for all 6 locales (en/de/fr/es/it/pl) pointing to their respective URLs
  - `<link rel="alternate" hreflang="x-default">` pointing to EN URL
  - `<meta property="og:title">` as `{pageData.title} — OpenPencil` (when title exists)
  - `<meta name="twitter:title">` same value
  - `<meta property="og:description">` from `pageData.description` (when exists)
  - `<meta name="twitter:description">` same value
  - `<meta name="description">` same value

## 2. Sitemap

- [x] 2.1 `packages/docs/.vitepress/config.ts` — add `sitemap: { hostname: 'https://openpencil.dev', transformItems }` where `transformItems` adds `links` array with all 6 locale alternates per page URL

## 3. JSON-LD structured data

- [x] 3.1 Create `packages/docs/.vitepress/theme/SchemaOrg.vue` — `SoftwareApplication` JSON-LD rendered only when `page.relativePath === 'index.md'` (EN homepage only, not locale homepages)
- [x] 3.2 `packages/docs/.vitepress/theme/HomeLayout.vue` — import `SchemaOrg` and add `<SchemaOrg />` inside the `home-features-after` template slot (alongside existing screenshot)

## 4. Homepage titles

- [x] 4.1 `packages/docs/index.md` — add `title: OpenPencil — AI-Native Design Editor` to frontmatter
- [x] 4.2 `packages/docs/de/index.md` — add `title: OpenPencil — KI-nativer Design-Editor`
- [x] 4.3 `packages/docs/fr/index.md` — add `title: OpenPencil — Éditeur de Design IA-Natif`
- [x] 4.4 `packages/docs/es/index.md` — add `title: OpenPencil — Editor de Diseño IA-Nativo`
- [x] 4.5 `packages/docs/it/index.md` — add `title: OpenPencil — Editor di Design IA-Nativo`
- [x] 4.6 `packages/docs/pl/index.md` — add `title: OpenPencil — Edytor Graficzny z Natywnym AI`

## 5. Verify build

- [x] 5.1 Run `cd packages/docs && bun run build` — confirm: exits 0, `sitemap.xml` exists in dist, `dist/index.html` contains `og:image`, `hreflang`, JSON-LD block, `dist/de/index.html` contains `og:locale` = `de_DE`, hreflang links, NO JSON-LD block
