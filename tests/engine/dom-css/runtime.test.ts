import { describe, expect, it } from 'bun:test'

import {
  createCSSRuntime,
  createHeadlessCSSRuntime,
  exportHTMLBundle,
  serializeHTML
} from '@open-pencil/dom-css'

import { DOM_CSS_COLORS, simpleCardDocument } from '#tests/helpers/dom-css'

describe('@open-pencil/dom-css', () => {
  it('serializes DesignDOM as HTML', () => {
    expect(serializeHTML(simpleCardDocument)).toBe(
      '<div class="card" data-id="node-1">OpenPencil</div>'
    )
  })

  it('serializes inline styles as Tailwind classes when requested', () => {
    const html = serializeHTML(
      {
        type: 'document',
        children: [
          {
            type: 'element',
            tagName: 'section',
            attrs: { class: 'card' },
            inlineStyle: {
              display: 'flex',
              padding: '16px',
              gap: '8px',
              'background-color': 'white'
            },
            children: [{ type: 'text', text: 'OpenPencil' }]
          }
        ]
      },
      { style: 'tailwind' }
    )

    expect(html).toBe('<section class="card flex p-4 gap-2 bg-white">OpenPencil</section>')
  })

  it('exports standalone HTML documents when requested', async () => {
    const bundle = await exportHTMLBundle(simpleCardDocument, { html: 'standalone' })
    const html = String(bundle.files[0]?.content)

    expect(html).toContain('<!doctype html>')
    expect(html).toContain('data-open-pencil-html="standalone"')
    expect(html).toContain('OpenPencil')
    expect(html).not.toContain('@tailwindcss/browser@4')
  })

  it('precompiles Tailwind CSS for standalone Tailwind HTML', async () => {
    const bundle = await exportHTMLBundle(simpleCardDocument, {
      html: 'standalone',
      style: 'tailwind'
    })
    const html = String(bundle.files[0]?.content)

    expect(html).toContain('<style>')
    expect(html).not.toContain('@tailwindcss/browser@4')
  })

  it('uses the headless runtime outside browser contexts', () => {
    const runtime = createCSSRuntime()

    expect(runtime.kind).toBe('headless')
    expect(runtime.serializeHTML(simpleCardDocument)).toBe(
      '<div class="card" data-id="node-1">OpenPencil</div>'
    )
  })

  it('parses HTML with the headless runtime', () => {
    const runtime = createHeadlessCSSRuntime()
    const document = runtime.parseHTML(
      '<section class="card" style="width: 320px; color: rgb(17, 24, 39)">OpenPencil</section>'
    )
    const section = document.children[0]

    expect(section?.type).toBe('element')
    if (section?.type !== 'element') return
    expect(section.tagName).toBe('section')
    expect(section.attrs.class).toBe('card')
    expect(section.inlineStyle?.width).toBe('320px')
    expect(section.inlineStyle?.color).toBe('rgb(17, 24, 39)')
    expect(section.children[0]).toEqual({ type: 'text', text: 'OpenPencil' })
  })

  it('computes simple headless styles from CSSOM rules', async () => {
    const runtime = createHeadlessCSSRuntime()
    const document = await runtime.computeStyles(
      simpleCardDocument,
      `.card { width: 320px; color: ${DOM_CSS_COLORS.slate900}; } #missing { color: red; }`
    )
    const card = document.children[0]

    expect(card?.type).toBe('element')
    if (card?.type !== 'element') return
    expect(card.computedStyle?.width).toBe('320px')
    expect(card.computedStyle?.color).toBe(DOM_CSS_COLORS.slate900)
  })

  it('applies specificity, descendant selectors, child selectors, inheritance, and shorthands', async () => {
    const runtime = createHeadlessCSSRuntime()
    const parsed = runtime.parseHTML(`
      <article id="hero" class="card featured">
        <header><h1 class="title">OpenPencil</h1></header>
      </article>
    `)
    const document = await runtime.computeStyles(
      parsed,
      `
        article { color: ${DOM_CSS_COLORS.slate900}; padding: 8px 16px; }
        .card { width: 300px; color: ${DOM_CSS_COLORS.slate700}; }
        article.card > header { gap: 12px; }
        .card .title { font-size: 24px; }
        #hero { width: 320px; background: white; }
      `
    )
    const card = document.children[0]

    expect(card?.type).toBe('element')
    if (card?.type !== 'element') return
    expect(card.computedStyle?.width).toBe('320px')
    expect(card.computedStyle?.color).toBe(DOM_CSS_COLORS.slate700)
    expect(card.computedStyle?.['padding-top']).toBe('8px')
    expect(card.computedStyle?.['padding-right']).toBe('16px')
    expect(card.computedStyle?.['background-color']).toBe('white')

    const header = card.children.find((child) => child.type === 'element')
    expect(header?.type).toBe('element')
    if (header?.type !== 'element') return
    expect(header.computedStyle?.gap).toBe('12px')
    expect(header.computedStyle?.color).toBe(DOM_CSS_COLORS.slate700)

    const title = header.children[0]
    expect(title?.type).toBe('element')
    if (title?.type !== 'element') return
    expect(title.computedStyle?.['font-size']).toBe('24px')
    expect(title.computedStyle?.color).toBe(DOM_CSS_COLORS.slate700)
  })
})
