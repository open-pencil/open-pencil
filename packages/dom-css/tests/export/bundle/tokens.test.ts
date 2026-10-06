import { describe, expect, test } from 'bun:test'

import { exportHTMLBundle, sceneNodeToDesignDocument } from '#dom-css/export/index'

import { BLUE_500, card, designSystem } from '../token-fixtures'

async function standalone(style: 'inline' | 'tailwind') {
  const graph = designSystem()
  const frame = card(graph, graph.getPages()[0].id, BLUE_500)
  const bundle = await exportHTMLBundle(sceneNodeToDesignDocument(graph, frame.id), {
    html: 'standalone',
    style
  })
  const page = bundle.files.find((file) => file.path === bundle.entrypoint)
  if (typeof page?.content !== 'string') throw new Error('Expected an HTML page')
  return page.content
}

describe('token stylesheet in standalone HTML', () => {
  test('declares the tokens the page uses and the variables their aliases reach', async () => {
    const html = await standalone('inline')

    expect(html).toContain('--color-primary: var(--color-blue-500);')
    expect(html).toContain('--spacing-gutter: 24px;')
    // Dark points Primary at Blue/300, so its scope needs Blue/300 even though no layer is dark.
    expect(html).toContain('--color-blue-300: #94C4FC;')
    expect(html).toContain('[data-theme="dark"]')
    expect(html).not.toContain('--count')
  })

  test('compiles token utilities into Tailwind pages', async () => {
    const html = await standalone('tailwind')

    expect(html).toMatch(/class="[^"]*\bbg-primary\b/)
    expect(html).toMatch(/\.bg-primary\s*\{\s*background-color: var\(--color-primary\)/)
    expect(html).toContain('--color-primary: var(--color-blue-500);')
  })
})
