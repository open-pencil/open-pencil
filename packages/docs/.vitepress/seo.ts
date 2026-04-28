export const BASE = 'https://openpencil.dev'

export const LOCALE_PREFIXES = ['de', 'fr', 'es', 'it', 'pl', 'ru'] as const

export const LOCALES: Record<string, { hreflang: string; ogLocale: string; prefix: string }> = {
  en: { hreflang: 'en', ogLocale: 'en_US', prefix: '' },
  de: { hreflang: 'de', ogLocale: 'de_DE', prefix: '/de' },
  fr: { hreflang: 'fr', ogLocale: 'fr_FR', prefix: '/fr' },
  es: { hreflang: 'es', ogLocale: 'es_ES', prefix: '/es' },
  it: { hreflang: 'it', ogLocale: 'it_IT', prefix: '/it' },
  pl: { hreflang: 'pl', ogLocale: 'pl_PL', prefix: '/pl' },
  ru: { hreflang: 'ru', ogLocale: 'ru_RU', prefix: '/ru' }
}

export const siteHead: [string, Record<string, string>][] = [
  ['link', { rel: 'icon', type: 'image/png', href: '/favicon.png' }],
  ['meta', { property: 'og:type', content: 'website' }],
  ['meta', { property: 'og:site_name', content: 'OpenPencil' }],
  ['meta', { property: 'og:image', content: `${BASE}/screenshot.png` }],
  ['meta', { property: 'og:image:width', content: '2784' }],
  ['meta', { property: 'og:image:height', content: '1824' }],
  ['meta', { property: 'og:image:alt', content: 'OpenPencil — AI-Native Design Editor' }],
  ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ['meta', { name: 'twitter:site', content: '@openpencildev' }],
  ['meta', { name: 'twitter:image', content: `${BASE}/screenshot.png` }]
]

type SitemapItem = {
  url: string
  links?: Array<{ lang: string; url: string }>
}

type PageDataLike = {
  relativePath: string
  title?: string
  description?: string
  frontmatter: {
    head?: [string, Record<string, string>][]
  }
}

function stripLocalePrefix(path: string): string {
  return path.replace(new RegExp(`^(${LOCALE_PREFIXES.join('|')})/`), '')
}

function localeKeyForPath(path: string): string {
  return LOCALE_PREFIXES.find((prefix) => path.startsWith(`${prefix}/`)) ?? 'en'
}

function slugForPath(path: string): string {
  return stripLocalePrefix(path)
    .replace(/\.md$/, '')
    .replace(/\/index$/, '')
    .replace(/^index$/, '')
    .replace(/\/$/, '')
}

function localizedUrl(slug: string, prefix: string): string {
  if (slug) return `${BASE}${prefix}/${slug}`
  return `${BASE}${prefix || ''}`
}

export function withAlternateSitemapLinks<T extends SitemapItem>(items: T[]): T[] {
  return items.map((item) => {
    const slug = slugForPath(item.url)
    return {
      ...item,
      links: Object.values(LOCALES).map((locale) => {
        const url = slug ? `${BASE}${locale.prefix}/${slug}` : `${BASE}${locale.prefix || '/'}`
        return { lang: locale.hreflang, url }
      })
    }
  })
}

export function applyPageSeo(pageData: PageDataLike): void {
  const localeKey = localeKeyForPath(pageData.relativePath)
  const locale = LOCALES[localeKey]
  const slug = slugForPath(pageData.relativePath)
  const pageUrl = localizedUrl(slug, locale.prefix)
  const enSlug = slug ? `${BASE}/${slug}` : BASE

  pageData.frontmatter.head ??= []
  const head = pageData.frontmatter.head

  head.push(['link', { rel: 'canonical', href: pageUrl }])
  head.push(['meta', { property: 'og:url', content: pageUrl }])
  head.push(['meta', { property: 'og:locale', content: locale.ogLocale }])

  for (const [key, loc] of Object.entries(LOCALES)) {
    if (key !== localeKey) {
      head.push(['meta', { property: 'og:locale:alternate', content: loc.ogLocale }])
    }
  }

  for (const localeOption of Object.values(LOCALES)) {
    head.push([
      'link',
      {
        rel: 'alternate',
        hreflang: localeOption.hreflang,
        href: localizedUrl(slug, localeOption.prefix)
      }
    ])
  }
  head.push(['link', { rel: 'alternate', hreflang: 'x-default', href: enSlug }])

  if (pageData.title) {
    const ogTitle = `${pageData.title} — OpenPencil`
    head.push(['meta', { property: 'og:title', content: ogTitle }])
    head.push(['meta', { name: 'twitter:title', content: ogTitle }])
  }

  if (pageData.description) {
    head.push(['meta', { property: 'og:description', content: pageData.description }])
    head.push(['meta', { name: 'twitter:description', content: pageData.description }])
    head.push(['meta', { name: 'description', content: pageData.description }])
  }
}
