import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { ALL_TOOLS, isToolExposed } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

import { mmToPt, type DieLine } from '#core/tools/print/geometry'
import { buildPrintProduct, PRINT_PRODUCT_IDS, PRINT_PRODUCTS } from '#core/tools/print/products'

function tool(name: string) {
  const found = ALL_TOOLS.find((item) => item.name === name)
  if (!found) throw new Error(`No tool ${name}`)
  return (figma: FigmaAPI, args: Record<string, unknown>) => found.execute(figma, args)
}

interface TemplateResult {
  id: string
  artwork: string
  dieline: string
  trimMM: { width: number; height: number }
  cutPaths: number
  creasePaths: number
  panels: string[]
}

type Segment = [[number, number], [number, number]]

/** Straight segments of the die-line's paths (curves are only in single closed shapes). */
function segments(paths: readonly string[]): Segment[] {
  return paths
    .filter((d) => !d.includes('C'))
    .map((d) => {
      const n = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
      return [
        [n[0], n[1]],
        [n[2], n[3]]
      ]
    })
}

/** A closed cut has every vertex shared by an even number of cut segments. */
function openVertices(die: DieLine): string[] {
  const degree = new Map<string, number>()
  for (const [a, b] of segments(die.cuts))
    for (const p of [a, b]) {
      const k = `${p[0].toFixed(2)},${p[1].toFixed(2)}`
      degree.set(k, (degree.get(k) ?? 0) + 1)
    }
  return [...degree].filter(([, n]) => n % 2 !== 0).map(([k]) => k)
}

/** The value, or a failed test naming what was missing. */
function must<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('expected a node')
  return value
}

const length = ([a, b]: Segment) => Math.hypot(b[0] - a[0], b[1] - a[1])
const close = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps)

describe('units', () => {
  test('one inch is 72 points; A4 is 595 × 842', () => {
    expect(mmToPt(25.4)).toBe(72)
    expect(Math.round(mmToPt(210))).toBe(595)
    expect(Math.round(mmToPt(297))).toBe(842)
  })
})

describe('die-line geometry', () => {
  test('a flat card is four cuts round the trim and no folds', () => {
    const die = buildPrintProduct('business-card-gulf')
    expect(die).toMatchObject({ width: 90, height: 50 })
    expect(die.creases).toHaveLength(0)
    expect(die.cuts).toHaveLength(4)
    close(
      segments(die.cuts).reduce((sum, s) => sum + length(s), 0),
      280
    )
    expect(openVertices(die)).toEqual([])
  })

  test('bi-fold has one fold down the middle, full height', () => {
    const die = buildPrintProduct('brochure-bifold-a4')
    const [fold] = segments(die.creases)
    expect(die.creases).toHaveLength(1)
    close(fold[0][0], 148.5)
    close(fold[1][0], 148.5)
    close(length(fold), 210)
  })

  test('tri-fold has two folds; the inside flap is 2 mm narrower', () => {
    const die = buildPrintProduct('brochure-trifold-a4')
    const xs = segments(die.creases)
      .map((s) => s[0][0])
      .sort((a, b) => a - b)
    expect(xs).toHaveLength(2)
    close(xs[0], 297 / 3 - 2)
    close(xs[1] - xs[0], 297 / 3 + 1)
    expect(die.cuts).toHaveLength(4) // top and bottom each merge into one straight cut
    expect(openVertices(die)).toEqual([])
  })

  test('tuck-end box: overall size, every fold, closed cut, lids cut free of dust flaps', () => {
    const die = buildPrintProduct('tuck-box', { width: 60, height: 100, depth: 30 })
    // glue 15 + back 60 + side 30 + front 60 + side 30; lid 30 + tuck 15 above and below.
    close(die.width, 195)
    close(die.height, 190)
    // Four body folds of 100, lid and tuck hinges 4 × 60, dust-flap hinges 4 × 30. Folds on one
    // line are merged into a single path, so compare total length rather than path count.
    close(
      segments(die.creases).reduce((sum, s) => sum + length(s), 0),
      4 * 100 + 4 * 60 + 4 * 30
    )
    expect(openVertices(die)).toEqual([])
    // No fold runs up the side of a lid: those edges are cuts.
    const verticalFoldsAboveBody = segments(die.creases).filter(
      ([a, b]) => Math.abs(a[0] - b[0]) < 1e-6 && Math.min(a[1], b[1]) < 45 - 1e-6
    )
    expect(verticalFoldsAboveBody).toEqual([])
    expect(die.panels.map((p) => p.name)).toEqual([
      'back',
      'side',
      'front',
      'side-2',
      'top-lid',
      'bottom-lid'
    ])
    expect(die.panels.find((p) => p.name === 'front')).toMatchObject({
      x: 105,
      y: 45,
      width: 60,
      height: 100
    })
  })

  test('box dimensions follow the requested size', () => {
    const die = buildPrintProduct('tuck-box', { width: 80, height: 120, depth: 40 })
    close(die.width, 15 + 80 + 40 + 80 + 40)
    expect(openVertices(die)).toEqual([])
  })

  test('envelope: four folds round the body and a closed outline', () => {
    const die = buildPrintProduct('envelope-dl')
    expect(die.creases).toHaveLength(4)
    expect(openVertices(die)).toEqual([])
    expect(die.panels).toEqual([
      expect.objectContaining({ name: 'front', width: 220, height: 110 })
    ])
  })

  test('presentation folder: spine fold and one pocket fold across both covers', () => {
    const die = buildPrintProduct('presentation-folder-a4')
    expect(die.creases).toHaveLength(2)
    const pocketFold = segments(die.creases).find(([a, b]) => Math.abs(a[1] - b[1]) < 1e-6)
    close(
      length(
        pocketFold ?? [
          [0, 0],
          [0, 0]
        ]
      ),
      440
    )
    expect(openVertices(die)).toEqual([])
  })

  test('rounded card, circle sticker and door hanger are single closed curves plus holes', () => {
    expect(buildPrintProduct('business-card-rounded').cuts).toHaveLength(1)
    expect(buildPrintProduct('sticker-circle', { width: 60 })).toMatchObject({
      width: 60,
      height: 60
    })
    expect(buildPrintProduct('door-hanger').cuts).toHaveLength(3) // outline, hole, slit
  })

  test('only listed dimensions can be changed, and they must be positive', () => {
    expect(buildPrintProduct('flyer-a5', { width: 999 }).width).toBe(148)
    expect(() => buildPrintProduct('tuck-box', { depth: -5 })).toThrow()
  })

  test('every product builds, with bleed and safe margins in sensible ranges', () => {
    for (const id of PRINT_PRODUCT_IDS) {
      const die = buildPrintProduct(id)
      const product = PRINT_PRODUCTS[id]
      expect(die.width).toBeGreaterThan(0)
      expect(die.cuts.length).toBeGreaterThan(0)
      expect(product.bleed).toBeGreaterThanOrEqual(2)
      expect(product.safe).toBeGreaterThanOrEqual(product.bleed)
    }
  })
})

function designFrame(figma: FigmaAPI, width = 400, height = 300) {
  const frame = figma.createFrame()
  frame.name = 'Design'
  frame.resize(width, height)
  frame.fills = [{ type: 'SOLID', color: { r: 0.3, g: 0.2, b: 0.9 }, opacity: 1, visible: true }]
  return frame
}

describe('create_print_template', () => {
  test('sheet is trim plus bleed in points, with artwork and a locked die-line', () => {
    const figma = new FigmaAPI(new SceneGraph())
    const out = tool('create_print_template')(figma, {
      product: 'business-card-gulf',
      x: 0,
      y: 0
    }) as TemplateResult
    const sheet = figma.getNodeById(out.id)
    close(sheet?.width ?? 0, mmToPt(96), 1e-6)
    close(sheet?.height ?? 0, mmToPt(56), 1e-6)
    expect(sheet?.children.map((c) => c.name)).toEqual(['Artwork', 'Dieline (do not print)'])
    const dieline = figma.getNodeById(out.dieline)
    expect(dieline?.locked).toBe(true)
    const names = dieline?.children.map((c) => c.name) ?? []
    expect(names.filter((n) => n === 'CutContour')).toHaveLength(4)
    expect(names).toContain('Bleed')
    expect(names).toContain('Safe area')
  })

  test('cut lines are magenta and solid; folds are cyan and dashed', () => {
    const figma = new FigmaAPI(new SceneGraph())
    const out = tool('create_print_template')(figma, {
      product: 'brochure-trifold-a4'
    }) as TemplateResult
    const lines = figma.getNodeById(out.dieline)?.children ?? []
    const cut = figma.graph.getNode(lines.find((c) => c.name === 'CutContour')?.id ?? '')
    const crease = figma.graph.getNode(lines.find((c) => c.name === 'Crease')?.id ?? '')
    expect(cut?.strokes[0]?.color).toMatchObject({ r: 0.925, g: 0, b: 0.549 })
    expect(cut?.dashPattern).toEqual([])
    expect(crease?.dashPattern).toEqual([6, 4])
    expect(out.creasePaths).toBe(2)
  })

  test('a fold line sits exactly where the geometry puts it, in points', () => {
    const figma = new FigmaAPI(new SceneGraph())
    const out = tool('create_print_template')(figma, {
      product: 'brochure-bifold-a4'
    }) as TemplateResult
    const crease = figma.getNodeById(out.dieline)?.children.find((c) => c.name === 'Crease')
    close(crease?.x ?? 0, mmToPt(3 + 148.5), 1e-3)
    close(crease?.height ?? 0, mmToPt(210), 1e-3)
  })
})

describe('convert_to_dieline', () => {
  test('flat product: the whole design sits in the safe area, its background runs to the bleed', () => {
    const figma = new FigmaAPI(new SceneGraph())
    const design = designFrame(figma)
    const out = tool('convert_to_dieline')(figma, {
      id: design.id,
      product: 'flyer-a5'
    }) as TemplateResult
    const artwork = must(figma.getNodeById(out.artwork))
    const copy = must(artwork.children[0])
    const inset = mmToPt(3 + 5) // bleed + safe
    expect(copy.x).toBeGreaterThanOrEqual(inset - 1e-6)
    expect(copy.y).toBeGreaterThanOrEqual(inset - 1e-6)
    expect(copy.x + copy.width).toBeLessThanOrEqual(artwork.width - inset + 1e-6)
    expect(copy.y + copy.height).toBeLessThanOrEqual(artwork.height - inset + 1e-6)
    // Fits the narrower side exactly and is centred on the other.
    close(copy.width, artwork.width - 2 * inset, 1e-6)
    close(copy.y * 2 + copy.height, artwork.height, 1e-6)
    expect(artwork.fills).toEqual(design.fills)
    expect(design).toMatchObject({ width: 400, height: 300 })
  })

  test('box: the design goes on the front panel, inside its safe area', () => {
    const figma = new FigmaAPI(new SceneGraph())
    const design = designFrame(figma, 200, 300)
    const out = tool('convert_to_dieline')(figma, {
      id: design.id,
      product: 'tuck-box',
      size: { width: 60, height: 100, depth: 30 }
    }) as TemplateResult
    const artwork = must(figma.getNodeById(out.artwork))
    const panel = must(artwork.children.find((c) => c.name === 'Front panel'))
    close(panel.x, mmToPt(105), 1e-6)
    close(panel.width, mmToPt(66), 1e-6)
    close(panel.height, mmToPt(106), 1e-6)
    expect(panel.children).toHaveLength(1)
    const copy = must(panel.children[0])
    const inset = mmToPt(3 + 3)
    expect(copy.x).toBeGreaterThanOrEqual(inset - 1e-6)
    expect(copy.x + copy.width).toBeLessThanOrEqual(panel.width - inset + 1e-6)
    expect(copy.y + copy.height).toBeLessThanOrEqual(panel.height - inset + 1e-6)
  })

  test('an unknown design id fails cleanly', () => {
    const figma = new FigmaAPI(new SceneGraph())
    expect(() => tool('convert_to_dieline')(figma, { id: '9:9', product: 'flyer-a5' })).toThrow()
  })
})

describe('resize_for_screens', () => {
  test('copies take each screen width; auto layout children that fill reflow to it', () => {
    const figma = new FigmaAPI(new SceneGraph())
    const page = designFrame(figma, 1440, 900)
    page.layoutMode = 'VERTICAL'
    const header = figma.createFrame()
    page.appendChild(header)
    header.name = 'Header'
    header.resize(1440, 80)
    header.layoutSizingHorizontal = 'FILL'
    const out = tool('resize_for_screens')(figma, { id: page.id }) as {
      created: { id: string; width: number }[]
    }
    expect(out.created.map((c) => c.width)).toEqual([393, 834, 1440])
    const mobile = figma.getNodeById(out.created[0].id)
    expect(mobile?.children.find((c) => c.name === 'Header')?.width).toBe(393)
    expect(page.width).toBe(1440)
  })

  test('without auto layout the copy takes the screen height too', () => {
    const figma = new FigmaAPI(new SceneGraph())
    const page = designFrame(figma, 1440, 900)
    const out = tool('resize_for_screens')(figma, { id: page.id, screens: ['mobile-small'] }) as {
      created: { id: string; width: number; height: number }[]
    }
    expect(out.created[0]).toMatchObject({ width: 360, height: 800 })
  })

  test('refuses anything that is not a frame', () => {
    const figma = new FigmaAPI(new SceneGraph())
    const rect = figma.createRectangle()
    expect(tool('resize_for_screens')(figma, { id: rect.id })).toMatchObject({
      error: expect.any(String)
    })
  })
})

test('print and screen tools reach AI chat and MCP', () => {
  for (const name of [
    'list_print_products',
    'create_print_template',
    'convert_to_dieline',
    'resize_for_screens'
  ]) {
    const def = ALL_TOOLS.find((t) => t.name === name)
    expect(def && isToolExposed(def, 'mcp') && isToolExposed(def, 'ai')).toBe(true)
  }
})
