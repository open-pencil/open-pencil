import type * as HarfBuzzModule from 'harfbuzzjs'

import type { FontVariation } from '@open-pencil/scene-graph'

import { ResourceCache } from '#core/cache/resource'
import { IS_BROWSER } from '#core/constants'

import { fontTableView } from './variation'

export interface OutlineCommand {
  type: string
  x?: number
  y?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
}

type HarfBuzz = typeof HarfBuzzModule

let harfBuzz: HarfBuzz | null = null
let harfBuzzLoading: Promise<HarfBuzz | null> | null = null

/** Whether HarfBuzz has loaded, so fonts can be read synchronously. */
export function isHarfBuzzLoaded(): boolean {
  return harfBuzz !== null
}

/**
 * Loads HarfBuzz, which reads glyph outlines, advances, and shaping for Core's synchronous font
 * readers. Fonts only arrive asynchronously, so the font manager waits for it as it loads one;
 * until then, or if it fails to load, the readers answer as for a font that is not loaded.
 */
export function loadHarfBuzz(): Promise<HarfBuzz | null> {
  harfBuzzLoading ??= import('harfbuzzjs').then(
    (module) => (harfBuzz = module),
    (error: unknown) => {
      console.warn('HarfBuzz failed to load; glyph outlines are unavailable:', error)
      return null
    }
  )
  return harfBuzzLoading
}

/**
 * Where HarfBuzz's subsetter (`harfbuzz-subset.wasm`) loads from. Mirrors the CanvasKit locator:
 * under Node the file is read beside the harfbuzzjs package; in a browser the default expects the
 * host to serve it at the site root, and a bundling host sets its emitted URL instead.
 */
export type HarfBuzzSubsetLocator = () => string

let locator: HarfBuzzSubsetLocator = () =>
  IS_BROWSER
    ? '/harfbuzz-subset.wasm'
    : new URL('harfbuzz-subset.wasm', import.meta.resolve('harfbuzzjs')).href

/** Points the subsetter at the host's copy of its file. Call before the first instance. */
export function setHarfBuzzSubsetLocator(locate: HarfBuzzSubsetLocator): void {
  locator = locate
}

const SUBSET_FUNCTIONS = [
  'malloc',
  'free',
  'hb_blob_create',
  'hb_blob_destroy',
  'hb_blob_get_data',
  'hb_face_create',
  'hb_face_destroy',
  'hb_face_reference_blob',
  'hb_subset_input_create_or_fail',
  'hb_subset_input_destroy',
  'hb_subset_input_keep_everything',
  'hb_subset_input_pin_all_axes_to_default',
  'hb_subset_input_pin_axis_location',
  'hb_subset_or_fail'
] as const

type SubsetFunction = (...args: number[]) => number

export type HarfBuzzSubsetter = Record<(typeof SUBSET_FUNCTIONS)[number], SubsetFunction> & {
  memory: WebAssembly.Memory
}

async function readSubsetModule(): Promise<ArrayBuffer> {
  const url = locator()
  if (IS_BROWSER || !url.startsWith('file:')) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HarfBuzz subsetter answered ${response.status}`)
    return response.arrayBuffer()
  }
  const { readFile } = await import(/* @vite-ignore */ 'node:fs/promises')
  const file = await readFile(new URL(url))
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)
}

function subsetter(exports: WebAssembly.Exports): HarfBuzzSubsetter {
  const memory = exports.memory
  if (!(memory instanceof WebAssembly.Memory)) throw new Error('HarfBuzz subsetter has no memory')
  const functions: Partial<Record<(typeof SUBSET_FUNCTIONS)[number], SubsetFunction>> = {}
  for (const name of SUBSET_FUNCTIONS) {
    const exported = exports[name]
    if (typeof exported !== 'function') throw new Error(`HarfBuzz subsetter lacks ${name}`)
    functions[name] = (...args) => Number(Reflect.apply(exported, undefined, args))
  }
  return { ...(functions as Record<(typeof SUBSET_FUNCTIONS)[number], SubsetFunction>), memory }
}

let subsetterLoading: Promise<HarfBuzzSubsetter> | null = null

/**
 * Loads HarfBuzz's subsetter, a WebAssembly build of its own that harfbuzzjs ships without a
 * wrapper, once; a failed load is retried by the next caller.
 */
export function loadHarfBuzzSubsetter(): Promise<HarfBuzzSubsetter> {
  if (subsetterLoading) return subsetterLoading
  const loading = readSubsetModule()
    .then((bytes) => WebAssembly.instantiate(bytes, {}))
    .then(({ instance }) => subsetter(instance.exports))
  subsetterLoading = loading
  loading.catch(() => {
    if (subsetterLoading === loading) subsetterLoading = null
  })
  return loading
}

/** A font drawing one instance of a font file, and the number its outlines are cached under. */
export interface HarfBuzzInstance {
  font: HarfBuzzModule.Font
  id: number
}

/** A font file as HarfBuzz reads it: its face, and the font drawing its default instance. */
export interface HarfBuzzFont {
  hb: HarfBuzz
  face: HarfBuzzModule.Face
  font: HarfBuzzModule.Font
  bytes: ArrayBuffer
  glyphCount: number
  /** Glyph IDs by code point and default advances by glyph ID, read once each. */
  glyphIds: Map<number, number>
  advances: Map<number, number>
  /** The instances text has been drawn at, by their axis values; '' is the default. */
  instances: ResourceCache<string, HarfBuzzInstance>
}

/** How many instances of one file keep their font and outlines, such as each optical size. */
const INSTANCES_PER_FONT = 16
/**
 * Outlines drawn by any instance, in font units with y running up, so a glyph is drawn once
 * whatever size it is asked for. Weighed by commands: 100,000 are about 7.5 MB of CJK outlines.
 */
const outlineCache = new ResourceCache<number, readonly OutlineCommand[]>({
  maxWeight: 100_000,
  weight: (commands) => commands.length + 1
})
let nextInstanceId = 0

/** A font file read by HarfBuzz, or `null` when HarfBuzz is not loaded or the file has no glyphs. */
export function harfBuzzFont(bytes: ArrayBuffer): HarfBuzzFont | null {
  const hb = harfBuzz
  const maxp = fontTableView(bytes, 'maxp')
  const glyphCount = maxp && maxp.byteLength >= 6 ? maxp.getUint16(4) : 0
  if (!hb || glyphCount === 0) return null
  const face = new hb.Face(new hb.Blob(bytes))
  return {
    hb,
    face,
    font: new hb.Font(face),
    bytes,
    glyphCount,
    glyphIds: new Map(),
    advances: new Map(),
    instances: new ResourceCache({ maxEntries: INSTANCES_PER_FONT })
  }
}

/** The instance of the file at `variations`, drawn by the default font when none are set. */
export function fontInstance(
  parsed: HarfBuzzFont,
  variations: readonly FontVariation[]
): HarfBuzzInstance {
  const key = variations.map(({ axis, value }) => `${axis}=${value}`).join(',')
  const cached = parsed.instances.get(key)
  if (cached) return cached
  let font = parsed.font
  if (variations.length > 0) {
    font = new parsed.hb.Font(parsed.face)
    font.setVariations(variations.map(({ axis, value }) => new parsed.hb.Variation(axis, value)))
  }
  // Glyph IDs are 16-bit, so an instance's outlines take the keys from its id times 65536.
  const instance = { font, id: nextInstanceId++ * 65536 }
  parsed.instances.set(key, instance)
  return instance
}

let outlineDrawing: HarfBuzzModule.DrawFuncs | null = null

/**
 * The draw callbacks that collect an outline, in font units, into the array passed as draw data.
 * HarfBuzz registers each callback in the WebAssembly function table, so one set serves every
 * glyph.
 */
function outlineDrawFuncs(hb: HarfBuzz): HarfBuzzModule.DrawFuncs {
  if (outlineDrawing) return outlineDrawing
  const commands = (data: unknown) => data as OutlineCommand[]
  const draw = new hb.DrawFuncs()
  draw.setMoveToFunc((x, y, data) => commands(data).push({ type: 'M', x, y }))
  draw.setLineToFunc((x, y, data) => commands(data).push({ type: 'L', x, y }))
  draw.setQuadraticToFunc((x1, y1, x, y, data) => commands(data).push({ type: 'Q', x1, y1, x, y }))
  draw.setCubicToFunc((x1, y1, x2, y2, x, y, data) =>
    commands(data).push({ type: 'C', x1, y1, x2, y2, x, y })
  )
  draw.setClosePathFunc((data) => commands(data).push({ type: 'Z' }))
  outlineDrawing = draw
  return draw
}

/**
 * The outline of `glyphId` in `instance`, scaled from font units to `fontSize` with y running down
 * from the baseline at `baseline`, and its origin at `originX`.
 */
export function glyphCommands(
  parsed: HarfBuzzFont,
  instance: HarfBuzzInstance,
  glyphId: number,
  fontSize: number,
  baseline = 0,
  originX = 0
): OutlineCommand[] {
  let outline = outlineCache.get(instance.id + glyphId)
  if (!outline) {
    const drawn: OutlineCommand[] = []
    instance.font.drawGlyph(glyphId, outlineDrawFuncs(parsed.hb), drawn)
    outlineCache.set(instance.id + glyphId, drawn)
    outline = drawn
  }
  const scale = fontSize / parsed.face.upem
  const x = (value: number) => originX + value * scale
  const y = (value: number) => baseline - value * scale
  return outline.map((command) => {
    switch (command.type) {
      case 'M':
      case 'L':
        return { type: command.type, x: x(command.x ?? 0), y: y(command.y ?? 0) }
      case 'Q':
        return {
          type: 'Q',
          x1: x(command.x1 ?? 0),
          y1: y(command.y1 ?? 0),
          x: x(command.x ?? 0),
          y: y(command.y ?? 0)
        }
      case 'C':
        return {
          type: 'C',
          x1: x(command.x1 ?? 0),
          y1: y(command.y1 ?? 0),
          x2: x(command.x2 ?? 0),
          y2: y(command.y2 ?? 0),
          x: x(command.x ?? 0),
          y: y(command.y ?? 0)
        }
      default:
        return { type: command.type }
    }
  })
}

let shapingBuffer: HarfBuzzModule.Buffer | null = null

/** An OpenType feature set on or off for shaping, by its lowercase tag ("liga", "tnum"). */
export interface ShapingFeature {
  tag: string
  value: number
  /** The code units of the text it applies to, from `start` up to `end`; all when left out. */
  start?: number
  end?: number
}

/**
 * How text is shaped: at a variable font's instance, with features over the defaults, and in a
 * direction and language, which HarfBuzz guesses from the text when they are left out.
 */
export interface ShapingOptions {
  instance?: HarfBuzzInstance
  features?: readonly ShapingFeature[]
  rtl?: boolean
  language?: string
}

/**
 * The glyphs HarfBuzz shapes `text` into, and their positions: at the font's default instance
 * and HarfBuzz's default features unless `options` sets others, as CanvasKit shapes a run.
 */
export function shapeText(
  parsed: HarfBuzzFont,
  text: string,
  options: ShapingOptions = {}
): ReturnType<HarfBuzzModule.Buffer['getGlyphInfosAndPositions']> {
  shapingBuffer ??= new parsed.hb.Buffer()
  shapingBuffer.reset()
  shapingBuffer.addText(text)
  const { Direction, Feature } = parsed.hb
  if (options.rtl !== undefined) {
    shapingBuffer.setDirection(options.rtl ? Direction.RTL : Direction.LTR)
  }
  if (options.language) shapingBuffer.setLanguage(options.language)
  shapingBuffer.guessSegmentProperties()
  const features = options.features?.map(
    ({ tag, value, start, end }) =>
      new Feature(tag, value, start ?? Feature.GLOBAL_START, end ?? Feature.GLOBAL_END)
  )
  parsed.hb.shape(options.instance?.font ?? parsed.font, shapingBuffer, features)
  return shapingBuffer.getGlyphInfosAndPositions()
}
