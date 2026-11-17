import { beforeAll, describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import type { SceneNode } from '@open-pencil/scene-graph'
import { readIcon } from '@open-pencil/scene-graph/icons'
import { layoutSizing } from '@open-pencil/scene-graph/layout'
import { FIXTURES } from '@open-pencil/test-support/paths'

import { iconColor } from '#core/icons'
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

  test('keeps sizes the page left to layout as fill and hug, and fixes those it set', async () => {
    const { graph } = await readHTMLDocument(DEMO)
    const node = (id: string | undefined) => {
      const found = id === undefined ? undefined : graph.getNode(id)
      if (!found) throw new Error(`Missing layer ${id}`)
      return found
    }
    const sizing = (id: string | undefined) => {
      const layer = node(id)
      return [layoutSizing(graph, layer, 'HORIZONTAL'), layoutSizing(graph, layer, 'VERTICAL')]
    }
    const column = node(graph.getPages()[0]?.childIds[0])
    const [, card] = column.childIds

    // The column sets its width and height; the card stretches across and hugs its text.
    expect(sizing(column.id)).toEqual(['FIXED', 'FIXED'])
    expect(sizing(card)).toEqual(['FILL', 'HUG'])
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

  test('keeps a table with collapsed borders in auto layout, drawing each shared border once', async () => {
    const { graph } = await readHTMLDocument(
      `<table style="border-collapse:collapse;width:300px;font-family:'${TEST_FAMILY}'">
        <tr><td style="border:1px solid #000;padding:8px">Name</td><td style="border:1px solid #000;padding:8px">Value</td></tr>
        <tr><td style="border:1px solid #000;padding:8px">Alpha</td><td style="border:1px solid #000;padding:8px">1</td></tr>
      </table>`
    )
    const frames = graph
      .flattenTree(graph.getPages()[0].id)
      .map(({ node }) => node)
      .filter((node) => node.type === 'FRAME')
    const cells = frames.filter((node) => node.name === 'td')

    // Rows and cells keep auto layout: the importer lays them out where the page did.
    expect(frames.every((node) => node.layoutMode !== 'NONE')).toBe(true)
    expect(cells.flatMap((cell) => cell.strokes.map((stroke) => stroke.align))).toEqual([
      'CENTER',
      'CENTER',
      'CENTER',
      'CENTER'
    ])
    // Neighbouring cells touch, so their centered strokes draw one line.
    const [first, second] = graph.getChildren(cells[0].parentId ?? '')
    expect(second.x).toBe(first.x + first.width)
  })

  test('keeps a table with a caption in auto layout, the caption outside its border spacing', async () => {
    const { graph } = await readHTMLDocument(
      `<table style="width:400px;border-spacing:2px;font-family:'${TEST_FAMILY}'"><caption>Totals</caption>
        <tr><td style="padding:0"><div style="width:20px;height:20px"></div></td></tr></table>`
    )
    const [table] = graph.getChildren(graph.getPages()[0].id)
    const [caption, box] = graph.getChildren(table.id)

    expect(table.layoutMode).toBe('VERTICAL')
    expect(caption).toMatchObject({ name: 'caption', x: 0, y: 0, width: 400 })
    expect(box).toMatchObject({ name: 'table box', x: 0, y: caption.height, width: 400 })
    expect(box).toMatchObject({ layoutMode: 'VERTICAL', paddingTop: 2, itemSpacing: 2 })
  })

  test('keeps the rows of a table with a cell spanning rows in auto layout', async () => {
    const box = (size: number) => `<div style="width:${size}px;height:20px"></div>`
    const { graph } = await readHTMLDocument(
      `<table style="border-spacing:2px"><tr><td rowspan="2" style="padding:0">${box(40)}</td>
        <td style="padding:0">${box(30)}</td></tr><tr><td style="padding:0">${box(30)}</td></tr></table>`
    )
    const [table] = graph.getChildren(graph.getPages()[0].id)
    const [group] = graph.getChildren(table.id)
    const [first, second] = graph.getChildren(group.id)
    const [tall, a] = graph.getChildren(first.id)
    const [b] = graph.getChildren(second.id)

    expect([first.layoutMode, second.layoutMode]).toEqual(['HORIZONTAL', 'HORIZONTAL'])
    expect(tall).toMatchObject({ layoutPositioning: 'ABSOLUTE', x: 0, height: 42 })
    // The cells beside the tall one line up in its column's right, row after row.
    expect([a.x, b.x]).toEqual([42, 42])
  })

  test('keeps a grid that centers its item by place-items in auto layout', async () => {
    const { graph } = await readHTMLDocument(
      `<div style="display:grid;place-items:center;width:400px;height:200px">` +
        `<div style="width:100px;height:50px;background:red"></div></div>`
    )
    const [grid] = graph.getChildren(graph.getPages()[0].id)
    const [item] = graph.getChildren(grid.id)

    expect(grid.layoutMode).toBe('VERTICAL')
    expect(item).toMatchObject({ x: 150, y: 75, width: 100, height: 50 })
  })

  test('keeps a grid of several columns a grid layer, with its items where the page put them', async () => {
    const cellItem = (style = '') => `<div style="background:#ccc;${style}"></div>`
    const { graph } = await readHTMLDocument(
      `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:320px">` +
        cellItem('height:40px') +
        cellItem('width:60px;height:20px') +
        cellItem() +
        cellItem('grid-column:span 2;height:20px') +
        cellItem('grid-column:span 2;width:60px;height:20px') +
        `</div>`
    )
    const [grid] = graph.getChildren(graph.getPages()[0].id)
    const boxes = graph
      .getChildren(grid.id)
      .map((item) => [item.x, item.y, item.width, item.height].map(Math.round))

    expect(grid.layoutMode).toBe('GRID')
    expect(boxes).toEqual([
      [0, 0, 100, 40],
      [110, 0, 60, 20],
      [220, 0, 100, 40],
      [0, 50, 210, 20],
      [0, 80, 60, 20]
    ])
    // A start-aligned item still covers the two columns it spans.
    expect(graph.getChildren(grid.id)[4].gridPosition).toMatchObject({ column: 1, columnSpan: 2 })
  })

  test('draws inline SVG as vectors in its color, and keeps an icon a page names as that icon', async () => {
    const { graph } = await readHTMLDocument(
      `<svg style="display:none"><symbol id="mark" viewBox="0 0 10 10"><rect width="10" height="10"/></symbol></svg>
      <div style="display:flex;gap:8px;color:#cc0000">
        <svg width="24" height="24" viewBox="0 0 24 24"><path d="M2 2h20v20H2z" fill="currentColor"/></svg>
        <svg data-icon="lucide:square" height="20" viewBox="0 0 40 20" fill="none" stroke="currentColor"><rect x="1" y="1" width="38" height="18"/></svg>
        <svg width="16" height="16"><use href="#mark"/></svg>
      </div>`
    )
    const [row] = graph.getChildren(graph.getPages()[0].id)
    const [plain, named, sprite] = graph.getChildren(row.id)
    const path = (svg: SceneNode) => {
      const [vector] = graph.getChildren(svg.id)
      return {
        type: vector.type,
        size: [vector.width, vector.height],
        paint: [...vector.fills, ...vector.strokes][0]?.color
      }
    }
    const red = { r: 0.8, g: 0, b: 0, a: 1 }

    expect(row.layoutMode).toBe('HORIZONTAL')
    expect(path(plain)).toEqual({ type: 'VECTOR', size: [20, 20], paint: red })
    // A height and a viewBox give the width, as a browser sizes the SVG.
    expect([named.width, named.height]).toEqual([40, 20])
    expect(readIcon(named)?.name).toBe('lucide:square')
    expect(readIcon(plain)).toBeNull()
    // A symbol from a sprite elsewhere in the page, fitted to the SVG drawing it.
    expect(path(sprite)).toEqual({
      type: 'VECTOR',
      size: [16, 16],
      paint: { r: 0, g: 0, b: 0, a: 1 }
    })
  })

  test('keeps an icon the matcher finds an SVG draws as that icon, in its own paths', async () => {
    const { graph } = await readHTMLDocument(
      `<div style="display:flex;gap:8px;color:#cc0000">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 4h16v16H4z"/></svg>
        <svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>
      </div>`,
      {
        matchIcon: async (svgs) =>
          svgs.map((svg) => (svg.includes('<path') ? 'lucide:square' : null))
      }
    )
    const [row] = graph.getChildren(graph.getPages()[0].id)
    const [matched, artwork] = graph.getChildren(row.id)

    expect(readIcon(matched)?.name).toBe('lucide:square')
    expect(iconColor(graph, matched)).toEqual({ r: 0.8, g: 0, b: 0, a: 1 })
    expect(graph.getChildren(matched.id)).toHaveLength(1)
    expect(readIcon(artwork)).toBeNull()
  })

  test('keeps an icon that clips its shapes as artwork, with its clip', async () => {
    const { graph } = await readHTMLDocument(
      `<svg data-icon="lucide:square" width="24" height="24" viewBox="0 0 24 24">
        <defs><clipPath id="half"><rect width="12" height="24"/></clipPath></defs>
        <rect width="24" height="24" clip-path="url(#half)"/>
      </svg>`,
      { matchIcon: async (svgs) => svgs.map(() => 'lucide:square') }
    )
    const [svg] = graph.getChildren(graph.getPages()[0].id)
    const masks = [...graph.getAllNodes()].filter((node) => node.isMask)

    expect(readIcon(svg)).toBeNull()
    expect(masks).toHaveLength(1)
  })

  test("paints inline SVG shapes as the page's CSS does, keeping their own attributes", async () => {
    const { graph } = await readHTMLDocument(
      `<style>.icon path { fill: currentColor } .outlined { stroke: #0000ff; stroke-width: 3 }</style>
      <div style="color: #cc0000"><svg class="icon" width="30" height="10" viewBox="0 0 30 10">
        <path d="M0 0h10v10H0z"/>
        <rect class="outlined" x="12" width="6" height="6" fill="none"/>
        <circle cx="25" cy="5" r="5" fill="#008000"/>
      </svg></div>`
    )
    const [box] = graph.getChildren(graph.getPages()[0].id)
    const [svg] = graph.getChildren(box.id)
    const [path, rect, circle] = graph.getChildren(svg.id)

    // A CSS rule's currentColor takes the text color.
    expect(path.fills[0]?.color).toEqual({ r: 0.8, g: 0, b: 0, a: 1 })
    expect(rect.fills).toEqual([])
    expect(rect.strokes[0]).toMatchObject({ color: { r: 0, g: 0, b: 1, a: 1 }, weight: 3 })
    expect(circle.fills[0]?.color).toMatchObject({ r: 0, g: 128 / 255, b: 0 })
  })

  test('keeps a stack whose children margins space evenly, spaced as the page did', async () => {
    const block = (margin: string) =>
      `<div style="height:20px;margin:${margin};background:#cccccc"></div>`
    const { graph } = await readHTMLDocument(
      `<div style="width:200px;display:flow-root">${block('16px 0')}${block('16px 0')}${block('16px 0')}</div>
      <div style="width:200px;display:flow-root">${block('0')}${block('-6px 0 0')}${block('-6px 0 0')}</div>`
    )
    const [spaced, overlapping] = graph.getChildren(graph.getPages()[0].id)

    // Collapsed margins leave 16 px between each two, and 16 px inside the edges.
    expect(spaced).toMatchObject({ layoutMode: 'VERTICAL', itemSpacing: 16, paddingTop: 16 })
    expect(graph.getChildren(spaced.id).map((child) => child.y)).toEqual([16, 52, 88])
    expect(overlapping).toMatchObject({ layoutMode: 'VERTICAL', itemSpacing: -6 })
    expect(graph.getChildren(overlapping.id).map((child) => child.y)).toEqual([0, 14, 28])
  })

  test('draws inline SVG with definitions, colors, and a size the page gave it elsewhere', async () => {
    const { graph } = await readHTMLDocument(
      `<style>.blue { color: #0000ff; fill: currentColor } .red { fill: #ff0000; stroke: #0000ff }</style>
      <svg style="display:none"><defs><clipPath id="half"><rect width="5" height="10"/></clipPath></defs>
        <symbol id="mark" viewBox="0 0 10 10"><rect width="10" height="10"/></symbol></svg>
      <div style="color:#cc0000">
        <svg width="10" height="10"><rect width="10" height="10" clip-path="url(#half)"/></svg>
        <svg width="10" height="10"><rect class="blue" width="10" height="10"/></svg>
        <svg width="10" height="10"><rect class="red" style="stroke-width:2" width="10" height="10"/></svg>
        <svg style="width:16px;height:16px"><use href="#mark"/></svg>
      </div>`
    )
    const [box] = graph.getChildren(graph.getPages()[0].id)
    const [clipped, blue, red, sized] = graph
      .getChildren(box.id)
      .map((svg) => graph.flattenTree(svg.id).map(({ node }) => node))
    const vectors = (nodes: SceneNode[]) => nodes.filter((node) => node.type === 'VECTOR')

    // A clip path defined in another SVG on the page still clips, as a mask 5 px wide.
    expect(clipped.filter((node) => node.isMask).map((mask) => mask.width)).toEqual([5])
    // A shape with a color of its own keeps its paint in it, rather than the SVG's.
    expect(vectors(blue)[0]?.fills[0]?.color).toEqual({ r: 0, g: 0, b: 1, a: 1 })
    // Stylesheet paint joins an inline style rather than replacing it.
    expect(vectors(red)[0]?.fills[0]?.color).toEqual({ r: 1, g: 0, b: 0, a: 1 })
    expect(vectors(red)[0]?.strokes[0]?.weight).toBe(2)
    // A symbol fits an SVG sized by CSS alone.
    expect(vectors(sized).map((vector) => [vector.width, vector.height])).toEqual([[16, 16]])
  })

  test("applies an SVG's opacity once, and draws its text in the type the page's CSS gives it", async () => {
    const { graph } = await readHTMLDocument(
      `<style>text { font-size: 32px; font-family: '${TEST_FAMILY}' }</style>
      <div><svg width="100" height="50" style="opacity:0.5"><rect width="10" height="10"/></svg>
      <svg width="100" height="50"><text x="0" y="40">Hi</text></svg></div>`
    )
    const [box] = graph.getChildren(graph.getPages()[0].id)
    const [faded, titled] = graph.getChildren(box.id)
    const inside = (svg: SceneNode) => graph.flattenTree(svg.id).map(({ node }) => node)

    expect(faded.opacity).toBe(0.5)
    expect(inside(faded).map((node) => node.opacity)).toEqual([1])
    expect(inside(titled).find((node) => node.type === 'TEXT')?.fontSize).toBe(32)
  })

  test('centers a block capped by its maximum width at that width, keeping auto layout', async () => {
    const { graph } = await readHTMLDocument(
      `<div style="width:600px"><div style="max-width:300px;margin:0 auto">` +
        `<div style="width:100px;height:10px"></div></div></div>`
    )
    const [page] = graph.getChildren(graph.getPages()[0].id)
    const [main] = graph.getChildren(page.id)

    expect(page.layoutMode).toBe('VERTICAL')
    expect(main).toMatchObject({ x: 150, width: 300 })
    // It fills up to its maximum, as the page's block does, rather than holding a fixed width.
    expect(layoutSizing(graph, main, 'HORIZONTAL')).toBe('FILL')
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

  test('lays an image out at its size on a page without text', async () => {
    const png = await Bun.file(join(FIXTURES, 'absolute-constraint-figma.png')).bytes()
    const view = new DataView(png.buffer, png.byteOffset)
    const { graph } = await readHTMLDocument('<img src="photo.png">', {
      readAsset: async (path) => (path === 'photo.png' ? png : null)
    })
    const [image] = graph.getChildren(graph.getPages()[0].id)

    expect(image).toMatchObject({ width: view.getUint32(16), height: view.getUint32(20) })
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
          return reads === 1
            ? new TextEncoder().encode('.box { width: 300px; height: 10px }')
            : null
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
