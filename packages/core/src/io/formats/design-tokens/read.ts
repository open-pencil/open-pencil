import { isPlainObject } from 'es-toolkit/predicate'
import * as v from 'valibot'

import { pathName } from './paths'
import { OPENPENCIL_EXTENSION } from './types'

/** A file the user picked: its path within the folder or archive, and its text. */
export interface DesignTokenSourceFile {
  path: string
  text: string
}

/** A token as read: where it sits, its declared or inherited type, and what it carries. */
export interface ReadToken {
  /** Placed path, `$root` included, as references name it. */
  path: string[]
  /** Layer-panel name: the original OpenPencil kept, or the path joined with `/`. */
  name: string
  type: string | undefined
  value: unknown
  description: string | undefined
  extensions: Record<string, unknown>
}

export interface ReadMode {
  name: string
  tokens: ReadToken[]
  isDefault: boolean
  condition: string | undefined
}

export interface ReadCollection {
  name: string
  modes: ReadMode[]
  modeAttribute: string | undefined
}

export type DesignTokenReadIssue =
  | { kind: 'invalid-file'; file: string }
  | { kind: 'missing-file'; file: string; from: string }

/** What a set of token files holds: collections of modes, and composite tokens for styles. */
export interface DesignTokenBundle {
  collections: ReadCollection[]
  /** Typography, shadow, and other composite tokens, which become styles or are skipped. */
  composites: ReadToken[]
  issues: DesignTokenReadIssue[]
}

const COMPOSITE_TYPES = new Set([
  'typography',
  'shadow',
  'border',
  'gradient',
  'transition',
  'strokeStyle',
  'cubicBezier'
])

const DocumentSchema = v.pipe(v.string(), v.parseJson(), v.record(v.string(), v.unknown()))
type Document = v.InferOutput<typeof DocumentSchema>

const SourceSchema = v.union([v.object({ $ref: v.string() }), v.record(v.string(), v.unknown())])
const ResolverSchema = v.object({
  version: v.string(),
  sets: v.optional(v.record(v.string(), v.object({ sources: v.array(SourceSchema) }))),
  modifiers: v.optional(
    v.record(
      v.string(),
      v.object({
        contexts: v.record(v.string(), v.array(SourceSchema)),
        default: v.optional(v.string())
      })
    )
  ),
  resolutionOrder: v.array(v.unknown())
})
const ThemesSchema = v.array(
  v.object({
    name: v.string(),
    group: v.optional(v.string()),
    selectedTokenSets: v.optional(v.record(v.string(), v.string()), {})
  })
)
const ModeExtensionSchema = v.object({
  collection: v.optional(v.string()),
  mode: v.optional(v.string()),
  default: v.optional(v.boolean()),
  condition: v.optional(v.string()),
  modeAttribute: v.optional(v.string())
})
const NameExtensionSchema = v.object({ name: v.optional(v.string()) })

function extensionsOf(node: Record<string, unknown>): Record<string, unknown> {
  return isPlainObject(node.$extensions) ? node.$extensions : {}
}

/** The collection and mode a file says it holds, which OpenPencil writes into each mode file. */
function modeInfo(parsed: Record<string, unknown> | undefined) {
  const own = v.safeParse(ModeExtensionSchema, parsed && extensionsOf(parsed)[OPENPENCIL_EXTENSION])
  return own.success ? own.output : {}
}

/** Tokens in a document, groups flattened, each with the type it declares or inherits. */
export function documentTokens(parsed: Record<string, unknown>): ReadToken[] {
  const tokens: ReadToken[] = []
  const visit = (group: Record<string, unknown>, path: string[], inherited?: string) => {
    const type = typeof group.$type === 'string' ? group.$type : inherited
    for (const [key, child] of Object.entries(group)) {
      if ((key.startsWith('$') && key !== '$root') || !isPlainObject(child)) continue
      const at = [...path, key]
      if (!('$value' in child)) {
        visit(child, at, type)
        continue
      }
      const extensions = extensionsOf(child)
      const own = v.safeParse(NameExtensionSchema, extensions[OPENPENCIL_EXTENSION])
      tokens.push({
        path: at,
        name: (own.success ? own.output.name : undefined) ?? pathName(at),
        type: typeof child.$type === 'string' ? child.$type : type,
        value: child.$value,
        description: typeof child.$description === 'string' ? child.$description : undefined,
        extensions
      })
    }
  }
  visit(parsed, [])
  return tokens
}

/** `a/b/c.tokens.json` is `c`; `.tokens`, `.tokens.json`, and `.json` all go. */
function baseName(path: string): string {
  const file = path.split('/').at(-1) ?? path
  return file.replace(/\.tokens(\.json)?$|\.json$/i, '')
}

function folderOf(path: string): string {
  return path.split('/').slice(0, -1).join('/')
}

/** A `$ref` as a path among the picked files, relative to the file it appears in. */
function resolveRef(from: string, ref: string): string {
  const segments = [...folderOf(from).split('/'), ...ref.split('/')]
  const resolved: string[] = []
  for (const segment of segments) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') resolved.pop()
    else resolved.push(segment)
  }
  return resolved.join('/')
}

/**
 * The picked file a `$ref` names: by its path relative to the resolver, or, when files were
 * picked without their folders, the one picked file with that name.
 */
function findRef(reader: Reader, from: string, ref: string): string {
  const path = resolveRef(from, ref)
  if (reader.documents.has(path)) return path
  const name = path.split('/').at(-1)
  const matches = [...reader.documents.keys()].filter((key) => key.split('/').at(-1) === name)
  return matches.length === 1 ? matches[0] : path
}

function isResolver(parsed: Document): boolean {
  return 'resolutionOrder' in parsed && 'version' in parsed
}

interface Reader {
  documents: Map<string, Document>
  used: Set<string>
  issues: DesignTokenReadIssue[]
}

/** The tokens of a resolver's sources, later sources overriding earlier ones by path. */
function sourceTokens(
  reader: Reader,
  from: string,
  sources: ReadonlyArray<v.InferOutput<typeof SourceSchema>>
): { tokens: ReadToken[]; info: ReturnType<typeof modeInfo> } {
  const byPath = new Map<string, ReadToken>()
  let info: ReturnType<typeof modeInfo> = {}
  for (const source of sources) {
    let parsed: Record<string, unknown> | undefined
    if (typeof source.$ref === 'string') {
      const path = findRef(reader, from, source.$ref)
      parsed = reader.documents.get(path)
      if (!parsed) reader.issues.push({ kind: 'missing-file', file: path, from })
      reader.used.add(path)
    } else {
      parsed = source
    }
    if (parsed && !info.collection) info = modeInfo(parsed)
    for (const token of parsed ? documentTokens(parsed) : [])
      byPath.set(token.path.join('.'), token)
  }
  return { tokens: [...byPath.values()], info }
}

function mode(name: string, tokens: ReadToken[], isDefault: boolean): ReadMode {
  return { name, tokens, isDefault, condition: undefined }
}

/** A resolver: each modifier a collection of its contexts, each set a single-mode collection. */
function readResolver(reader: Reader, path: string, parsed: Document): ReadCollection[] {
  const result = v.safeParse(ResolverSchema, parsed)
  if (!result.success) {
    reader.issues.push({ kind: 'invalid-file', file: path })
    return []
  }
  const { sets = {}, modifiers = {} } = result.output
  // The collection and mode names a source file records win over the resolver's own labels,
  // which an export makes distinct when two collections share a name.
  const collections: ReadCollection[] = Object.entries(sets).map(([name, set]) => {
    const { tokens, info } = sourceTokens(reader, path, set.sources)
    return {
      name: info.collection ?? name,
      modes: [{ name: info.mode ?? 'Mode 1', tokens, isDefault: true, condition: info.condition }],
      modeAttribute: info.modeAttribute
    }
  })
  for (const [name, modifier] of Object.entries(modifiers)) {
    const contexts = Object.entries(modifier.contexts)
    const defaultName = modifier.default ?? contexts[0]?.[0]
    const modes = contexts.map(([context, sources]) => ({
      context,
      ...sourceTokens(reader, path, sources)
    }))
    collections.push({
      name: modes.find((entry) => entry.info.collection)?.info.collection ?? name,
      modes: modes.map(({ context, tokens, info }) => ({
        name: info.mode ?? context,
        tokens,
        isDefault: context === defaultName,
        condition: info.condition
      })),
      modeAttribute: modes.find((entry) => entry.info.modeAttribute)?.info.modeAttribute
    })
  }
  return collections
}

/**
 * Tokens Studio themes, as Penpot also exports them: each theme group a collection whose modes
 * are its themes, built from the sets each theme enables. Sets no theme enables, usually
 * primitives the themes refer to, become collections of their own.
 */
function readThemes(
  themes: v.InferOutput<typeof ThemesSchema>,
  setDocument: (name: string) => Record<string, unknown> | undefined
): ReadCollection[] {
  const groups = new Map<string, ReadMode[]>()
  const enabled = new Set<string>()
  for (const theme of themes) {
    const sets = Object.entries(theme.selectedTokenSets)
      .filter(([, state]) => state === 'enabled')
      .map(([name]) => name)
    for (const name of sets) enabled.add(name)
    const byPath = new Map<string, ReadToken>()
    for (const name of sets)
      for (const token of documentTokens(setDocument(name) ?? {}))
        byPath.set(token.path.join('.'), token)
    const group = theme.group ?? 'Themes'
    const modes = groups.get(group) ?? []
    modes.push(mode(theme.name, [...byPath.values()], modes.length === 0))
    groups.set(group, modes)
  }
  const referenced = new Set(
    themes.flatMap((theme) =>
      Object.keys(theme.selectedTokenSets).filter((name) => !enabled.has(name))
    )
  )
  const collections: ReadCollection[] = [...referenced].map((name) => ({
    name,
    modes: [mode('Mode 1', documentTokens(setDocument(name) ?? {}), true)],
    modeAttribute: undefined
  }))
  for (const [name, modes] of groups) collections.push({ name, modes, modeAttribute: undefined })
  return collections
}

/** Plain token files: grouped into collections by what they say or by folder, one mode per file. */
function readModeFiles(paths: readonly string[], reader: Reader): ReadCollection[] {
  const collections = new Map<string, ReadCollection>()
  for (const path of paths) {
    const parsed = reader.documents.get(path)
    if (!parsed) continue
    const info = modeInfo(parsed)
    // Files group by folder, since two collections may share a name; loose files by the
    // collection they name, or into one.
    const folder = folderOf(path)
    const key = folder || info.collection || ''
    const name = info.collection ?? (folder.split('/').at(-1) || 'Tokens')
    const collection = collections.get(key) ?? { name, modes: [], modeAttribute: undefined }
    collection.modeAttribute ??= info.modeAttribute
    collection.modes.push({
      name: info.mode ?? baseName(path),
      tokens: documentTokens(parsed),
      isDefault: info.default ?? collection.modes.length === 0,
      condition: info.condition
    })
    collections.set(key, collection)
  }
  return [...collections.values()]
}

/** Composite tokens move to the styles side; collections keep the rest, and empty ones go. */
function splitComposites(collections: readonly ReadCollection[]) {
  const composites = new Map<string, ReadToken>()
  const kept = collections
    .map((collection) => ({
      ...collection,
      modes: collection.modes.map((entry) => ({
        ...entry,
        tokens: entry.tokens.filter((token) => {
          if (!COMPOSITE_TYPES.has(token.type ?? '')) return true
          composites.set(token.path.join('.'), token)
          return false
        })
      }))
    }))
    .filter((collection) => collection.modes.some((entry) => entry.tokens.length > 0))
  return { collections: kept, composites: [...composites.values()] }
}

/**
 * Reads token files into collections and modes. A resolver document, a Tokens Studio `$themes`
 * file, or OpenPencil's mode extension says how files combine; otherwise each file is a mode of a
 * collection named after its folder, as Figma imports one mode per file.
 */
export function readDesignTokens(files: readonly DesignTokenSourceFile[]): DesignTokenBundle {
  const reader: Reader = { documents: new Map(), used: new Set(), issues: [] }
  for (const file of files) {
    const result = v.safeParse(DocumentSchema, file.text)
    if (result.success) reader.documents.set(file.path, result.output)
    else reader.issues.push({ kind: 'invalid-file', file: file.path })
  }
  const collections: ReadCollection[] = []
  for (const [path, parsed] of reader.documents) {
    if (!isResolver(parsed)) continue
    reader.used.add(path)
    collections.push(...readResolver(reader, path, parsed))
  }
  for (const [path, parsed] of reader.documents) {
    const themes = v.safeParse(ThemesSchema, baseName(path) === '$themes' ? parsed : parsed.$themes)
    if (reader.used.has(path) || !themes.success) continue
    reader.used.add(path)
    const inline = baseName(path) !== '$themes'
    const setDocument = (name: string) => {
      if (inline) return isPlainObject(parsed[name]) ? parsed[name] : undefined
      const setPath = resolveRef(path, `${name}.json`)
      reader.used.add(setPath)
      return reader.documents.get(setPath)
    }
    collections.push(...readThemes(themes.output, setDocument))
  }
  const remaining = [...reader.documents.keys()].filter((path) => !reader.used.has(path))
  collections.push(...readModeFiles(remaining, reader))
  return { ...splitComposites(collections), issues: reader.issues }
}
