import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { footerColumns } from '#docs-config/theme/footer/links'
import { FOOTER_MESSAGES } from '#docs-config/theme/footer/messages'

const DOCS = join(import.meta.dir, '../../../../packages/docs')

/** The Markdown page a site path is built from, without its `#` section. */
function pageFile(path: string): string {
  const [pathname = ''] = path.split('#')
  return join(DOCS, pathname.endsWith('/') ? `${pathname}index.md` : `${pathname}.md`)
}

describe('site footer', () => {
  test.each(Object.entries(FOOTER_MESSAGES))(
    '%s links only to pages that exist',
    (locale, messages) => {
      const internal = footerColumns(messages, locale)
        .flatMap((column) => column.links)
        .filter((link) => link.href.startsWith('/'))
      expect(internal.length).toBeGreaterThan(0)
      for (const link of internal) expect(existsSync(pageFile(link.href)), link.href).toBe(true)
    }
  )

  test('links inside the locale only to translated pages', () => {
    const hrefs = footerColumns(FOOTER_MESSAGES.de, 'de').flatMap((column) =>
      column.links.map((link) => link.href)
    )
    expect(hrefs).toContain('/de/download')
    expect(hrefs).toContain('/cloud/legal/terms')
  })
})
