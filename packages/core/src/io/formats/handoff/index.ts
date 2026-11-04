import type { CanvasKit } from 'canvaskit-wasm'
import { zipSync, strToU8, type Zippable } from 'fflate'

import type { SceneGraph } from '@lawha/scene-graph'
import { colorToCSS } from '@lawha/scene-graph/color'

import { getCanvasKit } from '#core/canvaskit'
import { exportDesignTokens } from '#core/io/formats/design-tokens'
import { renderNodesToHTML } from '#core/io/formats/html'
import { computeContentBounds } from '#core/io/formats/raster/render'
import type { ExportAsset } from '#core/io/types'

import { handoffGuide, handoffVerifier, type HandoffFrameFile } from './guide'
import { buildHandoffSpec, collectImages, type HandoffSpec } from './spec'

export { buildHandoffSpec, type HandoffSpec } from './spec'

/** Renders the given layers to PNG at a scale; null when nothing renders. */
export type HandoffRasterizer = (nodeIds: string[], scale: number) => Promise<Uint8Array | null>

export interface HandoffInput {
  graph: SceneGraph
  nodeIds: string[]
  rasterize: HandoffRasterizer
  tailwindJSX?: string
  /** The app's CanvasKit, when there is one; otherwise the shared one loads. */
  canvasKit?: CanvasKit
}

/**
 * The frame alone at `scale`: a render covers the frame plus anything drawn outside it, such
 * as shadows, so it is cut to the frame's own box, which is what a built element measures.
 */
async function frameReference(
  input: HandoffInput,
  nodeId: string,
  scale: number
): Promise<Uint8Array | null> {
  const png = await input.rasterize([nodeId], scale)
  const content = computeContentBounds(input.graph, [nodeId])
  if (!png || !content) return png
  const box = input.graph.getAbsoluteBounds(nodeId)
  const dx = Math.round((box.x - content.minX) * scale)
  const dy = Math.round((box.y - content.minY) * scale)
  const width = Math.round(box.width * scale)
  const height = Math.round(box.height * scale)
  const ck = input.canvasKit ?? (await getCanvasKit())
  const image = ck.MakeImageFromEncoded(png)
  if (!image) return png
  if (dx === 0 && dy === 0 && image.width() === width && image.height() === height) {
    image.delete()
    return png
  }
  const surface = ck.MakeSurface(width, height)
  if (!surface) {
    image.delete()
    return png
  }
  try {
    const canvas = surface.getCanvas()
    canvas.clear(ck.TRANSPARENT)
    canvas.drawImage(image, -dx, -dy)
    const snapshot = surface.makeImageSnapshot()
    const out = snapshot.encodeToBytes(ck.ImageFormat.PNG, 100)
    snapshot.delete()
    return out ?? png
  } finally {
    surface.delete()
    image.delete()
  }
}

/** File-safe, id-safe frame names, unique within the package. */
function slugs(names: string[]): string[] {
  const taken = new Set<string>()
  return names.map((name) => {
    const base =
      name
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '') || 'frame'
    const safe = /^[a-z]/.test(base) ? base : `frame-${base}`
    let slug = safe
    for (let i = 2; taken.has(slug); i++) slug = `${safe}-${i}`
    taken.add(slug)
    return slug
  })
}

function tokensCSS(graph: SceneGraph): string {
  const lines: string[] = [':root {']
  for (const variable of graph.variables.values()) {
    const collection = graph.variableCollections.get(variable.collectionId)
    const modeId = collection?.defaultModeId ?? Object.keys(variable.valuesByMode)[0]
    const value = modeId ? variable.valuesByMode[modeId] : undefined
    const name = `--${variable.name.replace(/[^\w-]+/g, '-').toLowerCase()}`
    if (value && typeof value === 'object' && 'r' in value) {
      lines.push(`  ${name}: ${colorToCSS(value)};`)
    } else if (typeof value === 'number') lines.push(`  ${name}: ${value}px;`)
    else if (typeof value === 'string') lines.push(`  ${name}: ${JSON.stringify(value)};`)
  }
  lines.push('}')
  return `${lines.join('\n')}\n`
}

function assetBytes(asset: ExportAsset): Uint8Array {
  return typeof asset.content === 'string' ? strToU8(asset.content) : new Uint8Array(asset.content)
}

/**
 * A zip that lets a coding agent rebuild the frames exactly: a guide (`CLAUDE.md`), the full
 * spec, reference renders at 1x and 2x, a working HTML/CSS build with its assets and fonts,
 * Tailwind JSX, design tokens, every image, and a pixel-diff verifier.
 */
export async function exportHandoffPackage(input: HandoffInput): Promise<Uint8Array> {
  const { graph, nodeIds } = input
  const imagePaths = collectImages(graph, nodeIds)
  const spec: HandoffSpec = buildHandoffSpec(graph, nodeIds, imagePaths)
  const names = spec.frames.map((frame) => frame.name)
  const frameSlugs = slugs(names)
  const frames: HandoffFrameFile[] = spec.frames.map((frame, i) => ({
    name: frame.name,
    slug: frameSlugs[i],
    width: Math.round(frame.frame.width),
    height: Math.round(frame.frame.height)
  }))

  const files: Zippable = {}
  files['CLAUDE.md'] = strToU8(handoffGuide(spec, frames))
  files['spec/design.json'] = strToU8(`${JSON.stringify(spec, null, 2)}\n`)
  files['verify/verify.mjs'] = strToU8(handoffVerifier(frames))

  for (let i = 0; i < spec.frames.length; i++) {
    for (const scale of [1, 2]) {
      const png = await frameReference(input, spec.frames[i].id, scale)
      if (png) files[`reference/${frames[i].slug}@${scale}x.png`] = png
    }
  }

  for (const [hash, path] of imagePaths) {
    const bytes = graph.images.get(hash)
    if (bytes) files[path] = bytes
  }

  const { html, assets, fontsBundled } = await renderHTML(graph, nodeIds, spec)
  files['code/index.html'] = strToU8(withFrameIds(html, spec, frames))
  if (!fontsBundled && spec.fonts.length > 0) {
    files['code/fonts.html'] = strToU8(`${googleFontsLink(spec)}\n`)
  }
  for (const asset of assets) files[`code/${asset.path.replace(/^\.?\//, '')}`] = assetBytes(asset)
  if (input.tailwindJSX) files['code/tailwind.jsx'] = strToU8(input.tailwindJSX)

  const tokens = exportDesignTokens(graph)
  for (const file of tokens.files) {
    files[`tokens/${file.path}`] = strToU8(`${JSON.stringify(file.content, null, 2)}\n`)
  }
  files['tokens/tokens.css'] = strToU8(tokensCSS(graph))

  return zipSync(files, { level: 6 })
}

const FONT_BUNDLE_TIMEOUT_MS = 20_000

/** Rejects after `ms`, so a font download that never answers cannot stall the export. */
async function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timed out')), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The HTML build with its font files when they can be fetched; otherwise (offline, or a
 * browser where the font service refuses the request) the same page loading the exact
 * families and weights from Google Fonts.
 */
async function renderHTML(graph: SceneGraph, nodeIds: string[], spec: HandoffSpec) {
  const base = { html: 'standalone', style: 'inline', assets: 'external' } as const
  try {
    const bundled = await within(
      renderNodesToHTML(graph, nodeIds, { ...base, fonts: 'assets' }, 'code/index.html'),
      FONT_BUNDLE_TIMEOUT_MS
    )
    return { ...bundled, fontsBundled: true }
  } catch {
    const plain = await renderNodesToHTML(
      graph,
      nodeIds,
      { ...base, fonts: 'none' },
      'code/index.html'
    )
    const html =
      spec.fonts.length > 0
        ? plain.html.replace('</head>', `${googleFontsLink(spec)}\n</head>`)
        : plain.html
    return { html, assets: plain.assets, fontsBundled: false }
  }
}

/** A Google Fonts stylesheet link for exactly the families, weights and styles used. */
export function googleFontsLink(spec: HandoffSpec): string {
  const byFamily = new Map<string, Set<string>>()
  for (const font of spec.fonts) {
    const axes = byFamily.get(font.family) ?? new Set<string>()
    for (const weight of font.weights) axes.add(`${font.italic ? 1 : 0},${weight}`)
    byFamily.set(font.family, axes)
  }
  const families = [...byFamily].map(([family, axes]) => {
    const sorted = [...axes].sort((a, b) => {
      const [ia, wa] = a.split(',').map(Number)
      const [ib, wb] = b.split(',').map(Number)
      return ia - ib || wa - wb
    })
    return `family=${encodeURIComponent(family).replace(/%20/g, '+')}:ital,wght@${sorted.join(';')}`
  })
  const href = `https://fonts.googleapis.com/css2?${families.join('&')}&display=block`
  return `<link rel="stylesheet" href="${href.replace(/&/g, '&amp;')}">`
}

/**
 * Gives each exported frame's root element the id the verifier looks for, matching on the
 * `data-lawha-node-id` the HTML exporter writes.
 */
function withFrameIds(html: string, spec: HandoffSpec, frames: HandoffFrameFile[]): string {
  let out = html
  spec.frames.forEach((frame, i) => {
    const marker = `data-lawha-node-id="${frame.id}"`
    if (out.includes(marker)) out = out.replace(marker, `${marker} id="${frames[i].slug}"`)
  })
  return out
}
