import { compact } from 'es-toolkit/array'
import { isPlainObject } from 'es-toolkit/predicate'

/**
 * A name segment as a DTCG token name, which cannot hold `{`, `}`, or `.`, nor start with `$`:
 * those characters become `-`. A name that changed keeps its original in OpenPencil's extension.
 */
function tokenSegment(segment: string): string {
  return segment.replaceAll(/[{}.]/g, '-').replace(/^\$+/, '') || 'token'
}

/** `Brand/Primary` as the token path `["Brand", "Primary"]`. */
export function tokenPath(name: string): string[] {
  const segments = compact(name.split('/').map((segment) => segment.trim())).map(tokenSegment)
  return segments.length > 0 ? segments : ['token']
}

/** A token path back as a layer-panel name: `["Brand", "Primary"]` is `Brand/Primary`. */
export function pathName(path: readonly string[]): string {
  return path.filter((segment) => segment !== '$root').join('/')
}

/**
 * A name as a file name: path separators and characters file systems refuse become `-`, and
 * leading dots go, so no name such as `..` reaches outside the export's folder.
 */
export function fileSegment(name: string): string {
  // eslint-disable-next-line no-control-regex -- Control characters are what file systems refuse.
  const safe = name.replaceAll(/[/\\:*?"<>|\u0000-\u001F]/g, '-').replace(/^[.\s]+/, '')
  return safe.trim() || 'Untitled'
}

/** Where each entry sits in the tree, by key: a path that is also a group's sits at `$root`. */
export interface TokenPlacement<Key> {
  placed: Map<Key, string[]>
  /** Entries whose path another entry already took. */
  duplicates: Key[]
}

/**
 * Places tokens by path. DTCG has no token that is also a group, so a token whose path other
 * tokens extend, such as `Space` beside `Space/Small`, becomes that group's `$root` token.
 */
export function placeTokens<Key>(
  entries: ReadonlyArray<{ key: Key; path: readonly string[] }>
): TokenPlacement<Key> {
  const groups = new Set<string>()
  for (const { path } of entries)
    for (let length = 1; length < path.length; length++)
      groups.add(path.slice(0, length).join('\u0000'))
  const placed = new Map<Key, string[]>()
  const taken = new Set<string>()
  const duplicates: Key[] = []
  for (const { key, path } of entries) {
    const position = groups.has(path.join('\u0000')) ? [...path, '$root'] : [...path]
    const id = position.join('\u0000')
    if (taken.has(id)) {
      duplicates.push(key)
      continue
    }
    taken.add(id)
    placed.set(key, position)
  }
  return { placed, duplicates }
}

/** Nests tokens into groups by their placed paths. */
export function tokenTree(
  tokens: ReadonlyArray<{ path: readonly string[]; token: unknown }>
): Record<string, unknown> {
  const root: Record<string, unknown> = {}
  for (const { path, token } of tokens) {
    let group = root
    for (const segment of path.slice(0, -1)) {
      const next = group[segment]
      const child: Record<string, unknown> = isPlainObject(next) ? next : {}
      group[segment] = child
      group = child
    }
    group[path.at(-1) ?? 'token'] = token
  }
  return root
}

/** A `{group.token}` reference to a placed path. */
export function tokenReference(path: readonly string[]): string {
  return `{${path.join('.')}}`
}
