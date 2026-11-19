import { parseHTMLDocument, type DesignNode } from '@open-pencil/dom-css'

import { expect, test } from '#tests/e2e/fixtures'
import { browserRuntimeComputeStyles } from '#tests/helpers/dom-css/browser'

test.describe('@open-pencil/dom-css browser runtime properties', () => {
  test('reports the properties the importer reads from a stylesheet, as the HTML engine does', async ({
    page
  }) => {
    await page.goto('/')
    const document = parseHTMLDocument(
      `<table id="table"><caption id="caption">Caption</caption><tr><td id="cell">Cell</td></tr></table>
      <div id="grid"><p id="item">Item</p></div>
      <svg><path id="shape" d="M0 0h1v1z"/></svg>`
    )
    const css = `
      #table { border-collapse: collapse; border-spacing: 2px 4px }
      #caption { caption-side: bottom }
      #shape { fill: #0000ff; stroke-width: 2 }
      #cell { vertical-align: bottom }
      #grid { display: grid; grid-template-columns: 40px 60px; justify-items: center }
      #item { flex-grow: 2; margin-top: 6px; text-decoration-style: dashed; justify-self: end; grid-column: span 2 }
    `
    const computed = await browserRuntimeComputeStyles(page, document, css)
    const style = (id: string) => {
      const walk = (nodes: readonly DesignNode[]): DesignNode | undefined =>
        nodes.find((node) => node.type === 'element' && node.attrs.id === id) ??
        nodes
          .flatMap((node) => (node.type === 'element' ? [walk(node.children)] : []))
          .find(Boolean)
      const element = walk(computed.children)
      return element?.type === 'element' ? (element.computedStyle ?? {}) : {}
    }

    expect(style('table')).toMatchObject({
      'border-collapse': 'collapse',
      'border-spacing': '2px 4px'
    })
    expect(style('caption')['caption-side']).toBe('bottom')
    expect(style('shape')).toMatchObject({ fill: 'rgb(0, 0, 255)', 'stroke-width': '2px' })
    expect(style('cell')['vertical-align']).toBe('bottom')
    expect(style('grid')).toMatchObject({
      'grid-template-columns': '40px 60px',
      'justify-items': 'center'
    })
    expect(style('item')).toMatchObject({
      'justify-self': 'end',
      'grid-column-start': 'span 2',
      'flex-grow': '2',
      'margin-top': '6px',
      'text-decoration-style': 'dashed'
    })
  })
})
