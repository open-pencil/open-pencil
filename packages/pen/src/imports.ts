import { uniq } from 'es-toolkit/array'

import type { PenDocument, PenNode, PenOverride, PenVariable } from './schema'
import { isVarRef } from './variables'

/**
 * The documents a document imports, by the alias it names them with, each already in its
 * importer's terms by `importedDocument`.
 */
export type PenImports = ReadonlyMap<string, PenDocument>

/** Fields that hold layers or layer IDs, which `renameNode` handles itself. */
const STRUCTURAL_FIELDS = new Set(['id', 'ref', 'slot', 'children', 'descendants'])

/** How an imported document's names read in the document importing it. */
interface Renaming {
  id: (id: string) => string
  /** A value of the imported document's own, with its variable references renamed. */
  value: (value: unknown) => unknown
}

function renaming(alias: string, variables: ReadonlySet<string>): Renaming {
  const id = (raw: string) => `${alias}:${raw}`
  const value = (raw: unknown): unknown => {
    // Only the document's own variables: text such as `$12.00` is not a reference to rename.
    if (isVarRef(raw)) return variables.has(raw.slice(1)) ? `$${id(raw.slice(1))}` : raw
    if (Array.isArray(raw)) return raw.map(value)
    if (raw && typeof raw === 'object') {
      return Object.fromEntries(Object.entries(raw).map(([key, field]) => [key, value(field)]))
    }
    return raw
  }
  return { id, value }
}

function renameOverride(override: PenOverride, names: Renaming): PenOverride {
  const renamed: PenOverride = {}
  for (const [key, field] of Object.entries(override)) {
    if (!STRUCTURAL_FIELDS.has(key)) renamed[key] = names.value(field)
  }
  if (override.id !== undefined) renamed.id = names.id(override.id)
  if (override.ref !== undefined) renamed.ref = names.id(override.ref)
  if (Array.isArray(override.slot)) renamed.slot = override.slot.map(names.id)
  else if (override.slot !== undefined) renamed.slot = override.slot
  if (override.children) renamed.children = override.children.map((n) => renameNode(n, names))
  if (override.descendants) {
    // A key is a path of layer IDs, each inside the copy the one before it names.
    renamed.descendants = Object.fromEntries(
      Object.entries(override.descendants).map(([path, inner]) => [
        path.split('/').map(names.id).join('/'),
        renameOverride(inner, names)
      ])
    )
  }
  return renamed
}

function renameNode(node: PenNode, names: Renaming): PenNode {
  return { ...renameOverride(node, names), type: node.type, id: names.id(node.id) }
}

/** Each theme axis with the values either document gives it, the importer's first. */
function mergeThemes(
  own: PenDocument['themes'],
  imported: readonly PenDocument['themes'][]
): PenDocument['themes'] {
  const merged: Record<string, string[]> = {}
  for (const themes of [own, ...imported]) {
    for (const [axis, values] of Object.entries(themes ?? {})) {
      merged[axis] = uniq([...(merged[axis] ?? []), ...values])
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined
}

/**
 * A document with the documents it imports read into it: their variables, theme axes, and
 * layers, which it names as `<alias>:<id>` and `$<alias>:<variable>`. The imported layers come
 * after its own; `buildPenGraph` draws them on pages of their own instead.
 */
export function withImports(doc: PenDocument, imports: PenImports): PenDocument {
  if (imports.size === 0) return doc
  const docs = [...imports.values()]
  const variables: Record<string, PenVariable> = {}
  for (const imported of docs) Object.assign(variables, imported.variables)
  Object.assign(variables, doc.variables)
  return {
    ...doc,
    imports: undefined,
    themes: mergeThemes(
      doc.themes,
      docs.map((imported) => imported.themes)
    ),
    variables,
    children: [...doc.children, ...docs.flatMap((imported) => imported.children)]
  }
}

/**
 * A document as the document importing it as `alias` sees it: the documents it imports read into
 * it by `withImports`, then every layer ID, component reference, override path, and variable
 * prefixed with `alias:`, as pen.dev names an imported document's contents.
 */
export function importedDocument(
  alias: string,
  doc: PenDocument,
  imports: PenImports
): PenDocument {
  const flat = withImports(doc, imports)
  const names = renaming(alias, new Set(Object.keys(flat.variables ?? {})))
  const variables = Object.fromEntries(
    Object.entries(flat.variables ?? {}).map(([name, variable]) => [
      names.id(name),
      names.value(variable) as PenVariable
    ])
  )
  return {
    ...flat,
    variables,
    children: flat.children.map((node) => renameNode(node, names))
  }
}
