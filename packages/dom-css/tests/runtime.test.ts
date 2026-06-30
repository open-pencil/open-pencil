import { describe, expect, it } from 'bun:test'

import { createCSSRuntime, createHeadlessCSSRuntime, serializeHTML } from '../src/index'
import { cardDocument, TEST_COLORS } from './helpers'

describe('@open-pencil/dom-css runtime', () => {
  it('serializes DesignDOM as HTML', () => {
    expect(serializeHTML(cardDocument)).toContain('<article class="card">')
    expect(serializeHTML(cardDocument)).toContain('OpenPencil')
  })

  it('uses the headless runtime outside browser contexts', () => {
    const runtime = createCSSRuntime()

    expect(runtime.kind).toBe('headless')
    expect(runtime.serializeHTML(cardDocument)).toContain('OpenPencil')
  })

  it('parses HTML with inline styles', () => {
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

  it('parses inline style values with embedded semicolons', () => {
    const runtime = createHeadlessCSSRuntime()
    const document = runtime.parseHTML(
      '<section style="background-image: url(\'data:image/svg+xml;utf8,<svg></svg>\'); width: 320px">OpenPencil</section>'
    )
    const section = document.children[0]

    expect(section?.type).toBe('element')
    if (section?.type !== 'element') return
    expect(section.inlineStyle?.['background-image']).toBe(
      "url('data:image/svg+xml;utf8,<svg></svg>')"
    )
    expect(section.inlineStyle?.width).toBe('320px')
  })

  it('computes selector specificity, inheritance, and shorthands', async () => {
    const runtime = createHeadlessCSSRuntime()
    const parsed = runtime.parseHTML(`
      <article id="hero" class="card featured">
        <header><h1 class="title">OpenPencil</h1></header>
      </article>
    `)
    const document = await runtime.computeStyles(
      parsed,
      `
        article { color: ${TEST_COLORS.slate900}; padding: 8px 16px; }
        .card { width: 300px; color: ${TEST_COLORS.slate700}; }
        article.card > header { gap: 12px; }
        .card .title { font-size: 24px; }
        #hero { width: 320px; background: white; }
      `
    )
    const card = document.children[0]

    expect(card?.type).toBe('element')
    if (card?.type !== 'element') return
    expect(card.computedStyle?.width).toBe('320px')
    expect(card.computedStyle?.color).toBe(TEST_COLORS.slate700)
    expect(card.computedStyle?.['padding-right']).toBe('16px')

    const header = card.children.find((child) => child.type === 'element')
    expect(header?.type).toBe('element')
    if (header?.type !== 'element') return
    expect(header.computedStyle?.gap).toBe('12px')
    expect(header.computedStyle?.color).toBe(TEST_COLORS.slate700)
  })
})
