import type { SceneNode } from '@open-pencil/scene-graph'

const REF_SYMBOL = Symbol.for('open-pencil.layer-ref')

/**
 * A handle on one layer of the JSX: `ref={card}` marks the layer, and an element that refers to
 * a layer, such as `<Connector from={card}>`, takes the handle where a name could be ambiguous.
 */
export interface LayerRef {
  readonly [REF_SYMBOL]: true
}

/** A new handle for `ref={…}` to mark a layer with. */
export function ref(): LayerRef {
  return Object.freeze({ [REF_SYMBOL]: true as const })
}

export function isLayerRef(value: unknown): value is LayerRef {
  return typeof value === 'object' && value !== null && REF_SYMBOL in value
}

/** The layers a render marked with `ref={…}`, for the elements that refer to them. */
export class LayerRefs {
  readonly warnings: string[] = []
  private readonly layers = new Map<LayerRef, SceneNode>()

  /** Marks `node` with the `ref` prop its element passed, if any. */
  mark(value: unknown, node: SceneNode) {
    if (value === undefined) return
    if (!isLayerRef(value)) {
      this.warnings.push(`ref on "${node.name}" is not a ref() and is ignored.`)
      return
    }
    const first = this.layers.get(value)
    if (first) {
      this.warnings.push(
        `One ref() marks both "${first.name}" and "${node.name}"; it refers to "${first.name}".`
      )
      return
    }
    this.layers.set(value, node)
  }

  /** The id of the layer `ref` marks, if one does. */
  layerOf(ref: LayerRef): string | undefined {
    return this.layers.get(ref)?.id
  }
}
