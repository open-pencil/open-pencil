import * as v from 'valibot'

import { parseColor } from '@open-pencil/scene-graph/color'
import type { IconOptions } from '@open-pencil/scene-graph/icons'
import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'

import { tintedIconPath } from '#core/icons/artwork'
import { resolveIconOptions } from '#core/icons/options'
import { parseIconName, type IconProvider } from '#core/icons/provider'
import type {
  IconCollection,
  IconData,
  IconOption,
  IconPath,
  IconSearchResult
} from '#core/icons/types'

export const SF_SYMBOLS_PREFIX = 'sf-symbols'

/** How SF Symbols can be drawn, as SwiftUI draws them. */
export const SF_SYMBOLS_OPTIONS = [
  {
    key: 'weight',
    name: 'Weight',
    values: [
      'ultralight',
      'thin',
      'light',
      'regular',
      'medium',
      'semibold',
      'bold',
      'heavy',
      'black'
    ],
    default: 'regular'
  },
  { key: 'scale', name: 'Scale', values: ['small', 'medium', 'large'], default: 'medium' },
  {
    key: 'rendering',
    name: 'Rendering',
    values: ['monochrome', 'hierarchical', 'palette', 'multicolor'],
    default: 'monochrome'
  },
  // How much of a symbol with variable color is on, such as the bars of `wifi`.
  { key: 'variable', name: 'Variable value', min: 0, max: 1, default: 1, step: 0.01 },
  // The palette's primary color is the icon's color; these paint its other layers.
  {
    key: 'secondary',
    name: 'Secondary color',
    color: true,
    default: '#007AFF',
    when: { key: 'rendering', value: 'palette' }
  },
  {
    key: 'tertiary',
    name: 'Tertiary color',
    color: true,
    default: '#8E8E93',
    when: { key: 'rendering', value: 'palette' }
  }
] as const satisfies readonly IconOption[]

/** The size previews are drawn at, which their SVG scales. */
const PREVIEW_SIZE = 24

/**
 * What draws SF Symbols: the Mac the app runs on, since Apple licenses them for its own platforms
 * only. Both answer JSON, or null where the symbols cannot be drawn as outlines.
 */
export interface SFSymbolsHost {
  catalogue(): Promise<string | null>
  /** Draws `names` at a point size with the options set, in one request. */
  render(request: string): Promise<string | null>
}

const catalogueSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({
    names: v.array(v.string()),
    keywords: v.record(v.string(), v.array(v.string()))
  })
)

const renderedSchema = v.pipe(
  v.string(),
  v.parseJson(),
  v.record(
    v.string(),
    v.object({
      paths: v.array(
        v.object({
          d: v.string(),
          opacity: v.number(),
          /** The palette color that paints the path, 0 for the primary, in palette rendering. */
          layer: v.optional(v.number()),
          /** A color of the symbol's own, in multicolor rendering. */
          color: v.optional(v.string())
        })
      )
    })
  )
)

type Catalogue = v.InferOutput<typeof catalogueSchema>
/** The symbols drawn, by name; those the Mac lacks are left out. */
type Rendered = Partial<v.InferOutput<typeof renderedSchema>>

/** Every option that applies, each a value the set offers, defaulted where `options` leaves it out. */
export function sfSymbolsOptions(options: IconOptions = {}): Record<string, string | number> {
  return resolveIconOptions(SF_SYMBOLS_OPTIONS, options)
}

type RenderedPath = v.InferOutput<typeof renderedSchema>[string]['paths'][number]

/**
 * A drawn path as an icon path: in the icon's color, or in a color of its own when the symbol
 * keeps one or a palette color other than the primary paints it.
 */
/** The options that color a palette's layers past the primary, which is the icon's color. */
const PALETTE_LAYERS = [null, 'secondary', 'tertiary'] as const

function iconPath(path: RenderedPath, options: Record<string, string | number>): IconPath {
  const network = parseSVGPath(path.d, 'NONZERO')
  const layer = path.layer === undefined ? null : PALETTE_LAYERS[path.layer]
  const own = path.color ?? (layer ? options[layer] : null)
  if (typeof own !== 'string') return tintedIconPath(network, path.opacity)
  return {
    vectorNetwork: network,
    fills: [{ type: 'SOLID', color: parseColor(own), opacity: path.opacity, visible: true }],
    strokes: [],
    tint: []
  }
}

/**
 * SF Symbols, drawn as outlines by `host` at the weight, scale, and rendering each icon sets.
 * Without a host, or where it cannot draw them, the set is listed as unavailable and has no icons,
 * so a picker can say where they are offered.
 */
export function createSFSymbolsProvider(host: SFSymbolsHost | null): IconProvider {
  let catalogue: Promise<Catalogue | null> | null = null
  const previewCache = new Map<string, string | null>()

  function listed(): Promise<Catalogue | null> {
    if (!host) return Promise.resolve(null)
    catalogue ??= host.catalogue().then((text) => {
      if (text === null) return null
      const parsed = v.safeParse(catalogueSchema, text)
      return parsed.success ? parsed.output : null
    })
    // A failed catalogue is asked for again next time.
    catalogue.catch(() => {
      catalogue = null
    })
    return catalogue
  }

  async function render(
    names: readonly string[],
    size: number,
    options: Record<string, string | number>
  ): Promise<Rendered> {
    const iconNames = names.flatMap((name) => {
      const parsed = parseIconName(name)
      return parsed?.prefix === SF_SYMBOLS_PREFIX ? [parsed.iconName] : []
    })
    if (!host || iconNames.length === 0) return {}
    const text = await host.render(JSON.stringify({ names: iconNames, size, ...options }))
    if (text === null) return {}
    const parsed = v.safeParse(renderedSchema, text)
    return parsed.success ? parsed.output : {}
  }

  return {
    async search(query, options = {}): Promise<IconSearchResult> {
      const symbols = options.prefix && options.prefix !== SF_SYMBOLS_PREFIX ? null : await listed()
      if (!symbols) return { icons: [], total: 0, collections: {} }
      const term = query.trim().toLowerCase().replace(/\s+/g, '.')
      const found = symbols.names.filter(
        (name) =>
          name.includes(term) || symbols.keywords[name]?.some((keyword) => keyword.includes(term))
      )
      const icons = found
        .slice(0, options.limit ?? found.length)
        .map((name) => `${SF_SYMBOLS_PREFIX}:${name}`)
      return {
        icons,
        total: found.length,
        collections: { [SF_SYMBOLS_PREFIX]: { name: 'SF Symbols', total: found.length } }
      }
    },

    async collections(): Promise<IconCollection[]> {
      const symbols = await listed()
      return [
        {
          prefix: SF_SYMBOLS_PREFIX,
          name: 'SF Symbols',
          total: symbols?.names.length ?? 0,
          category: 'Apple',
          license: 'Apple',
          multicolor: false,
          options: SF_SYMBOLS_OPTIONS,
          ...(symbols ? {} : { unavailable: host ? 'system' : 'host' })
        }
      ]
    },

    async browse(prefix) {
      if (prefix !== SF_SYMBOLS_PREFIX) return []
      return ((await listed())?.names ?? []).map((name) => `${SF_SYMBOLS_PREFIX}:${name}`)
    },

    async icons(names, size, options = {}) {
      const set = sfSymbolsOptions(options)
      const rendered = await render(names, size, set)
      const found = new Map<string, IconData>()
      for (const name of names) {
        const parsed = parseIconName(name)
        const icon = parsed?.prefix === SF_SYMBOLS_PREFIX ? rendered[parsed.iconName] : undefined
        if (!parsed || !icon) continue
        found.set(name, {
          prefix: parsed.prefix,
          name: parsed.iconName,
          width: size,
          height: size,
          paths: icon.paths.map((path) => iconPath(path, set)),
          options: set
        })
      }
      return found
    },

    async previews(names) {
      const missing = names.filter((name) => !previewCache.has(name))
      const rendered = await render(missing, PREVIEW_SIZE, sfSymbolsOptions())
      for (const name of missing) {
        const parsed = parseIconName(name)
        const icon = parsed?.prefix === SF_SYMBOLS_PREFIX ? rendered[parsed.iconName] : undefined
        previewCache.set(
          name,
          icon
            ? `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 ${PREVIEW_SIZE} ${PREVIEW_SIZE}">${icon.paths
                .map(
                  (path) =>
                    `<path fill="currentColor" fill-opacity="${path.opacity}" d="${path.d}"/>`
                )
                .join('')}</svg>`
            : null
        )
      }
      const found = new Map<string, string>()
      for (const name of names) {
        const preview = previewCache.get(name)
        if (preview) found.set(name, preview)
      }
      return found
    }
  }
}
