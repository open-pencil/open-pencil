import cssesc from 'cssesc'

/** A `<link>` that loads a stylesheet: the URL, and the media query it applies under, if any. */
export interface LinkedStylesheet {
  href: string
  media?: string
}

/**
 * The stylesheet a `<link>`, read through `attribute`, loads, unless it is an alternate one. A
 * media query that could end the `@import` rule it goes into, holding `;`, `{`, or `}`, is no
 * media query, so its sheet is left out.
 */
export function linkedStylesheet(
  attribute: (name: string) => string | null | undefined
): LinkedStylesheet | null {
  const rel = attribute('rel')?.toLowerCase().split(/\s+/) ?? []
  if (!rel.includes('stylesheet') || rel.includes('alternate')) return null
  const href = attribute('href')?.trim()
  const media = attribute('media')?.trim()
  if (!href || (media && /[;{}]/.test(media))) return null
  return media ? { href, media } : { href }
}

/**
 * Linked stylesheets as `@import` rules, in document order, each with its `media` query, which
 * the runtime evaluates for the viewport it lays the page out in.
 */
export function stylesheetImportRules(sheets: readonly LinkedStylesheet[]): string | undefined {
  if (sheets.length === 0) return undefined
  return sheets
    .map(({ href, media }) => {
      const url = `url(${cssesc(href, { quotes: 'double', wrap: true })})`
      return `@import ${url}${media ? ` ${media}` : ''};`
    })
    .join('\n')
}
