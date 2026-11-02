import type { IconOptions } from '@open-pencil/scene-graph/icons'

import {
  fetchMaterialSymbolsCatalogue,
  type MaterialSymbolsEntry
} from '#core/icons/material-symbols/catalogue'
import {
  fetchMaterialSymbolsFont,
  isMaterialSymbolsPrefix,
  MATERIAL_SYMBOLS_OPTIONS,
  MATERIAL_SYMBOLS_PREFIXES,
  MATERIAL_SYMBOLS_SETS,
  materialSymbolsGlyph,
  materialSymbolsOptions,
  materialSymbolsPath,
  materialSymbolsPathData,
  type MaterialSymbolsFont,
  type MaterialSymbolsPrefix
} from '#core/icons/material-symbols/font'
import { parseIconName, type IconProvider } from '#core/icons/provider'
import type { IconCollection, IconData } from '#core/icons/types'

/** The size previews are drawn at, which their SVG scales. */
const PREVIEW_SIZE = 24
/** Names asked of Google at once, which its URL limit holds comfortably. */
const NAMES_PER_FONT = 150

/** The sets a search looks in: the one asked for when it is ours, every one when none is. */
function searchedSets(prefix: string | undefined): readonly MaterialSymbolsPrefix[] {
  if (!prefix) return MATERIAL_SYMBOLS_PREFIXES
  return isMaterialSymbolsPrefix(prefix) ? [prefix] : []
}

/** A loaded icon: the font that holds it and its glyph there. */
interface LoadedGlyph {
  font: MaterialSymbolsFont
  glyph: number
}

/**
 * Material Symbols, drawn from Google's variable fonts at any of their axes: each font is asked
 * for just the icons wanted, and each icon's options are the axes it is drawn at. The catalogue,
 * for searching and browsing, comes from Google too, and is loaded the first time it is needed.
 */
export function createMaterialSymbolsProvider(
  fetcher: typeof globalThis.fetch = globalThis.fetch
): IconProvider {
  let catalogue: Promise<MaterialSymbolsEntry[]> | null = null
  const loaded = new Map<string, LoadedGlyph | null>()
  const pending = new Map<string, Promise<void>>()

  function entries(): Promise<MaterialSymbolsEntry[]> {
    catalogue ??= fetchMaterialSymbolsCatalogue(fetcher)
    // A failed catalogue is asked for again next time.
    catalogue.catch(() => {
      catalogue = null
    })
    return catalogue
  }

  async function fetchGlyphs(prefix: MaterialSymbolsPrefix, names: string[]): Promise<void> {
    const font = await fetchMaterialSymbolsFont(fetcher, prefix, names)
    for (const name of names) {
      const glyph = materialSymbolsGlyph(font, name)
      loaded.set(`${prefix}:${name}`, glyph === null ? null : { font, glyph })
    }
  }

  /**
   * Loads the fonts holding `names`, one request per set for the names not yet loaded. A font
   * that fails leaves its names out; only when every one fails does loading fail.
   */
  async function load(names: readonly string[]): Promise<void> {
    const waiting = new Set<Promise<void>>()
    const wanted = new Map<MaterialSymbolsPrefix, string[]>()
    for (const name of names) {
      const parsed = parseIconName(name)
      if (!parsed || !isMaterialSymbolsPrefix(parsed.prefix) || loaded.has(name)) continue
      const request = pending.get(name)
      if (request) waiting.add(request)
      else wanted.set(parsed.prefix, [...(wanted.get(parsed.prefix) ?? []), parsed.iconName])
    }
    for (const [prefix, iconNames] of wanted) {
      for (let start = 0; start < iconNames.length; start += NAMES_PER_FONT) {
        const part = iconNames.slice(start, start + NAMES_PER_FONT)
        const request = fetchGlyphs(prefix, part)
        const keys = part.map((iconName) => `${prefix}:${iconName}`)
        for (const key of keys) pending.set(key, request)
        const settle = () => {
          for (const key of keys) if (pending.get(key) === request) pending.delete(key)
        }
        void request.then(settle, settle)
        waiting.add(request)
      }
    }
    const settled = await Promise.allSettled(waiting)
    const failed = settled.find((result) => result.status === 'rejected')
    if (failed && settled.every((result) => result.status === 'rejected')) throw failed.reason
  }

  function iconData(name: string, size: number, options: IconOptions): IconData | null {
    const glyph = loaded.get(name)
    const parsed = parseIconName(name)
    if (!glyph || !parsed) return null
    const axes = materialSymbolsOptions(options)
    return {
      prefix: parsed.prefix,
      name: parsed.iconName,
      width: size,
      height: size,
      paths: [materialSymbolsPath(glyph.font, glyph.glyph, size, axes)],
      options: axes
    }
  }

  return {
    async search(query, options = {}) {
      const term = query.trim().toLowerCase().replace(/\s+/g, '_')
      const prefixes = searchedSets(options.prefix)
      const found: string[] = []
      for (const entry of await entries()) {
        if (!entry.name.includes(term)) continue
        for (const prefix of prefixes)
          if (entry.sets.has(prefix)) found.push(`${prefix}:${entry.name}`)
      }
      const icons = found.slice(0, options.limit ?? found.length)
      const collections = Object.fromEntries(
        prefixes.map((prefix) => [
          prefix,
          {
            name: MATERIAL_SYMBOLS_SETS[prefix],
            total: icons.filter((name) => name.startsWith(`${prefix}:`)).length
          }
        ])
      )
      return { icons, total: icons.length, collections }
    },

    async collections(): Promise<IconCollection[]> {
      const listed = await entries()
      return MATERIAL_SYMBOLS_PREFIXES.map((prefix) => ({
        prefix,
        name: MATERIAL_SYMBOLS_SETS[prefix],
        total: listed.filter((entry) => entry.sets.has(prefix)).length,
        category: 'Material',
        license: 'Apache 2.0',
        multicolor: false,
        options: MATERIAL_SYMBOLS_OPTIONS
      }))
    },

    async browse(prefix) {
      if (!isMaterialSymbolsPrefix(prefix)) return []
      return (await entries())
        .filter((entry) => entry.sets.has(prefix))
        .map((entry) => `${prefix}:${entry.name}`)
    },

    async icons(names, size, options = {}) {
      await load(names)
      const found = new Map<string, IconData>()
      for (const name of names) {
        const icon = iconData(name, size, options)
        if (icon) found.set(name, icon)
      }
      return found
    },

    async previews(names) {
      await load(names)
      const found = new Map<string, string>()
      for (const name of names) {
        const glyph = loaded.get(name)
        if (!glyph) continue
        const data = materialSymbolsPathData(
          glyph.font,
          glyph.glyph,
          PREVIEW_SIZE,
          materialSymbolsOptions()
        )
        found.set(
          name,
          `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 ${PREVIEW_SIZE} ${PREVIEW_SIZE}"><path fill="currentColor" d="${data}"/></svg>`
        )
      }
      return found
    }
  }
}
