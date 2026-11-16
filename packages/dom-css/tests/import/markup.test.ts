import { describe, expect, it } from 'bun:test'

import { parseHTMLDocument } from '#dom-css/import/markup'

describe('parseHTMLDocument', () => {
  it('parses HTML with inline styles', () => {
    const document = parseHTMLDocument(
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
    const document = parseHTMLDocument(
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

  it('leaves out what draws nothing and whitespace between blocks', () => {
    const document = parseHTMLDocument(
      '<style>p { color: red }</style>\n<div>A</div>\n  <script>x()</script><div>B <b>bold</b></div>'
    )

    expect(
      document.children.map((child) => (child.type === 'element' ? child.tagName : child.text))
    ).toEqual(['div', 'div'])
    const second = document.children[1]
    expect(
      second?.type === 'element'
        ? second.children.map((c) => (c.type === 'text' ? c.text : c.tagName))
        : []
    ).toEqual(['B ', 'b'])
  })
})
