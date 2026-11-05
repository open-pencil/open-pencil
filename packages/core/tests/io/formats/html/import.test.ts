import { beforeAll, describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import { FIXTURES } from '@open-pencil/test-support/paths'

import { readHTMLDocument } from '#core/io/formats/html/import'
import { fontManager } from '#core/text/font/manager'

/** A family the tests give the font manager a font for, so which text finds a font does not depend on the machine. */
const TEST_FAMILY = 'OpenPencil Test Sans'

beforeAll(async () => {
  const font = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).arrayBuffer()
  await fontManager.markLoaded(TEST_FAMILY, 'Regular', font)
})

// The layout from #788: a phone-sized column with a title, a card, and a button.
const DEMO = `<div style="width:390px;height:844px;background:#0b0f1a;display:flex;flex-direction:column;padding:24px;gap:16px">
  <div style="font-size:28px;font-weight:700;color:#fff">D-claro</div>
  <div style="background:#151b2b;border-radius:16px;padding:20px;color:#fff">Saldo disponible</div>
  <button style="background:#2563eb;border-radius:12px;padding:14px;color:#fff">Enviar dinero</button>
</div>`

describe('reading HTML', () => {
  test('lays out block children and flex items as a browser does', async () => {
    const { graph } = await readHTMLDocument(DEMO)
    const node = (id: string | undefined) => {
      const found = id === undefined ? undefined : graph.getNode(id)
      if (!found) throw new Error(`Missing layer ${id}`)
      return found
    }
    const column = node(graph.getPages()[0]?.childIds[0])
    const [title, card, button] = column.childIds.map(node)

    // Padding sits outside the 390px width, as CSS's content-box sizing puts it, and each
    // child fills that width, one below the other 16px apart.
    expect(column).toMatchObject({ width: 438, height: 892 })
    expect(title).toMatchObject({ x: 24, y: 24, width: 390 })
    expect(card).toMatchObject({ x: 24, y: title.y + title.height + 16, width: 390 })
    expect(button).toMatchObject({ x: 24, y: card.y + card.height + 16, width: 390 })

    // The card wraps its padding around the text, and the button centers its label.
    const cardText = node(card.childIds[0])
    expect(cardText).toMatchObject({ x: 20, y: 20 })
    expect(card.height).toBe(cardText.height + 40)
    // Centered where the engine set the line; Core measures the same font within a pixel of it.
    const label = node(button.childIds[0])
    expect(Math.abs(label.x * 2 + label.width - 390)).toBeLessThanOrEqual(1)
  })

  test('a border takes room inside the box, as in a browser', async () => {
    const { graph } = await readHTMLDocument(
      '<div style="display:inline-flex;padding:10px;border:4px solid #000"><div style="width:50px;height:50px;background:#f00"></div></div>'
    )
    const box = graph.getChildren(graph.getPages()[0].id)[0]
    const inner = graph.getChildren(box.id)[0]

    expect(box).toMatchObject({ strokesIncludedInLayout: true, width: 78, height: 78 })
    expect(inner).toMatchObject({ x: 14, y: 14 })
  })

  test('a border without a style is not drawn and takes no room', async () => {
    const { graph } = await readHTMLDocument(
      '<div style="display:inline-flex;padding:10px;border-width:4px;border-color:#000;border-style:none"><div style="width:50px;height:50px;background:#f00"></div></div>'
    )
    const box = graph.getChildren(graph.getPages()[0].id)[0]

    expect(box).toMatchObject({ strokes: [], width: 70, height: 70 })
  })

  test('a transform turns and moves the layer as it does the element', async () => {
    const { graph } = await readHTMLDocument(
      `<div style="display:flex;gap:10px">
        <div style="width:100px;height:50px;transform:rotate(30deg)"></div>
        <div style="width:100px;height:50px;transform:rotate(90deg);transform-origin:left top"></div>
        <div style="width:20px;height:20px;scale:-1 1"></div>
      </div>`
    )
    const row = graph.getChildren(graph.getPages()[0].id)[0]
    const [centered, cornered, mirrored] = graph.getChildren(row.id)

    // A turn about the center leaves the box, and the row's auto layout, where they were.
    expect(centered.rotation).toBeCloseTo(30)
    expect(centered).toMatchObject({ x: 0, y: 0 })
    // A turn about a corner moves the box; the row keeps its siblings where CSS left them.
    expect(cornered.rotation).toBeCloseTo(90)
    expect(cornered).toMatchObject({ x: 35, y: 25 })
    expect(row.layoutMode).toBe('NONE')
    expect(mirrored).toMatchObject({ x: 220, flipX: true, rotation: 0 })
  })

  test('a skew neither turns nor mirrors the layer', async () => {
    const { graph } = await readHTMLDocument(
      '<div style="width:100px;height:50px;transform:skewY(30deg)"></div>'
    )
    const box = graph.getChildren(graph.getPages()[0].id)[0]

    expect(box).toMatchObject({ rotation: 0, flipX: false })
  })

  test('text CSS does not wrap stays on one line however narrow its box', async () => {
    const { graph } = await readHTMLDocument(
      '<div style="width:100px;font-size:16px"><div style="white-space:nowrap">a long line of text that overflows</div></div>'
    )
    const box = graph.getChildren(graph.getPages()[0].id)[0]
    const text = graph.flattenTree(box.id).find(({ node }) => node.type === 'TEXT')?.node

    expect(text?.textAutoResize).toBe('WIDTH_AND_HEIGHT')
    expect(text?.width).toBeGreaterThan(100)
  })

  test('text keeps to one line when its box sets text-wrap-mode: nowrap', async () => {
    const { graph } = await readHTMLDocument(
      '<div style="width:100px;font-size:16px;text-wrap-mode:nowrap">a long line of text that overflows</div>'
    )
    const box = graph.getChildren(graph.getPages()[0].id)[0]
    const text = graph.flattenTree(box.id).find(({ node }) => node.type === 'TEXT')?.node

    expect(text?.textAutoResize).toBe('WIDTH_AND_HEIGHT')
  })

  test('applies media queries for the viewport it imports at', async () => {
    const { graph } = await readHTMLDocument(
      `<style>@media (max-width: 700px) { nav { display: none } } nav { height: 40px }</style>
      <nav>Menu</nav><main style="height:100px"></main>`
    )
    const layers = graph.getChildren(graph.getPages()[0].id)

    // At 1440px the narrow-screen rule does not apply, so the nav stays.
    expect(layers.map((layer) => layer.name)).toEqual(['nav', 'main'])
  })

  test('reads the stylesheets a page links through the host', async () => {
    const requested: string[] = []
    const { graph } = await readHTMLDocument(
      '<link rel="stylesheet" href="styles/site.css"><div class="box"></div>',
      {
        readAsset: async (path) => {
          requested.push(path)
          return path === 'styles/site.css'
            ? new TextEncoder().encode('.box { width: 120px; height: 40px }')
            : null
        }
      }
    )
    const box = graph.getChildren(graph.getPages()[0].id)[0]

    expect(requested).toEqual(['styles/site.css'])
    expect(box).toMatchObject({ width: 120, height: 40 })
  })

  test('draws text in the font its page loads with @font-face', async () => {
    const family = 'OpenPencil Page Brand'
    const font = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).bytes()
    const { graph } = await readHTMLDocument(
      `<style>@font-face { font-family: '${family}'; src: url(fonts/brand.ttf) }</style>
      <p style="font-family: '${family}', sans-serif">Brand</p>`,
      { readAsset: async (path) => (path === 'fonts/brand.ttf' ? font : null) }
    )
    const text = graph.flattenTree(graph.getPages()[0].id).find(({ node }) => node.type === 'TEXT')

    expect(text?.node.fontFamily).toBe(family)
    expect(fontManager.loadedFontSource(family, 'Regular')).toBe('registered')
  })

  test('takes a family for the face its text asks for, not only the regular one', async () => {
    const bold = 'OpenPencil Bold Only'
    await fontManager.markLoaded(
      bold,
      'Bold',
      await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).arrayBuffer()
    )
    const { graph } = await readHTMLDocument(
      `<p style="font-family:'${bold}', sans-serif;font-weight:700">Bold</p>`
    )
    const text = graph.flattenTree(graph.getPages()[0].id).find(({ node }) => node.type === 'TEXT')

    expect(text?.node.fontFamily).toBe(bold)
  })

  test('matches a page font by name without regard to case, as CSS does', async () => {
    const font = await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).bytes()
    const { graph } = await readHTMLDocument(
      `<style>@font-face { font-family: 'OpenPencil Cased'; src: url(cased.ttf) }</style>
      <p style="font-family: 'openpencil cased', sans-serif">Cased</p>`,
      { readAsset: async (path) => (path === 'cased.ttf' ? font : null) }
    )
    const text = graph.flattenTree(graph.getPages()[0].id).find(({ node }) => node.type === 'TEXT')

    expect(text?.node.fontFamily).toBe('OpenPencil Cased')
  })

  test('styles a page twice from the same stylesheets', async () => {
    // A family the engine has not been given, so the page is styled a second time with it.
    const family = 'OpenPencil Second Pass'
    await fontManager.markLoaded(
      family,
      'Regular',
      await Bun.file(join(FIXTURES, 'fonts', 'InterVariable-Latin.ttf')).arrayBuffer()
    )
    let reads = 0
    const { graph } = await readHTMLDocument(
      `<link rel="stylesheet" href="once.css"><div class="box"></div><p style="font-family:'${family}'">Text</p>`,
      {
        readAsset: async (path) => {
          if (path !== 'once.css') return null
          reads++
          // A second read would lose the rule, as a network that fails the second time does.
          return reads === 1 ? new TextEncoder().encode('.box { width: 300px; height: 10px }') : null
        }
      }
    )
    const box = graph.getChildren(graph.getPages()[0].id)[0]

    expect(reads).toBe(1)
    expect(box).toMatchObject({ width: 300, height: 10 })
  })

  test('imports a page whose resources are malformed or too large', async () => {
    const requested: string[] = []
    const { graph } = await readHTMLDocument(
      `<link rel="stylesheet" href="a%zz.css"><link rel="stylesheet" href="huge.css">
      <div class="box" style="width:50px;height:20px"></div>`,
      {
        readAsset: async (path) => {
          requested.push(path)
          // One byte over the limit a resource may hold.
          return new TextEncoder().encode(`.box { width: 300px }${' '.repeat(64 * 1024 * 1024)}`)
        }
      }
    )
    const box = graph.getChildren(graph.getPages()[0].id)[0]

    // The malformed URL never reaches the host, and the huge stylesheet is left out.
    expect(requested).toEqual(['huge.css'])
    expect(box).toMatchObject({ width: 50, height: 20 })
  })

  test('text is set in the first family of its list there is a font for, as in a browser', async () => {
    const { graph } = await readHTMLDocument(
      `<p style="font-family:'No Such Family', '${TEST_FAMILY}', sans-serif">Found</p>
      <p style="font-family:system-ui, -apple-system, sans-serif">Generic</p>
      <p style="font-family:'No Such Family'">Missing</p>`
    )
    const families = graph
      .flattenTree(graph.getPages()[0].id)
      .filter(({ node }) => node.type === 'TEXT')
      .map(({ node }) => node.fontFamily)

    // A generic family takes the real one it maps to, and a list with no font the default.
    expect(families).toEqual([TEST_FAMILY, 'Inter', 'Inter'])
  })
})

