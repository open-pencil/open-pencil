import { createIconifyAPIClient } from './api'
import { buildIconData } from './svg'
import type { IconData, IconSearchResult } from './types'

export interface IconSearchOptions {
  limit?: number
  /** Only icons from this set, such as `lucide`. */
  prefix?: string
}

/**
 * Where icons come from: their search and their paths. Hosts pass one to the renderer, tools,
 * and the app, so another source, such as a bundled or self-hosted set, can stand in for
 * Iconify. A provider owns its cache.
 */
export interface IconProvider {
  search(query: string, options?: IconSearchOptions): Promise<IconSearchResult>
  /** Each named icon at `size`, by name; names the source lacks are left out. */
  icons(names: readonly string[], size: number): Promise<Map<string, IconData>>
}

/** `prefix:name` split, or null when the name has no set. */
export function parseIconName(name: string): { prefix: string; iconName: string } | null {
  const colon = name.indexOf(':')
  if (colon <= 0 || colon === name.length - 1) return null
  return { prefix: name.slice(0, colon), iconName: name.slice(colon + 1) }
}

/** Icons from the Iconify API, fetched one request per set and cached by name and size. */
export function createIconifyProvider(client = createIconifyAPIClient()): IconProvider {
  const cache = new Map<string, IconData>()
  return {
    search: (query, options) => client.search(query, options),

    async icons(names, size) {
      const found = new Map<string, IconData>()
      const missing = new Map<string, string[]>()
      for (const name of names) {
        const cached = cache.get(`${name}@${size}`)
        if (cached) {
          found.set(name, cached)
          continue
        }
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
            const name = `${prefix}:${iconName}`
            const data = buildIconData(
              entry,
              prefix,
              iconName,
              collection.width ?? 24,
              collection.height ?? 24,
              size
            )
            cache.set(`${name}@${size}`, data)
            found.set(name, data)
          }
        })
      )
      return found
    }
  }
}
