import type { SceneGraph } from '../index'
import { serializeInstanceOverrideState } from '../instance-overrides'

type SnapshotValue = object | string | number | boolean | null | undefined

/** Experimental review artifact, not a loadable document format or merge protocol. */
export function serializeGraphSnapshot(graph: SceneGraph): string {
  const nodes = new Map(
    [...graph.nodes].map(([id, node]) => {
      const {
        textPicture: _textPicture,
        derivedTextGlyphs: _derivedTextGlyphs,
        source,
        instanceOverrides,
        ...props
      } = node
      return [
        id,
        {
          ...props,
          source: { ...source, editedFields: [...source.editedFields].sort() },
          instanceOverrides: serializeInstanceOverrideState({
            self: sortedMap(instanceOverrides.self),
            descendants: new Map(
              [...sortedMap(instanceOverrides.descendants)].map(([nodeId, fields]) => [
                nodeId,
                sortedMap(fields)
              ])
            )
          })
        }
      ]
    })
  )
  return `${canonicalString({
    rootId: graph.rootId,
    documentColorSpace: graph.documentColorSpace,
    nodes,
    images: graph.images,
    variables: graph.variables,
    variableCollections: graph.variableCollections,
    activeMode: graph.activeMode,
    enabledLibraries: graph.enabledLibraries,
    figKiwiVersion: graph.figKiwiVersion,
    figSchemaDeflated: graph.figSchemaDeflated
  })}\n`
}

function sortedMap<T>(entries: ReadonlyMap<string, T>): Map<string, T> {
  return new Map([...entries].sort(([a], [b]) => compareKeys(a, b)))
}

function compareKeys(a: string, b: string): number {
  return a < b ? -1 : Number(a > b)
}

function canonicalString(value: SnapshotValue, ancestors = new Set<object>()): string {
  if (value === null) return 'null'
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Snapshot numbers must be finite')
    return JSON.stringify(value)
  }
  if (typeof value !== 'object') throw new TypeError('Unsupported snapshot value')
  if (ancestors.has(value)) throw new TypeError('Snapshot values must not contain cycles')
  ancestors.add(value)
  try {
    return canonicalObject(value, ancestors)
  } finally {
    ancestors.delete(value)
  }
}

function canonicalObject(value: object, ancestors: Set<object>): string {
  if (value instanceof Uint8Array || Array.isArray(value)) {
    return `[${Array.from(value, (item) => canonicalString(item, ancestors)).join(',')}]`
  }
  if (value instanceof Map) {
    const entries: Array<[string, SnapshotValue]> = []
    for (const [key, item] of value) {
      if (typeof key !== 'string') throw new TypeError('Snapshot map keys must be strings')
      entries.push([key, item])
    }
    entries.sort(([a], [b]) => compareKeys(a, b))
    return `[${entries.map((entry) => canonicalString(entry, ancestors)).join(',')}]`
  }
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new TypeError('Snapshot objects must be plain records')
  }
  const entries = Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => compareKeys(a, b))
  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalString(item, ancestors)}`)
    .join(',')}}`
}
