# Design: seo-meta-og

## Scope

Changes only in `packages/docs/`. No app code touched.

## URL structure

```
https://openpencil.dev/                     → EN (root, x-default)
https://openpencil.dev/de/                  → DE
https://openpencil.dev/fr/                  → FR
https://openpencil.dev/es/                  → ES
https://openpencil.dev/it/                  → IT
https://openpencil.dev/pl/                  → PL
```

Page paths follow the same pattern: `/guide/features` (EN), `/de/guide/features` (DE), etc.

## Locale map

```ts
const LOCALES = {
  en: { lang: 'en', hreflang: 'en',    ogLocale: 'en_US', prefix: '' },
  de: { lang: 'de', hreflang: 'de',    ogLocale: 'de_DE', prefix: '/de' },
  fr: { lang: 'fr', hreflang: 'fr',    ogLocale: 'fr_FR', prefix: '/fr' },
  es: { lang: 'es', hreflang: 'es',    ogLocale: 'es_ES', prefix: '/es' },
  it: { lang: 'it', hreflang: 'it',    ogLocale: 'it_IT', prefix: '/it' },
  pl: { lang: 'pl', hreflang: 'pl',    ogLocale: 'pl_PL', prefix: '/pl' },
}
const BASE = 'https://openpencil.dev'
const LOCALE_PREFIXES = ['de', 'fr', 'es', 'it', 'pl']
```

## 1. Global head tags (`config.ts`)

Add to the root `head: []`:

```ts
['meta', { property: 'og:site_name', content: 'OpenPencil' }],
['meta', { property: 'og:image', content: 'https://openpencil.dev/screenshot.png' }],
['meta', { property: 'og:image:width', content: '2784' }],
['meta', { property: 'og:image:height', content: '1824' }],
['meta', { property: 'og:image:alt', content: 'OpenPencil — AI-Native Design Editor' }],
['meta', { name: 'twitter:card', content: 'summary_large_image' }],
['meta', { name: 'twitter:site', content: '@openpencildev' }],
['meta', { name: 'twitter:image', content: 'https://openpencil.dev/screenshot.png' }],
```

Keep existing: favicon, `og:type`, `og:title`, `og:description`.

## 2. `transformPageData` hook

Fires at build time for every page. Logic:

```ts
transformPageData(pageData) {
  const rel = pageData.relativePath  // e.g. 'de/guide/features.md'

  // Determine current locale
  const localeKey = LOCALE_PREFIXES.find(p => rel.startsWith(p + '/')) ?? 'en'
  const locale = LOCALES[localeKey]

  // Slug = path without locale prefix and .md, index → ''
  const slug = rel
    .replace(/^(de|fr|es|it|pl)\//, '')
    .replace(/\.md$/, '')
    .replace(/\/index$/, '')
    .replace(/^index$/, '')

  const pageUrl = `${BASE}${locale.prefix}/${slug}`.replace(/\/$/, '') || BASE
  const enUrl   = slug ? `${BASE}/${slug}` : BASE

  pageData.frontmatter.head ??= []
  const h = pageData.frontmatter.head

  // Canonical (locale-specific)
  h.push(['link', { rel: 'canonical', href: pageUrl }])

  // og:url (locale-specific)
  h.push(['meta', { property: 'og:url', content: pageUrl }])

  // og:locale (current locale)
  h.push(['meta', { property: 'og:locale', content: locale.ogLocale }])

  // og:locale:alternate for other locales
  for (const [key, loc] of Object.entries(LOCALES)) {
    if (key !== localeKey) {
      h.push(['meta', { property: 'og:locale:alternate', content: loc.ogLocale }])
    }
  }

  // hreflang for all locales + x-default
  for (const [key, loc] of Object.entries(LOCALES)) {
    const altUrl = slug ? `${BASE}${loc.prefix}/${slug}` : `${BASE}${loc.prefix || ''}`
    h.push(['link', { rel: 'alternate', hreflang: loc.hreflang, href: altUrl.replace(/\/$/, '') || BASE }])
  }
  // x-default points to EN
  h.push(['link', { rel: 'alternate', hreflang: 'x-default', href: enUrl || BASE }])

  // og:title (per page)
  if (pageData.title) {
    h.push(['meta', { property: 'og:title', content: `${pageData.title} — OpenPencil` }])
    h.push(['meta', { name: 'twitter:title', content: `${pageData.title} — OpenPencil` }])
  }

  // og:description + meta description (per page)
  if (pageData.description) {
    h.push(['meta', { property: 'og:description', content: pageData.description }])
    h.push(['meta', { name: 'twitter:description', content: pageData.description }])
    h.push(['meta', { name: 'description', content: pageData.description }])
  }
}
```

## 3. Sitemap with hreflang alternates

```ts
sitemap: {
  hostname: BASE,
  transformItems(items) {
    return items.map(item => {
      // Determine slug and locale from url
      const localeKey = LOCALE_PREFIXES.find(p => item.url.startsWith('/' + p + '/')) ?? 'en'
      const slug = item.url.replace(/^\/(de|fr|es|it|pl)\//, '/').replace(/\/$/, '') || '/'

      return {
        ...item,
        links: Object.entries(LOCALES).map(([, loc]) => ({
          lang: loc.hreflang,
          url: `${BASE}${loc.prefix}${slug === '/' ? '' : slug}` || BASE,
        })),
      }
    })
  },
}
```

## 4. JSON-LD component (`SchemaOrg.vue`)

Renders a `<script type="application/ld+json">` only on the EN homepage. Uses VitePress `useData()` to detect the page. The `<component :is="'script'">` pattern avoids Vue treating it as a special element.

Placed via `home-features-after` slot in `HomeLayout.vue` (already used for the screenshot). Only renders when `frontmatter.layout === 'home'` AND locale is EN (no prefix in `page.relativePath`).

## 5. Homepage frontmatter (`index.md` and locale index files)

Root `index.md` — add `title` for cleaner `<title>` tag:
```yaml
title: OpenPencil — AI-Native Design Editor
```

Locale index files (`de/index.md`, `fr/index.md`, etc.) — add translated `title`:
- DE: `OpenPencil — KI-nativer Design-Editor`
- FR: `OpenPencil — Éditeur de Design IA-Natif`
- ES: `OpenPencil — Editor de Diseño IA-Nativo`
- IT: `OpenPencil — Editor di Design IA-Nativo`
- PL: `OpenPencil — Edytor Graficzny z Natywnym AI`

## Key decisions

- **`hreflang` on every page**: Required for Google to correctly associate locale variants. VitePress `transformPageData` is the right hook — fires at build time, modifies `frontmatter.head` which VitePress renders into `<head>`.
- **`x-default` → EN**: Standard practice; tells Google the canonical "fallback" language.
- **`og:locale:alternate`**: Facebook/OG crawlers use this to link locale variants.
- **Sitemap alternates**: `xhtml:link` entries in sitemap are redundant with hreflang in HTML but recommended by Google for completeness.
- **JSON-LD only on EN homepage**: Avoid duplicate structured data across locales; Google recommends one authoritative schema page.
- **`twitter:title` / `twitter:description`**: Per-page Twitter card content, separate from global og tags.
