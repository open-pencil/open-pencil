import svgpath from 'svgpath'

import { parseSVGPath } from './svg-path-parse'

import type { VectorNetwork, WindingRule } from './scene-graph'

const ICONIFY_API = 'https://api.iconify.design'
const FETCH_TIMEOUT_MS = 10_000

interface PathInfo {
  d: string
  fill: string | null
  fillExplicit: boolean
  stroke: string | null
  strokeExplicit: boolean
  strokeWidth: number
  strokeWidthExplicit: boolean
  strokeCap: string
  strokeCapExplicit: boolean
  strokeJoin: string
  strokeJoinExplicit: boolean
  fillRule: WindingRule
}

export interface IconPath {
  vectorNetwork: VectorNetwork
  fill: string | null
  stroke: string | null
  strokeWidth: number
  strokeCap: string
  strokeJoin: string
}

export interface IconData {
  prefix: string
  name: string
  width: number
  height: number
  paths: IconPath[]
}

interface IconifyIconEntry {
  body: string
  width?: number
  height?: number
}

interface IconifyResponse {
  prefix: string
  width?: number
  height?: number
  icons: { [key: string]: IconifyIconEntry | undefined }
  aliases?: { [key: string]: { parent: string } | undefined }
}

const iconCache = new Map<string, IconData>()

export function clearIconCache(): void {
  iconCache.clear()
}

function parseIconName(name: string): { prefix: string; iconName: string } {
  const colonIdx = name.indexOf(':')
  if (colonIdx === -1) {
    throw new Error(`Invalid icon name "${name}". Use prefix:name format (e.g. lucide:heart, mdi:home)`)
  }
  return { prefix: name.slice(0, colonIdx), iconName: name.slice(colonIdx + 1) }
}

function attrValue(tag: string, attr: string): string | null {
  const re = new RegExp(`\\b${attr}="([^"]*)"`)
  const m = tag.match(re)
  return m ? m[1] : null
}

function extractPaths(svgBody: string): PathInfo[] {
  const result: PathInfo[] = []
  const pathRe = /<path\b[^>]*>/g
  let match
  while ((match = pathRe.exec(svgBody)) !== null) {
    const tag = match[0]
    const d = attrValue(tag, 'd')
    if (!d) continue

    const fillAttr = attrValue(tag, 'fill')
    const strokeAttr = attrValue(tag, 'stroke')
    const strokeWidthAttr = attrValue(tag, 'stroke-width')
    const strokeCapAttr = attrValue(tag, 'stroke-linecap')
    const strokeJoinAttr = attrValue(tag, 'stroke-linejoin')
    const fillRuleAttr = attrValue(tag, 'fill-rule')

    result.push({
      d,
      fill: fillAttr === 'none' ? null : (fillAttr ?? null),
      fillExplicit: fillAttr !== null,
      stroke: strokeAttr === 'none' ? null : (strokeAttr ?? null),
      strokeExplicit: strokeAttr !== null,
      strokeWidth: strokeWidthAttr ? parseFloat(strokeWidthAttr) : 1,
      strokeWidthExplicit: strokeWidthAttr !== null,
      strokeCap: strokeCapAttr ?? 'butt',
      strokeCapExplicit: strokeCapAttr !== null,
      strokeJoin: strokeJoinAttr ?? 'miter',
      strokeJoinExplicit: strokeJoinAttr !== null,
      fillRule: fillRuleAttr === 'evenodd' ? 'EVENODD' : 'NONZERO'
    })
  }
  return result
}

interface GroupAttrs {
  fill: string | null
  stroke: string | null
  strokeWidth: string | null
  strokeCap: string | null
  strokeJoin: string | null
}

function collectGroupAttrs(svgBody: string): GroupAttrs {
  const attrs: GroupAttrs = { fill: null, stroke: null, strokeWidth: null, strokeCap: null, strokeJoin: null }
  const groupRe = /<g\b[^>]*>/g
  let gMatch
  while ((gMatch = groupRe.exec(svgBody)) !== null) {
    const gTag = gMatch[0]
    attrs.fill ??= attrValue(gTag, 'fill')
    attrs.stroke ??= attrValue(gTag, 'stroke')
    attrs.strokeWidth ??= attrValue(gTag, 'stroke-width')
    attrs.strokeCap ??= attrValue(gTag, 'stroke-linecap')
    attrs.strokeJoin ??= attrValue(gTag, 'stroke-linejoin')
  }
  return attrs
}

function resolveAttr(value: string | null): string | null {
  return value === 'none' ? null : value
}

function inheritGroupAttrs(svgBody: string, paths: PathInfo[]): void {
  const g = collectGroupAttrs(svgBody)

  for (const p of paths) {
    if (!p.fillExplicit) p.fill = g.fill ? resolveAttr(g.fill) : (p.fill ?? 'currentColor')
    if (!p.strokeExplicit && g.stroke) p.stroke = resolveAttr(g.stroke)
    if (!p.strokeWidthExplicit && g.strokeWidth) p.strokeWidth = parseFloat(g.strokeWidth)
    if (!p.strokeCapExplicit && g.strokeCap) p.strokeCap = g.strokeCap
    if (!p.strokeJoinExplicit && g.strokeJoin) p.strokeJoin = g.strokeJoin
  }
}

function scalePaths(paths: PathInfo[], srcW: number, srcH: number, targetSize: number): PathInfo[] {
  if (srcW === targetSize && srcH === targetSize) return paths
  const sx = targetSize / srcW
  const sy = targetSize / srcH
  return paths.map((p) => ({
    ...p,
    d: svgpath(p.d).scale(sx, sy).round(2).toString(),
    strokeWidth: p.strokeWidth * Math.min(sx, sy)
  }))
}

function fetchWithTimeout(url: string): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
}

function buildIconData(
  iconEntry: IconifyIconEntry,
  prefix: string,
  iconName: string,
  defaultW: number,
  defaultH: number,
  size: number
): IconData {
  const srcW = iconEntry.width ?? defaultW
  const srcH = iconEntry.height ?? defaultH

  let pathInfos = extractPaths(iconEntry.body)
  inheritGroupAttrs(iconEntry.body, pathInfos)
  pathInfos = scalePaths(pathInfos, srcW, srcH, size)

  return {
    prefix,
    name: iconName,
    width: size,
    height: size,
    paths: pathInfos.map((p) => ({
      vectorNetwork: parseSVGPath(p.d, p.fillRule),
      fill: p.fill,
      stroke: p.stroke,
      strokeWidth: p.strokeWidth,
      strokeCap: p.strokeCap,
      strokeJoin: p.strokeJoin
    }))
  }
}

export async function fetchIcon(name: string, size = 24): Promise<IconData> {
  const results = await fetchIcons([name], size)
  const result = results.get(name)
  if (!result) throw new Error(`Icon "${name}" not found. Check the name at https://icon-sets.iconify.design/`)
  return result
}

/**
 * Batch-fetch multiple icons. Groups by prefix to minimize HTTP requests
 * (one request per prefix, e.g. `lucide.json?icons=heart,home,star`).
 */
export async function fetchIcons(names: string[], size = 24): Promise<Map<string, IconData>> {
  const results = new Map<string, IconData>()
  const toFetch = new Map<string, string[]>()

  for (const name of names) {
    const cacheKey = `${name}@${size}`
    const cached = iconCache.get(cacheKey)
    if (cached) {
      results.set(name, cached)
      continue
    }
    const { prefix, iconName } = parseIconName(name)
    const group = toFetch.get(prefix) ?? []
    group.push(iconName)
    toFetch.set(prefix, group)
  }

  const fetches = [...toFetch.entries()].map(async ([prefix, iconNames]) => {
    const url = `${ICONIFY_API}/${prefix}.json?icons=${iconNames.map(encodeURIComponent).join(',')}`
    const response = await fetchWithTimeout(url)
    if (!response.ok) throw new Error(`Iconify API error: ${response.status} for prefix "${prefix}"`)
    const data = (await response.json()) as IconifyResponse
    const defaultW = data.width ?? 24
    const defaultH = data.height ?? 24

    for (const iconName of iconNames) {
      const fullName = `${prefix}:${iconName}`
      let entry = data.icons[iconName]
      if (!entry) {
        const alias = data.aliases?.[iconName]
        if (alias) entry = data.icons[alias.parent]
      }
      if (!entry) continue
      const iconData = buildIconData(entry, prefix, iconName, defaultW, defaultH, size)
      iconCache.set(`${fullName}@${size}`, iconData)
      results.set(fullName, iconData)
    }
  })

  await Promise.all(fetches)
  return results
}

export interface IconSearchResult {
  icons: string[]
  total: number
  collections: Record<string, { name: string; total: number; category?: string }>
}

export async function searchIcons(query: string, options?: {
  limit?: number
  prefix?: string
}): Promise<IconSearchResult> {
  const params = new URLSearchParams({ query })
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.prefix) params.set('prefix', options.prefix)

  const response = await fetchWithTimeout(`${ICONIFY_API}/search?${params}`)
  if (!response.ok) throw new Error(`Iconify search error: ${response.status}`)
  const data = await response.json()
  return {
    icons: data.icons ?? [],
    total: data.total ?? 0,
    collections: data.collections ?? {}
  }
}

/**
 * Batch-search multiple queries in parallel.
 */
export async function searchIconsBatch(queries: string[], options?: {
  limit?: number
  prefix?: string
}): Promise<Map<string, IconSearchResult>> {
  const results = new Map<string, IconSearchResult>()
  await Promise.all(queries.map(async (query) => {
    const result = await searchIcons(query, options)
    results.set(query, result)
  }))
  return results
}
