import { iconToHTML, iconToSVG } from '@iconify/utils'

import { createIconifyAPIClient } from './api'
import { buildIconData } from './svg'
import type { IconData, IconifyIconEntry, IconSearchResult } from './types'

export interface IconSearchOptions {
  limit?: number
  /** Only icons from this set, such as `lucide`. */
  prefix?: string
}

/**
 * Where icons come from: their search, their paths, and their previews. Hosts pass one to the
 * renderer, tools, and the app, so another source, such as a bundled or self-hosted set, can
 * stand in for Iconify. A provider owns its cache.
 */
export interface IconProvider {
  search(query: string, options?: IconSearchOptions): Promise<IconSearchResult>
  /** Each named icon at `size`, by name; names the source lacks are left out. */
  icons(names: readonly string[], size: number): Promise<Map<string, IconData>>
  /**
   * Each named icon as SVG markup for pickers to show, painted in `currentColor` where the icon
   * takes its color; names the source lacks are left out.
   */
  previews(names: readonly string[]): Promise<Map<string, string>>
}

/** `prefix:name` split, or null when the name has no set. */
export function parseIconName(name: string): { prefix: string; iconName: string } | null {
  const colon = name.indexOf(':')
  if (colon <= 0 || colon === name.length - 1) return null
  return { prefix: name.slice(0, colon), iconName: name.slice(colon + 1) }
}

/** An icon's body and box, with the set's default box filled in. */
type IconEntry = Required<IconifyIconEntry>

/**
 * Icons from the Iconify API, fetched one request per set and cached by name, so search
 * previews and placed icons share what was loaded.
 */
export function createIconifyProvider(client = createIconifyAPIClient()): IconProvider {
  const entries = new Map<string, IconEntry>()
  const built = new Map<string, IconData>()

  async function load(names: readonly string[]): Promise<void> {
    const missing = new Map<string, string[]>()
    for (const name of names) {
      if (entries.has(name)) continue
      const parsed = parseIconName(name)
      if (!parsed)
        throw new Error(
          `Invalid icon name "${name}". Use prefix:name format (e.g. lucide:heart, mdi:home)`
        )
      missing.set(parsed.prefix, [...(missing.get(parsed.prefix) ?? []), parsed.iconName])
    }
    await Promise.all(
      [...missing].map(async ([prefix, iconNames]) => {
        const collection = await client.fetchCollection(prefix, iconNames)
        for (const iconName of iconNames) {
          const parent = collection.aliases?.[iconName]?.parent
          const entry =
            collection.icons[iconName] ?? (parent ? collection.icons[parent] : undefined)
          if (!entry) continue
          entries.set(`${prefix}:${iconName}`, {
            body: entry.body,
            width: entry.width ?? collection.width ?? 24,
            height: entry.height ?? collection.height ?? 24
          })
        }
      })
    )
  }

  return {
    search: (query, options) => client.search(query, options),

    async icons(names, size) {
      await load(names)
      const found = new Map<string, IconData>()
      for (const name of names) {
        const entry = entries.get(name)
        const parsed = parseIconName(name)
        if (!entry || !parsed) continue
        const key = `${name}@${size}`
        const icon =
          built.get(key) ??
          buildIconData(entry, parsed.prefix, parsed.iconName, entry.width, entry.height, size)
        built.set(key, icon)
        found.set(name, icon)
      }
      return found
    },

    async previews(names) {
      await load(names)
      const found = new Map<string, string>()
      for (const name of names) {
        const entry = entries.get(name)
        if (!entry) continue
        const { attributes, body } = iconToSVG(entry)
        found.set(name, iconToHTML(body, attributes))
      }
      return found
    }
  }
}
