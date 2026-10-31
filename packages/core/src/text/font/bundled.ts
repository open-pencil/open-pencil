import { IS_BROWSER } from '#core/constants'

/** Inter's weights, each drawn from Inter's variable files at its named instance. */
const INTER_WEIGHTS = [
  'Thin',
  'ExtraLight',
  'Light',
  'Regular',
  'Medium',
  'SemiBold',
  'Bold',
  'ExtraBold',
  'Black'
]

/** The font files bundled in `@open-pencil/core/assets`, by family and style key. */
const BUNDLED_FONTS: Record<string, string> = {
  ...Object.fromEntries(INTER_WEIGHTS.map((weight) => [`Inter|${weight}`, '/InterVariable.ttf'])),
  ...Object.fromEntries(
    INTER_WEIGHTS.map((weight) => [`Inter|${weight} Italic`, '/InterVariable-Italic.ttf'])
  ),
  'Noto Naskh Arabic|Regular': '/NotoNaskhArabic-Regular.ttf',
  'OpenPencil Emoji Metrics|Regular': '/OpenPencilEmojiMetrics-Regular.ttf'
}

/**
 * Maps a bundled font's file name (`InterVariable.ttf`) to the URL a browser fetches it from.
 * Mirrors CanvasKit's `locateFile`; the default expects the host to serve
 * `@open-pencil/core/assets` at the site root.
 */
export type BundledFontLocator = (file: string) => string

const defaultBundledFontLocator: BundledFontLocator = (file) => `/${file}`

/** The bundled fonts: which file draws each face, and reading the files where the host put them. */
export class BundledFonts {
  private locate: BundledFontLocator = defaultBundledFontLocator
  private readonly requests = new Map<string, Promise<ArrayBuffer | null>>()

  /** Lets a host that bundles `@open-pencil/core/assets` itself say where each file ended up. */
  setLocator(locate: BundledFontLocator | null): void {
    this.locate = locate ?? defaultBundledFontLocator
  }

  /** The file that draws a face, or nothing for a face not bundled. */
  file(family: string, style: string): string | undefined {
    return BUNDLED_FONTS[`${family}|${style}`]
  }

  /** The style keys a family's bundled faces are loaded as. */
  styles(family: string): string[] {
    return Object.keys(BUNDLED_FONTS)
      .filter((key) => key.startsWith(`${family}|`))
      .map((key) => key.slice(family.length + 1))
  }

  /**
   * Reads a bundled font. Concurrent loads of one face share a request, so they get the same
   * buffer; it is forgotten once settled, so a failed request can be retried.
   */
  fetch(url: string): Promise<ArrayBuffer | null> {
    const pending = this.requests.get(url)
    if (pending) return pending
    const request = this.read(url).finally(() => this.requests.delete(url))
    this.requests.set(url, request)
    return request
  }

  private async read(url: string): Promise<ArrayBuffer | null> {
    if (IS_BROWSER) {
      const response = await fetch(this.locate(url.replace(/^\//, '')))
      // A missing file answers with an error page, which must not be read as a font.
      return response.ok ? response.arrayBuffer() : null
    }
    const { readFile } = await import(/* @vite-ignore */ 'node:fs/promises')
    const packageJSONURL = import.meta.resolve('@open-pencil/core/package.json')
    const buf = await readFile(new URL(`assets${url}`, packageJSONURL))
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  }
}
