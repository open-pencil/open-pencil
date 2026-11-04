import {
  createHeadlessCSSRuntime,
  type DesignDocument,
  type DesignElement,
  type DesignNode
} from '@open-pencil/dom-css'

import { browserRuntimeComputeStyles } from '#tests/helpers/dom-css-browser'

import { expect, test } from '../fixtures'

const VIEWPORT = { width: 800, height: 600 }

function elements(nodes: readonly DesignNode[]): DesignElement[] {
  return nodes.flatMap((node) => (node.type === 'element' ? [node, ...elements(node.children)] : []))
}

function byId(document: DesignDocument, id: string): DesignElement {
  const element = elements(document.children).find((node) => node.attrs.id === id)
  if (!element) throw new Error(`No element #${id}`)
  return element
}

function captured(page: Parameters<typeof browserRuntimeComputeStyles>[0], html: string, css: string) {
  const document = createHeadlessCSSRuntime().parseHTML(html)
  return browserRuntimeComputeStyles(page, document, css, 'iframe', { layout: true, viewport: VIEWPORT })
}

test.describe('@open-pencil/dom-css browser layout capture', () => {
  test('records grid and flex boxes in document coordinates', async ({ page }) => {
    const document = await captured(
      page,
      `<section id="grid"><div id="a"></div><div id="b"></div></section>
       <div id="row"><span id="c">x</span><span id="d">y</span></div>`,
      `body { margin: 0 }
       #grid { display: grid; grid-template-columns: 100px 1fr; gap: 20px; padding: 10px; height: 50px }
       #row { display: flex; gap: 8px; padding-left: 50vw }
       #row span { display: block; width: 30px; height: 30px }`
    )

    expect(byId(document, 'grid').layout?.box).toEqual({ x: 0, y: 0, width: 800, height: 70 })
    expect(byId(document, 'a').layout?.box).toEqual({ x: 10, y: 10, width: 100, height: 50 })
    expect(byId(document, 'b').layout?.box).toEqual({ x: 130, y: 10, width: 660, height: 50 })
    expect(byId(document, 'c').layout?.box).toEqual({ x: 400, y: 70, width: 30, height: 30 })
    expect(byId(document, 'd').layout?.box).toEqual({ x: 438, y: 70, width: 30, height: 30 })
  })

  test('applies body rules to the top-level elements', async ({ page }) => {
    const document = await captured(
      page,
      `<header id="h"></header><main id="m"></main>`,
      `body { display: flex; gap: 10px; margin: 0 }
       body > * { width: 40px; height: 20px }`
    )

    expect(byId(document, 'h').layout?.box).toEqual({ x: 0, y: 0, width: 40, height: 20 })
    expect(byId(document, 'm').layout?.box).toEqual({ x: 50, y: 0, width: 40, height: 20 })
  })

  test('records boxes before transforms and keeps the computed transform', async ({ page }) => {
    const document = await captured(
      page,
      `<div id="turned"></div>`,
      `body { margin: 0 }
       #turned { width: 100px; height: 40px; margin: 20px; transform: rotate(45deg); transition: transform 1s }`
    )
    const turned = byId(document, 'turned')

    expect(turned.layout?.box).toEqual({ x: 20, y: 20, width: 100, height: 40 })
    expect(turned.computedStyle?.transform).toMatch(/^matrix\(0\.707/)
  })

  test('records inline fragments and the lines of text', async ({ page }) => {
    const document = await captured(
      page,
      `<p id="p">aaaa <b id="b">bbbb cccc</b> dddd</p>`,
      `body { margin: 0 }
       p { margin: 0; width: 4ch; font: 20px/30px monospace }`
    )
    const paragraph = byId(document, 'p')
    const bold = byId(document, 'b')

    const lines = paragraph.layout?.lines ?? []
    expect(lines).toHaveLength(4)
    expect(lines.map((line) => Math.round(line.y - lines[0].y))).toEqual([0, 30, 60, 90])
    expect(lines.every((line) => line.x === 0)).toBe(true)

    const fragments = bold.layout?.fragments ?? []
    expect(fragments).toHaveLength(2)
    expect(fragments.map((fragment) => Math.round(fragment.y - lines[0].y))).toEqual([30, 60])
    expect(bold.layout?.lines).toBeUndefined()
  })

  test('leaves layout out unless asked', async ({ page }) => {
    const document = createHeadlessCSSRuntime().parseHTML('<div id="plain"></div>')
    const computed = await browserRuntimeComputeStyles(page, document, '', 'iframe')

    expect(byId(computed, 'plain').layout).toBeUndefined()
  })
})
