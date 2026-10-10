import type { StateElement } from '#dom-css/behaviours/states/types'

import type { ShaderPreset } from '@open-pencil/scene-graph'

import type { InputLayers } from './fields'
import type { ComponentBinding, ComponentElement, ComponentNode } from './model'
import type { UsedLayer } from './references'
import type { RepeatedPart } from './repeats'
import { shaderLayer } from './shaders'

/** What each layer of the rest variant is to the component, gathered before its tree is built. */
export interface TreeLabels {
  parts: Map<StateElement, string>
  classes: Map<StateElement, string>
  /** The text prop each bound text layer draws, by layer. */
  texts: Map<StateElement, string>
  /** Layers that use another component or an icon in place of drawing themselves. */
  used: Map<StateElement, UsedLayer>
  /** Layers drawn once per value, such as tab triggers and panels. */
  repeated: Map<StateElement, RepeatedPart>
  /** A field's text layer, drawn as its input, and the ones it replaces. */
  input: InputLayers | null
  /** The boolean prop that shows each bound layer. */
  shownBy: Map<StateElement, string>
  /** The slot prop each slot frame shows. */
  slotOf: Map<StateElement, string>
  /** The shader each layer fills with. */
  shaders: Map<StateElement, ShaderPreset>
  /** The layer of the rest variant each element draws. */
  layerOf: (element: StateElement) => string | undefined
}

export function componentTree(
  node: StateElement,
  labels: TreeLabels,
  bindings: ComponentBinding[]
): ComponentElement {
  const repeated = labels.repeated.get(node)
  const layerId = labels.layerOf(node)
  const part = repeated?.part ?? labels.parts.get(node) ?? null
  const text = labels.texts.get(node)
  const className = labels.classes.get(node) ?? ''
  return {
    type: 'element',
    part,
    ...(repeated ? { value: repeated.value } : {}),
    tag: node.tagName,
    className,
    layerId,
    attrs: node.attrs,
    bindings: part === 'root' ? bindings : [],
    shownBy: labels.shownBy.get(node),
    slot: labels.slotOf.get(node),
    shader: shaderLayer(node, className, labels.shaders.get(node)),
    // A bound text layer draws its prop in place of the design's words and their runs.
    children: text
      ? [{ type: 'textProp', name: text }]
      : node.children.flatMap((child) =>
          child.type === 'text' ? [{ type: 'text', value: child.text }] : childNode(child, labels)
        )
  }
}

function childNode(element: StateElement, labels: TreeLabels): ComponentNode[] {
  const className = labels.classes.get(element) ?? ''
  const layerId = labels.layerOf(element)
  if (labels.input?.element === element) return [{ type: 'input', className, layerId }]
  if (labels.input?.replaced.includes(element)) return []
  const used = labels.used.get(element)
  if (!used) return [componentTree(element, labels, [])]
  return [{ ...used, className, layerId }]
}
