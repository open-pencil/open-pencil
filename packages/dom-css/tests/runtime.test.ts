import { describe, expect, it } from 'bun:test'

import { exportHTMLBundle } from '#dom-css/export/bundle'
import { serializeHTML } from '#dom-css/export/html'

import { createCSSRuntime } from '@open-pencil/dom-css'
import { cardDocument, simpleCardDocument } from '@open-pencil/test-support/dom-css'

describe('@open-pencil/dom-css runtime', () => {
  it('serializes DesignDOM as HTML', () => {
    expect(serializeHTML(cardDocument)).toContain('<article class="card">')
    expect(serializeHTML(cardDocument)).toContain('OpenPencil')
  })

  it('keeps images with invalid Base64 inline instead of extracting them', async () => {
    const src = 'data:image/png;base64,A!QID'
    const bundle = await exportHTMLBundle(
      {
        type: 'document',
        children: [{ type: 'element', tagName: 'img', attrs: { src }, children: [] }]
      },
      { html: 'standalone', assets: 'external' }
    )
    const page = bundle.files.find((file) => file.path === bundle.entrypoint)

    expect(bundle.files.some((file) => file.path.includes('/images/'))).toBe(false)
    expect(String(page?.content)).toContain(src)
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
    const bundle = await exportHTMLBundle(cardDocument, { html: 'standalone' })
    const html = String(bundle.files[0]?.content)

    expect(html).toContain('<!doctype html>')
    expect(html).toContain('data-open-pencil-html="standalone"')
    expect(html).toContain('OpenPencil')
    expect(html).not.toContain('@tailwindcss/browser@4')
  })

  it('precompiles Tailwind CSS for standalone Tailwind HTML', async () => {
    const bundle = await exportHTMLBundle(cardDocument, { html: 'standalone', style: 'tailwind' })
    const html = String(bundle.files[0]?.content)

    expect(html).toContain('<style>')
    expect(html).not.toContain('@tailwindcss/browser@4')
  })

  it('has no runtime to default to outside a browser', () => {
    expect(() => createCSSRuntime()).toThrow('createHTMLEngineRuntime')
  })
})

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
})
