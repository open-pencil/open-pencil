import * as v from 'valibot'

import type { Vector } from '@lawha/scene-graph/primitives'
import { parseSVGPath } from '@lawha/scene-graph/parse-path'
import { transformVectorNetwork } from '@lawha/scene-graph/vector-network'

import type { FigmaAPI, FigmaNodeProxy } from '#core/figma-api'
import { nextFreeX, placeCopy } from '#core/tools/mockup/fit'
import { defineTool, nodeSummary, requireNode, toolNumber } from '#core/tools/schema'
import { computeAccurateBounds } from '#core/vector/curve-math'

import { mmToPt, roundedRectPath, type DieLine } from './geometry'
import {
  buildPrintProduct,
  PRINT_PRODUCT_IDS,
  PRINT_PRODUCTS,
  type PrintProduct,
  type PrintProductId,
  type PrintSize
} from './products'
import { printProductInputSchema, printSizeInputSchema } from './schema'

/** Print-shop conventions: cut in 100% magenta named CutContour, folds in dashed cyan. */
export const DIELINE_STYLE = {
  cut: { name: 'CutContour', color: { r: 0.925, g: 0, b: 0.549 }, dash: [] },
  crease: { name: 'Crease', color: { r: 0, g: 0.682, b: 0.937 }, dash: [6, 4] },
  bleed: { name: 'Bleed', color: { r: 0.9, g: 0.1, b: 0.1 }, dash: [3, 3] },
  safe: { name: 'Safe area', color: { r: 0.1, g: 0.65, b: 0.25 }, dash: [3, 3] }
} as const

type LineKind = keyof typeof DIELINE_STYLE

/** Adds an SVG path drawn in millimetres as a stroked vector, offset by `origin` (pt). */
function addLine(
  figma: FigmaAPI,
  parent: FigmaNodeProxy,
  kind: LineKind,
  pathMM: string,
  origin: number
): void {
  const network = parseSVGPath(pathMM)
  if (network.segments.length === 0) return
  const k = mmToPt(1)
  const scaled = transformVectorNetwork([k, 0, 0, 0, k, 0, 0, 0, 1], network)
  const b = computeAccurateBounds(scaled)
  const node = figma.createVector()
  parent.appendChild(node)
  node.name = DIELINE_STYLE[kind].name
  node.x = origin + b.x
  node.y = origin + b.y
  node.resize(Math.max(b.width, 0.01), Math.max(b.height, 0.01))
  figma.graph.updateNode(node.id, {
    vectorNetwork: transformVectorNetwork([1, 0, -b.x, 0, 1, -b.y, 0, 0, 1], scaled),
    fills: [],
    strokes: [
      {
        type: 'SOLID',
        color: { ...DIELINE_STYLE[kind].color, a: 1 },
        weight: 0.5,
        opacity: 1,
        visible: true,
        align: 'CENTER'
      }
    ],
    dashPattern: [...DIELINE_STYLE[kind].dash]
  })
}

interface Template {
  sheet: FigmaNodeProxy
  artwork: FigmaNodeProxy
  dieline: FigmaNodeProxy
  die: DieLine
  product: PrintProduct
}

/** Builds the sheet: trim plus bleed all round, an artwork frame, and the locked die-line. */
function buildTemplate(
  figma: FigmaAPI,
  id: PrintProductId,
  size: PrintSize | undefined,
  at: Partial<Vector>,
  name?: string
): Template {
  const product: PrintProduct = PRINT_PRODUCTS[id]
  const die = buildPrintProduct(id, size)
  const bleed = mmToPt(product.bleed)
  const w = mmToPt(die.width) + 2 * bleed
  const h = mmToPt(die.height) + 2 * bleed

  const sheet = figma.createFrame()
  sheet.name =
    name ??
    `${product.label} — ${round(die.width)}×${round(die.height)} mm + ${product.bleed} mm bleed`
  sheet.x = at.x ?? nextFreeX(figma)
  sheet.y = at.y ?? 0
  sheet.resize(w, h)
  sheet.clipsContent = false
  sheet.fills = []

  const artwork = figma.createFrame()
  sheet.appendChild(artwork)
  artwork.name = 'Artwork'
  artwork.resize(w, h)
  artwork.clipsContent = true
  artwork.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1, visible: true }]

  const dieline = figma.createFrame()
  sheet.appendChild(dieline)
  dieline.name = 'Dieline (do not print)'
  dieline.resize(w, h)
  dieline.clipsContent = false
  dieline.fills = []

  // Bleed outline: the shape grown by the bleed, or a rectangle for multi-piece sheets.
  addLine(
    figma,
    dieline,
    'bleed',
    roundedRectPath(
      -product.bleed,
      -product.bleed,
      die.width + 2 * product.bleed,
      die.height + 2 * product.bleed,
      0
    ),
    bleed
  )
  for (const panel of die.panels.length === 1 ? die.panels : [])
    if (panel.width > 2 * product.safe && panel.height > 2 * product.safe)
      addLine(
        figma,
        dieline,
        'safe',
        roundedRectPath(
          panel.x + product.safe,
          panel.y + product.safe,
          panel.width - 2 * product.safe,
          panel.height - 2 * product.safe,
          0
        ),
        bleed
      )
  for (const d of die.creases) addLine(figma, dieline, 'crease', d, bleed)
  for (const d of die.cuts) addLine(figma, dieline, 'cut', d, bleed)
  dieline.locked = true
  return { sheet, artwork, dieline, die, product }
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}

function describe(template: Template) {
  const { sheet, die, product } = template
  return {
    ...nodeSummary(sheet),
    artwork: template.artwork.id,
    dieline: template.dieline.id,
    trimMM: { width: round(die.width), height: round(die.height) },
    bleedMM: product.bleed,
    safeMM: product.safe,
    cutPaths: die.cuts.length,
    creasePaths: die.creases.length,
    panels: die.panels.map((p) => p.name)
  }
}

const positionInputs = {
  x: v.optional(
    toolNumber(
      v.pipe(v.number(), v.description('X on the page; default: right of existing content'))
    )
  ),
  y: v.optional(toolNumber(v.pipe(v.number(), v.description('Y on the page; default 0'))))
}

export const listPrintProducts = defineTool({
  name: 'list_print_products',
  description:
    'List print products with their sizes (mm), bleed, safe margin, and which dimensions can be customised: business cards, flyers, posters, folded brochures, cards, stickers, envelopes, folders, packaging boxes, banners.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.strictObject({}),
  execute: () => ({
    products: PRINT_PRODUCT_IDS.map((id) => {
      const p: PrintProduct = PRINT_PRODUCTS[id]
      return {
        id,
        category: p.category,
        label: p.label,
        sizeMM: p.defaults,
        customisable: p.sizes,
        bleedMM: p.bleed,
        safeMM: p.safe
      }
    })
  })
})

export const createPrintTemplate = defineTool({
  name: 'create_print_template',
  description:
    'Create a print-ready template: a sheet at trim size plus bleed (in points, 72 per inch), an Artwork frame to design in, and a locked die-line layer with the cut path (CutContour, magenta), folds (Crease, dashed cyan), bleed and safe-area guides.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    product: printProductInputSchema,
    size: printSizeInputSchema,
    name: v.optional(v.pipe(v.string(), v.description('Sheet name'))),
    ...positionInputs
  }),
  execute: (figma, args) => describe(buildTemplate(figma, args.product, args.size, args))
})

export const convertToDieline = defineTool({
  name: 'convert_to_dieline',
  description:
    'Turn an existing design into a print-ready die-cut file for a print product: builds the template, fits a scaled copy of the design whole inside the safe area (of the sheet for flat and folded products, of the front panel for boxes, envelopes and folders), runs the design’s background out to the bleed, and adds the die-line. Nothing is cropped; the original is untouched.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    id: v.pipe(v.string(), v.description('Design to convert (usually a frame)')),
    product: printProductInputSchema,
    size: printSizeInputSchema,
    ...positionInputs
  }),
  execute: (figma, args) => {
    const source = requireNode(figma, args.id)
    if (!source) return { error: `Node ${args.id} not found` }
    const template = buildTemplate(
      figma,
      args.product,
      args.size,
      args,
      `${source.name} — ${PRINT_PRODUCTS[args.product].label}`
    )
    const product = template.product
    const bleed = mmToPt(product.bleed)
    const safe = mmToPt(product.safe)
    // The design's own background runs out to the bleed; its content stays whole inside the
    // safe area, so nothing important is trimmed or lost in a fold.
    const background = Array.isArray(source.fills) ? source.fills : []
    const area =
      product.artwork === 'front'
        ? (template.die.panels.find((p) => p.name === 'front') ?? template.die.panels[0])
        : { x: 0, y: 0, width: template.die.width, height: template.die.height }
    const holder = product.artwork === 'front' ? figma.createFrame() : template.artwork
    if (holder !== template.artwork) {
      template.artwork.appendChild(holder)
      holder.name = 'Front panel'
      holder.x = mmToPt(area.x)
      holder.y = mmToPt(area.y)
      holder.resize(mmToPt(area.width) + 2 * bleed, mmToPt(area.height) + 2 * bleed)
      holder.clipsContent = true
    }
    if (background.length > 0) holder.fills = background
    const inner = {
      width: Math.max(holder.width - 2 * (bleed + safe), 1),
      height: Math.max(holder.height - 2 * (bleed + safe), 1)
    }
    const copy = placeCopy(source, holder, inner, 'contain')
    copy.x += bleed + safe
    copy.y += bleed + safe
    return describe(template)
  }
})
