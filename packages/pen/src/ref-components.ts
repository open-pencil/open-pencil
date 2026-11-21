import type { Build } from './nodes'
import type { PenNode, PenOverride } from './schema'

/** How many components that are refs a use resolves through before it stops, so a cycle ends. */
const MAX_REF_COMPONENT_DEPTH = 16

export const NO_ANCESTRY: ReadonlySet<string> = new Set()

/**
 * Copies of a component's layers under `prefix`, as a use names the layers it copies, each
 * recorded as having come through `ancestry`.
 */
export function copiedLayers(
  layers: readonly PenNode[],
  prefix: string,
  ancestry: ReadonlySet<string>,
  build: Build
): PenNode[] {
  return layers.map((layer) => {
    const id = `${prefix}/${layer.id}`
    build.refCopyAncestry.set(id, ancestry)
    return {
      ...layer,
      id,
      children: layer.children && copiedLayers(layer.children, prefix, ancestry, build)
    }
  })
}

/**
 * A use's descendant overrides with each key that names a layer the middle component put in
 * through a replacement renamed to that replacement's path, as pen.dev names it from there.
 */
function onMiddlePaths(
  middle: NonNullable<PenNode['descendants']>,
  own: NonNullable<PenNode['descendants']>
): NonNullable<PenNode['descendants']> {
  const pathOf = new Map<string, string>()
  for (const [path, override] of Object.entries(middle)) {
    if (override.type && override.id) pathOf.set(override.id, path)
  }
  return Object.fromEntries(
    Object.entries(own).map(([path, override]) => [pathOf.get(path) ?? path, override])
  )
}

/**
 * The middle component's descendant overrides for a use: each layer one puts in is a copy under
 * `prefix`, so it never shares an ID with the layer the middle component itself puts in.
 */
function copiedReplacements(
  middle: NonNullable<PenNode['descendants']>,
  prefix: string,
  ancestry: ReadonlySet<string>,
  build: Build
): NonNullable<PenNode['descendants']> {
  return Object.fromEntries(
    Object.entries(middle).map(([path, override]) => {
      if (!override.type || !override.id) {
        return [path, withCopiedChildren(override, prefix, ancestry, build)]
      }
      const [copy] = copiedLayers(
        [{ ...override, type: override.type, id: override.id }],
        prefix,
        ancestry,
        build
      )
      return [path, copy]
    })
  )
}

/**
 * A property override with the children it gives copied under `prefix`, so two uses never share
 * the IDs of layers the override puts in.
 */
function withCopiedChildren(
  override: PenOverride,
  prefix: string,
  ancestry: ReadonlySet<string>,
  build: Build
): PenOverride {
  if (!override.children) return override
  return { ...override, children: copiedLayers(override.children, prefix, ancestry, build) }
}

/** Descendant overrides with the use's on top, merged field by field where both name a path. */
function mergedDescendants(
  middle: PenNode['descendants'],
  own: PenNode['descendants'],
  copy: (middle: NonNullable<PenNode['descendants']>) => NonNullable<PenNode['descendants']>
): PenNode['descendants'] {
  if (!middle) return own
  const merged = copy(middle)
  if (!own) return merged
  for (const [path, override] of Object.entries(onMiddlePaths(middle, own))) {
    // A replacement layer (one naming its type) takes the path whole, as it does on its own.
    merged[path] =
      Object.hasOwn(merged, path) && !override.type ? { ...merged[path], ...override } : override
  }
  return merged
}

/**
 * A reusable component can itself be a `ref` to another component, with its own fields,
 * children, and overrides. pen.dev reads a use of it as a use of the base component that
 * carries the middle component's fields, children, and overrides under the use's own.
 * `copiedChildren` is whether the result's children are copies already named for the use.
 */
export function throughRefComponents(
  pen: PenNode,
  build: Build
): { pen: PenNode; copiedChildren: boolean; blocked: boolean } {
  let current = pen
  let copiedChildren = false
  let blocked = false
  const ancestry = build.refCopyAncestry.get(pen.id) ?? NO_ANCESTRY
  for (let depth = 0; ; depth++) {
    if (current.type !== 'ref' || !current.ref) break
    const component = build.components.get(current.ref)
    if (component?.type !== 'ref' || !component.ref) break
    // A chain longer than any a document means is a cycle: the use draws no layers.
    if (depth >= MAX_REF_COMPONENT_DEPTH || ancestry.has(component.id)) {
      blocked = true
      break
    }
    const { id: _id, reusable: _reusable, x: _x, y: _y, name: _name, ...middle } = component
    const { ref: _ref, type: _type, ...own } = current
    const theme = { ...middle.theme, ...own.theme }
    const inherits = !own.children && middle.children
    const through = new Set([...ancestry, component.id])
    const children = inherits
      ? copiedLayers(middle.children ?? [], pen.id, through, build)
      : own.children
    copiedChildren ||= Boolean(inherits)
    current = {
      ...middle,
      ...own,
      type: 'ref',
      ref: component.ref,
      name: own.name ?? component.name,
      theme: Object.keys(theme).length > 0 ? theme : undefined,
      descendants: mergedDescendants(middle.descendants, own.descendants, (overrides) =>
        copiedReplacements(overrides, pen.id, through, build)
      ),
      children
    }
  }
  return { pen: current, copiedChildren, blocked }
}

/** The layer among `layers`, at any depth, with ID `id`. */
function layerWithId(layers: readonly PenNode[], id: string): PenNode | undefined {
  for (const layer of layers) {
    if (layer.id === id) return layer
    const inside = layer.children && layerWithId(layer.children, id)
    if (inside) return inside
  }
  return undefined
}

/**
 * Gives a use's copies of a component that is not a frame the use's descendant overrides, as an
 * instance's copies take them: a key names the copy by the component layer's ID, and the rest of
 * a longer key is an override of the instance that layer is. Copies are named under `prefix`.
 */
export function applyCopyOverrides(
  copies: PenNode[],
  descendants: PenNode['descendants'],
  prefix: string,
  ancestry: ReadonlySet<string>,
  build: Build
): PenNode[] {
  let layers = copies
  for (const [path, override] of Object.entries(descendants ?? {})) {
    const [first = '', ...rest] = path.split('/')
    const target = layerWithId(layers, `${prefix}/${first}`)
    if (!target) continue
    // A layer put in here sits where the copy it replaces was, inside the same components.
    const within = build.refCopyAncestry.get(target.id) ?? ancestry
    if (rest.length > 0) {
      const key = rest.join('/')
      const under = target.descendants?.[key]
      target.descendants = {
        ...target.descendants,
        [key]: under && !override.type ? { ...under, ...override } : override
      }
    } else if (override.type) {
      const [replacement] = copiedLayers(
        [{ ...override, type: override.type, id: override.id ?? first }],
        prefix,
        within,
        build
      )
      layers = replacedLayer(layers, target, replacement)
    } else {
      const theme = override.theme ? { ...target.theme, ...override.theme } : target.theme
      Object.assign(target, withCopiedChildren(override, prefix, within, build), {
        id: target.id,
        theme
      })
    }
  }
  return layers
}

/** `layers` with `target`, at any depth, swapped for `replacement`. */
function replacedLayer(layers: PenNode[], target: PenNode, replacement: PenNode): PenNode[] {
  return layers.map((layer) => {
    if (layer === target) return replacement
    if (layer.children) layer.children = replacedLayer(layer.children, target, replacement)
    return layer
  })
}
