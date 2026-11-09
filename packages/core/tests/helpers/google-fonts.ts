import { fontManager, type FontManager, type WebFontFetch } from '@open-pencil/core/text'

/** A file a fake Google Fonts family serves, as one `@font-face` rule of its stylesheet. */
export interface GoogleFontFile {
  url: string
  /** The file's bytes; a file without them is listed in the stylesheet but not served. */
  data?: ArrayBuffer
  /** The rule's `font-weight`, such as `400` or `'100 900'`; 400 when left out. */
  weight?: number | string
  /** The rule's `unicode-range`, for a family split into several files. */
  range?: string
}

/** A family a fake Google Fonts lists, and the files its stylesheet serves. */
export interface GoogleFontFamily {
  family: string
  /** The weights Google's metadata lists for the family; 400 alone when left out. */
  weights?: number[]
  axes?: { tag: string; min: number; max: number }[]
  files?: GoogleFontFile[]
}

export interface FakeGoogleFonts {
  /** Answers as Google Fonts does for the families, and 404 for any other URL. */
  fetch: WebFontFetch
  /** Each stylesheet requested, in order. */
  stylesheets: URL[]
}

function fontFaceRule(family: string, { url, weight = 400, range }: GoogleFontFile): string {
  const format = url.endsWith('.woff2') ? 'woff2' : 'truetype'
  const unicodeRange = range ? ` unicode-range: ${range};` : ''
  return `@font-face { font-family: '${family}'; font-style: normal; font-weight: ${weight}; src: url(${url}) format('${format}');${unicodeRange} }`
}

/**
 * Google Fonts serving `families`, and `icons` from its icon catalogue: the metadata of each, a
 * stylesheet with a rule for each file of each family it asks for, and the files. Each answer is
 * a new response, so a body is never read twice.
 */
export function fakeGoogleFonts(
  families: GoogleFontFamily[],
  icons: GoogleFontFamily[] = []
): FakeGoogleFonts {
  const stylesheets: URL[] = []
  const all = [...families, ...icons]
  const byName = new Map(all.map((family) => [family.family, family]))
  const files = new Map(
    all.flatMap(({ files = [] }) => files.map((file) => [file.url, file.data] as const))
  )
  const fetch: WebFontFetch = async (input) => {
    const url = new URL(input)
    if (url.href.startsWith('https://fonts.google.com/metadata/fonts'))
      return Response.json({
        familyMetadataList: families.map(({ family, weights = [400], axes = [] }) => ({
          family,
          fonts: Object.fromEntries(weights.map((weight) => [String(weight), {}])),
          axes
        }))
      })
    if (url.href.startsWith('https://fonts.google.com/metadata/icons'))
      return new Response(`)]}'\n${JSON.stringify({ families: icons.map(({ family }) => family) })}`)
    if (url.href.startsWith('https://fonts.googleapis.com/css2')) {
      stylesheets.push(url)
      const rules = url.searchParams.getAll('family').flatMap((param) => {
        const name = param.split(':')[0]
        return (byName.get(name)?.files ?? []).map((file) => fontFaceRule(name, file))
      })
      return new Response(rules.join('\n'))
    }
    const data = files.get(url.href)
    return data ? new Response(data.slice(0)) : new Response(null, { status: 404 })
  }
  return { fetch, stylesheets }
}

/**
 * Runs `run` with Google Fonts, faked by `google`, as the font manager's only online provider,
 * then gives the manager back its providers and no web font fetch.
 */
export async function withGoogleFonts<T>(
  google: FakeGoogleFonts,
  run: () => Promise<T>,
  manager: FontManager = fontManager
): Promise<T> {
  const providers = manager.enabledOnlineFontProviders()
  manager.setOnlineFontProviders({ google: true })
  manager.setWebFontFetch(google.fetch)
  try {
    return await run()
  } finally {
    manager.setWebFontFetch(null)
    manager.setOnlineFontProviders(
      Object.fromEntries(providers.map((provider) => [provider, true]))
    )
  }
}
