import { iconToHTML, iconToSVG } from '@iconify/utils'
import { chunk } from 'es-toolkit'

import { createIconifyAPIClient } from './api'
import { buildIconData } from './svg'
import type { IconCollection, IconData, IconifyIconEntry, IconSearchResult } from './types'

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
  /** The icon sets to choose from, for filtering a search or browsing one set. */
  collections(): Promise<IconCollection[]>
  /** Every icon in the set `prefix`, as `prefix:name`, for browsing without a query. */
  browse(prefix: string): Promise<string[]>
}

/** `prefix:name` split, or null when the name has no set. */
export function parseIconName(name: string): { prefix: string; iconName: string } | null {
  const colon = name.indexOf(':')
  if (colon <= 0 || colon === name.length - 1) return null
  return { prefix: name.slice(0, colon), iconName: name.slice(colon + 1) }
}

/** Names per request, so the query string of a long list stays well within URL limits. */
const NAMES_PER_REQUEST = 100

/** An icon's body and box, with the set's default box filled in. */
type IconEntry = Required<IconifyIconEntry>

/**
 * Icons from the Iconify API, fetched one request per set and cached by name, so search
 * previews and placed icons share what was loaded.
 */
export function createIconifyProvider(client = createIconifyAPIClient()): IconProvider {
  const entries = new Map<string, IconEntry>()
  const built = new Map<string, IconData>()
  // Shared answers; a failed one is dropped so the next call asks again.
  let catalogue: Promise<IconCollection[]> | null = null
  const sets = new Map<string, Promise<string[]>>()

  function remember<T>(promise: Promise<T>, forget: () => void): Promise<T> {
    void promise.catch(forget)
    return promise
  }

  /** Names the source answered without, so they are not asked for again. */
  const absent = new Set<string>()
  /** Requests on their way, by the names they ask for, so overlapping calls share them. */
  const loading = new Map<string, Promise<void>>()

  async function request(prefix: string, iconNames: string[]): Promise<void> {
    const collection = await client.fetchCollection(prefix, iconNames)
    for (const iconName of iconNames) {
      const parent = collection.aliases?.[iconName]?.parent
      const entry = collection.icons[iconName] ?? (parent ? collection.icons[parent] : undefined)
      const name = `${prefix}:${iconName}`
      if (!entry) {
        absent.add(name)
        continue
      }
      entries.set(name, {
        body: entry.body,
        width: entry.width ?? collection.width ?? 24,
        height: entry.height ?? collection.height ?? 24
      })
    }
  }

  async function load(names: readonly string[]): Promise<void> {
    const waiting = new Set<Promise<void>>()
    const needed = new Map<string, string[]>()
    for (const name of names) {
      if (entries.has(name) || absent.has(name)) continue
      const pending = loading.get(name)
      if (pending) {
        waiting.add(pending)
        continue
      }
      const parsed = parseIconName(name)
      if (!parsed)
        throw new Error(
          `Invalid icon name "${name}". Use prefix:name format (e.g. lucide:heart, mdi:home)`
        )
      needed.set(parsed.prefix, [...(needed.get(parsed.prefix) ?? []), parsed.iconName])
    }
    for (const [prefix, iconNames] of needed) {
      for (const part of chunk(iconNames, NAMES_PER_REQUEST)) {
        const pending = request(prefix, part)
        const keys = part.map((iconName) => `${prefix}:${iconName}`)
        for (const key of keys) loading.set(key, pending)
        // Settled either way, the names leave the queue; a failure can be asked for again.
        const settle = () => {
          for (const key of keys) if (loading.get(key) === pending) loading.delete(key)
        }
        void pending.then(settle, settle)
        waiting.add(pending)
      }
    }
    await Promise.all(waiting)
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

    collections() {
      catalogue ??= remember(client.collections(), () => {
        catalogue = null
      })
      return catalogue
    },

    browse(prefix) {
      const cached = sets.get(prefix)
      if (cached) return cached
      const listed = remember(client.collectionIcons(prefix), () => sets.delete(prefix))
      sets.set(prefix, listed)
      return listed
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
