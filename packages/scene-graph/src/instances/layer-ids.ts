import type { SceneNode } from '../types'

/**
 * Where a layer inside an instance sits: the outermost instance it belongs to, and the ids of
 * the component layers leading to it, through nested instances. Figma addresses instance
 * sublayers the same way, in ids such as `I16:25;16:23;16:19` and override `guidPath`s.
 */
export interface InstanceLayerAddress {
  /** The outermost instance: one placed on a page, in a frame, or directly in a component. */
  readonly owner: string
  /** Definition-level layer ids, outermost first. Never empty. */
  readonly path: readonly string[]
}

const PREFIX = 'I'
const SEPARATOR = ';'

/** The id of the copy at `path` inside `owner`. */
export function instanceLayerId(owner: string, path: readonly string[]): string {
  if (path.length === 0) throw new Error('An instance layer path needs at least one layer')
  return `${PREFIX}${owner}${SEPARATOR}${path.join(SEPARATOR)}`
}

/** The address an instance layer's id spells, or null for a layer that is not a copy. */
export function parseInstanceLayerId(id: string): InstanceLayerAddress | null {
  if (!id.startsWith(PREFIX)) return null
  const [owner, ...path] = id.slice(PREFIX.length).split(SEPARATOR)
  if (!owner || path.length === 0 || path.some((segment) => !segment)) return null
  return { owner, path }
}

/** Whether `id` names a copy inside an instance rather than a layer of its own. */
export function isInstanceLayerId(id: string): boolean {
  return parseInstanceLayerId(id) !== null
}

/** The key overrides use for a layer path. */
export function overridePathKey(path: readonly string[]): string {
  return path.join(SEPARATOR)
}

/** The layer path an override key names. */
export function parseOverridePathKey(key: string): string[] {
  return key.split(SEPARATOR)
}

/**
 * The path segments that address `source`, a layer of a component, from an instance of that
 * component: its own id when it is the component's own layer, or the nested instance it was
 * copied into followed by its path there.
 */
export function layerSegments(source: Pick<SceneNode, 'id'>): string[] {
  const address = parseInstanceLayerId(source.id)
  return address ? [address.owner, ...address.path] : [source.id]
}

/**
 * Where the copies an instance shows are made: the outermost instance, and the path to this
 * instance inside it (empty when the instance is the outermost one).
 */
export interface InstanceScope {
  readonly owner: string
  readonly prefix: readonly string[]
}

export function instanceScope(instance: Pick<SceneNode, 'id'>): InstanceScope {
  const address = parseInstanceLayerId(instance.id)
  return address
    ? { owner: address.owner, prefix: address.path }
    : { owner: instance.id, prefix: [] }
}

/** The id of the copy of component layer `source` that an instance with `scope` shows. */
export function copyLayerId(scope: InstanceScope, source: Pick<SceneNode, 'id'>): string {
  return instanceLayerId(scope.owner, [...scope.prefix, ...layerSegments(source)])
}
