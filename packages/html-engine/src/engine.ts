import * as v from 'valibot'

import { imageStandIn, rasterImageSize } from './images'
import { captureSchema, requestsSchema, type HTMLEngineCapture } from './schema'

/**
 * The module's exports: strings and bytes cross as (pointer, length), and results land in one
 * output buffer whose length the call returns.
 */
const EXPORTS = [
  'alloc',
  'dealloc',
  'output_ptr',
  'fonts_reset',
  'font_decode',
  'font_add',
  'font_generic',
  'open',
  'pump',
  'provide',
  'fail',
  'capture'
] as const

type EngineExports = Record<(typeof EXPORTS)[number], (...args: number[]) => number> & {
  memory: WebAssembly.Memory
}

/** A resource the document asked for, as the host fetched it: its final URL and its bytes. */
export interface HTMLEngineResource {
  url: string
  bytes: Uint8Array
  /** The resource's media type, such as `text/css`, when the host knows it. */
  contentType?: string
}

/**
 * Fetches a stylesheet, font, or image the document refers to; null when it cannot. `signal`
 * aborts when the request runs out of time, and the layout goes on without it.
 */
export type HTMLEngineFetch = (
  url: string,
  signal: AbortSignal
) => Promise<HTMLEngineResource | null>

export interface HTMLEngineLayoutOptions {
  /** The document's URL, which relative URLs in it resolve against. */
  baseURL?: string
  /** In whole CSS pixels. */
  viewport: { width: number; height: number }
  /** Answers the document's requests; without one, every request fails. */
  fetch?: HTMLEngineFetch
  /** How long one request may take before the layout goes on without it. */
  requestTimeoutMs?: number
}

/**
 * How long a request may take by default: as long as the browser runtime waits for an image, so
 * one request that never ends cannot hold this layout, or the ones queued behind it, forever.
 */
const REQUEST_TIMEOUT_MS = 10_000

/** The largest viewport side the module takes, as a signed 32-bit length. */
const MAX_VIEWPORT = 0x7fffffff

function checkViewport({ width, height }: HTMLEngineLayoutOptions['viewport']): void {
  for (const side of [width, height]) {
    if (!Number.isInteger(side) || side <= 0 || side > MAX_VIEWPORT) {
      throw new RangeError(`The viewport needs whole positive pixel sizes, not ${width}×${height}`)
    }
  }
}

/** A fetch that gives up, answering null, once `signal` aborts. */
function withDeadline<T>(request: Promise<T>, signal: AbortSignal): Promise<T | null> {
  const expired = new Promise<null>((resolve) => {
    signal.addEventListener('abort', () => resolve(null), { once: true })
  })
  return Promise.race([request.catch(() => null), expired])
}

/** Blitz's wasm-bindgen imports, which no capture calls: they trap with their name instead. */
function unboundImports(module: WebAssembly.Module): WebAssembly.Imports {
  const imports: Record<string, Record<string, () => never>> = {}
  for (const { module: namespace, name } of WebAssembly.Module.imports(module)) {
    imports[namespace] ??= {}
    imports[namespace][name] = () => {
      throw new Error(`The HTML engine called its unbound import ${namespace}.${name}`)
    }
  }
  return imports
}

function engineExports(exports: WebAssembly.Exports): EngineExports {
  const { memory } = exports
  if (!(memory instanceof WebAssembly.Memory)) throw new Error('The HTML engine has no memory')
  const functions: Partial<Record<(typeof EXPORTS)[number], (...args: number[]) => number>> = {}
  for (const name of EXPORTS) {
    const exported = exports[name]
    if (typeof exported !== 'function') throw new Error(`The HTML engine lacks ${name}`)
    functions[name] = (...args) => Number(Reflect.apply(exported, undefined, args))
  }
  return {
    ...(functions as Record<(typeof EXPORTS)[number], (...args: number[]) => number>),
    memory
  }
}

/** The URL an image element's `src` resolves to, or null when it does not parse. */
function imageURL(src: string, baseURL: string | undefined): string | null {
  try {
    return new URL(src, baseURL).href
  } catch {
    return null
  }
}

/**
 * The engine lays raster images out from SVG stand-ins and reports them as SVG; `rasters` holds
 * what each stood-in URL really was, which the capture reports instead.
 */
function restoreImageKinds(
  capture: HTMLEngineCapture,
  rasters: ReadonlyMap<string, string>,
  baseURL: string | undefined
): void {
  for (const node of capture.nodes) {
    const src = node.attrs?.src
    if (node.image !== 'svg' || src === undefined) continue
    const url = imageURL(src, baseURL)
    const kind = url === null ? undefined : rasters.get(url)
    if (kind) node.image = kind
  }
}

/**
 * Blitz, Stylo, Taffy, and Parley compiled to WebAssembly: lays HTML out as a browser does and
 * captures every element's box and computed styles, and the lines its text sets. The engine holds one document at a
 * time, so layouts on one instance run one after another.
 */
export class HTMLEngine {
  readonly #exports: EngineExports
  readonly #encoder = new TextEncoder()
  readonly #decoder = new TextDecoder()
  #queue: Promise<unknown> = Promise.resolve()

  private constructor(exports: EngineExports) {
    this.#exports = exports
  }

  /** Instantiates the module from its bytes or a compiled `WebAssembly.Module`. */
  static async instantiate(source: BufferSource | WebAssembly.Module): Promise<HTMLEngine> {
    const module = source instanceof WebAssembly.Module ? source : await WebAssembly.compile(source)
    const instance = await WebAssembly.instantiate(module, unboundImports(module))
    return new HTMLEngine(engineExports(instance.exports))
  }

  #withBytes<T>(bytes: Uint8Array, use: (pointer: number, length: number) => T): T {
    const pointer = this.#exports.alloc(bytes.length)
    new Uint8Array(this.#exports.memory.buffer, pointer, bytes.length).set(bytes)
    try {
      return use(pointer, bytes.length)
    } finally {
      this.#exports.dealloc(pointer, bytes.length)
    }
  }

  #withText<T>(text: string, use: (pointer: number, length: number) => T): T {
    return this.#withBytes(this.#encoder.encode(text), use)
  }

  #output(length: number): string {
    const pointer = this.#exports.output_ptr()
    return this.#decoder.decode(new Uint8Array(this.#exports.memory.buffer, pointer, length))
  }

  /**
   * Registers a font file for layouts that start after it; `alias` also registers it under
   * that family name, as browsers alias `-apple-system` to the system font. Returns the number
   * of faces it holds.
   */
  addFont(bytes: Uint8Array, alias?: string): number {
    return this.#withBytes(bytes, (pointer, length) =>
      this.#withText(alias ?? '', (aliasPointer, aliasLength) =>
        this.#exports.font_add(pointer, length, aliasPointer, aliasLength)
      )
    )
  }

  /**
   * Sets the registered families a generic family such as `sans-serif` falls back to, in order.
   * False when none of them is registered.
   */
  setGenericFamily(generic: string, families: readonly string[]): boolean {
    return this.#withText(generic, (genericPointer, genericLength) =>
      this.#withText(families.join('\n'), (pointer, length) =>
        Boolean(this.#exports.font_generic(genericPointer, genericLength, pointer, length))
      )
    )
  }

  /** A font file as TrueType or OpenType, with WOFF and WOFF2 decompressed; others unchanged. */
  decodeFont(bytes: Uint8Array): Uint8Array {
    const length = this.#withBytes(bytes, (pointer, size) =>
      this.#exports.font_decode(pointer, size)
    )
    return new Uint8Array(this.#exports.memory.buffer, this.#exports.output_ptr(), length).slice()
  }

  /** Forgets every registered font. */
  resetFonts(): void {
    this.#exports.fonts_reset()
  }

  #pump(): [number, string][] {
    const parsed = v.safeParse(
      v.pipe(v.string(), v.parseJson(), requestsSchema),
      this.#output(this.#exports.pump())
    )
    if (!parsed.success) throw new Error('The HTML engine reported requests in an unknown shape')
    return parsed.output
  }

  /**
   * Answers one request, and returns what an image really was when the engine got a stand-in
   * for it, keyed by the URLs it was asked for and fetched from.
   */
  async #answer(
    id: number,
    url: string,
    options: HTMLEngineLayoutOptions
  ): Promise<[string[], string] | null> {
    const signal = AbortSignal.timeout(options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS)
    const { fetch } = options
    // An async wrapper turns a callback that throws before it returns into a rejection.
    const resource = fetch ? await withDeadline((async () => fetch(url, signal))(), signal) : null
    if (!resource) {
      this.#exports.fail(id)
      return null
    }
    const size = rasterImageSize(resource.bytes)
    const bytes = size ? imageStandIn(size) : resource.bytes
    this.#withText(resource.url, (urlPointer, urlLength) =>
      this.#withBytes(bytes, (pointer, length) =>
        this.#exports.provide(id, urlPointer, urlLength, pointer, length)
      )
    )
    return size ? [[url, resource.url], `raster ${size[0]}x${size[1]}`] : null
  }

  async #layout(html: string, options: HTMLEngineLayoutOptions): Promise<HTMLEngineCapture> {
    checkViewport(options.viewport)
    const { width, height } = options.viewport
    this.#withText(html, (htmlPointer, htmlLength) =>
      this.#withText(options.baseURL ?? '', (urlPointer, urlLength) =>
        this.#exports.open(htmlPointer, htmlLength, urlPointer, urlLength, width, height)
      )
    )
    // Answers can ask for more, such as a stylesheet's fonts, so pump until nothing is waiting.
    const rasters = new Map<string, string>()
    for (let requests = this.#pump(); requests.length > 0; requests = this.#pump()) {
      const answers = await Promise.all(requests.map(([id, url]) => this.#answer(id, url, options)))
      for (const [urls, kind] of answers.filter((answer) => answer !== null)) {
        for (const key of urls) rasters.set(key, kind)
      }
    }
    const parsed = v.safeParse(
      v.pipe(v.string(), v.parseJson(), captureSchema),
      this.#output(this.#exports.capture())
    )
    if (!parsed.success) throw new Error('The HTML engine captured a document in an unknown shape')
    restoreImageKinds(parsed.output, rasters, options.baseURL)
    return parsed.output
  }

  /** Lays the document out once every resource it asks for is answered, and captures it. */
  layout(html: string, options: HTMLEngineLayoutOptions): Promise<HTMLEngineCapture> {
    const run = this.#queue.then(() => this.#layout(html, options))
    this.#queue = run.catch(() => undefined)
    return run
  }
}
