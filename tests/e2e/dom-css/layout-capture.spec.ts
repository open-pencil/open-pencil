import { readFileSync } from 'node:fs'
import process from 'node:process'

import {
  createHeadlessCSSRuntime,
  type DesignDocument,
  type DesignElement,
  type DesignNode
} from '@open-pencil/dom-css'

import { browserImportedLayers, browserRuntimeComputeStyles } from '#tests/helpers/dom-css-browser'
import { testPath } from '#tests/helpers/paths'

import { expect, test } from '../fixtures'

const VIEWPORT = { width: 800, height: 600 }

function elements(nodes: readonly DesignNode[]): DesignElement[] {
  return nodes.flatMap((node) =>
    node.type === 'element' ? [node, ...elements(node.children)] : []
  )
}

function byId(document: DesignDocument, id: string): DesignElement {
  const element = elements(document.children).find((node) => node.attrs.id === id)
  if (!element) throw new Error(`No element #${id}`)
  return element
}

function captured(
  page: Parameters<typeof browserRuntimeComputeStyles>[0],
  html: string,
  css: string
) {
  const document = createHeadlessCSSRuntime().parseHTML(html)
  return browserRuntimeComputeStyles(page, document, css, 'iframe', {
    layout: true,
    viewport: VIEWPORT
  })
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

  test('waits for web fonts before recording layout', async ({ page }) => {
    const origin = new URL(test.info().project.use.baseURL ?? '').origin
    const font = `${origin}/@fs${process.cwd()}/packages/core/assets/CaveatVariable.woff2`
    const face = `@font-face { font-family: Hand; src: url(${JSON.stringify(font)}) format('woff2') }`
    const text = 'Handwritten words'
    const document = await captured(
      page,
      `<span id="words">${text}</span>`,
      `${face} body { margin: 0 } #words { display: inline-block; font: 40px Hand, monospace }`
    )
    // The same words measured once the font has certainly loaded.
    const loaded = await page.evaluate(
      async ({ css, words }) => {
        const style = window.document.createElement('style')
        style.textContent = `${css} #probe { display: inline-block; font: 40px Hand, monospace }`
        const probe = window.document.createElement('span')
        probe.id = 'probe'
        probe.textContent = words
        window.document.head.append(style)
        window.document.body.append(probe)
        await window.document.fonts.load('40px Hand')
        const width = probe.getBoundingClientRect().width
        probe.remove()
        style.remove()
        return width
      },
      { css: face, words: text }
    )

    expect(byId(document, 'words').layout?.box.width).toBeCloseTo(loaded, 0)
  })

  test('waits for images before recording layout', async ({ page }) => {
    // Served late, so layout is read before the image arrives unless it waits for it.
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="30"></svg>'
    await page.route('https://images.test/late.svg', async (route) => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 500)
      })
      await route.fulfill({ contentType: 'image/svg+xml', body: svg })
    })
    const document = await captured(
      page,
      '<img id="pic" src="https://images.test/late.svg"><div id="after"></div>',
      'body { margin: 0 } img { display: block } #after { height: 10px }'
    )

    expect(byId(document, 'pic').layout?.box).toEqual({ x: 0, y: 0, width: 50, height: 30 })
    expect(byId(document, 'after').layout?.box.y).toBe(30)
  })

  test('loads lazy images below the view before recording layout', async ({ page }) => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"></svg>'
    await page.route('https://images.test/lazy.svg', async (route) => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 300)
      })
      await route.fulfill({ contentType: 'image/svg+xml', body: svg })
    })
    const document = await captured(
      page,
      '<div id="spacer"></div><img id="lazy" loading="lazy" src="https://images.test/lazy.svg">',
      'body { margin: 0 } #spacer { height: 3000px } img { display: block }'
    )

    expect(byId(document, 'lazy').layout?.box).toEqual({ x: 0, y: 3000, width: 40, height: 20 })
  })

  test('leaves layout out unless asked', async ({ page }) => {
    const document = createHeadlessCSSRuntime().parseHTML('<div id="plain"></div>')
    const computed = await browserRuntimeComputeStyles(page, document, '', 'iframe')

    expect(byId(computed, 'plain').layout).toBeUndefined()
  })
})

test.describe('HTML import from the browser layout', () => {
  const landing = readFileSync(testPath('fixtures', 'dom-css', 'landing.html'), 'utf8')

  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 600, height: 800 }
  ]) {
    test(`puts each element's layer where the browser laid it out at ${viewport.width}px`, async ({
      page
    }) => {
      const layers = await browserImportedLayers(page, landing, viewport)

      expect(layers.map((layer) => layer.id)).toEqual(
        expect.arrayContaining(['nav', 'hero', 'title', 'cta', 'art', 'cards', 'media', 'card-3'])
      )
      for (const { id, captured, layer } of layers) {
        for (const key of ['x', 'y', 'width', 'height'] as const) {
          expect(Math.abs(layer[key] - captured[key]), `${id} ${key}`).toBeLessThanOrEqual(1)
        }
      }
    })
  }

  test('follows the page’s media queries at the import viewport', async ({ page }) => {
    const wide = await browserImportedLayers(page, landing, { width: 1280, height: 800 })
    const narrow = await browserImportedLayers(page, landing, { width: 600, height: 800 })
    const art = (layers: typeof wide) => layers.find((layer) => layer.id === 'art')?.layer
    const copy = (layers: typeof wide) => layers.find((layer) => layer.id === 'copy')?.layer

    // Two grid columns side by side when wide; one column, art below the copy, when narrow.
    expect(art(wide)?.y).toBe(copy(wide)?.y)
    expect(art(narrow)?.y).toBeGreaterThan((copy(narrow)?.y ?? 0) + (copy(narrow)?.height ?? 0))
  })
})
