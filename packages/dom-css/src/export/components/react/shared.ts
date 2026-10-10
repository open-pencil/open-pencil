import { es, jsx } from '@open-pencil/emit'

import type { ComponentModel, GeneratedKind } from '../model'

export const IDENTIFIER = /^[A-Za-z_$][\w$]*$/

/** `styles.thumb`, or `styles['switch-thumb']` for a class that isn't an identifier. */
export function moduleClass(className: string): es.SyntaxNode {
  return {
    type: 'MemberExpression',
    object: es.identifier('styles'),
    property: IDENTIFIER.test(className) ? es.identifier(className) : es.string(className),
    computed: !IDENTIFIER.test(className),
    optional: false
  }
}

/** What a component's markup uses, which its module imports. */
export interface MarkupUses {
  component: ComponentModel
  kind: GeneratedKind
  choice: ComponentModel['choice']
  /** Other generated components. */
  components: Set<string>
  icons: boolean
  /** A layer's class as the component is styled: its CSS module class, or its utilities. */
  classOf: (className: string) => es.SyntaxNode
  /** The layer each JSX element draws, which code links back to. */
  layers: WeakMap<es.SyntaxNode, string>
  /** Effects of the `shaders` library its layers fill with. */
  shaders: Set<string>
}

export const numeric = (name: string, value: number) =>
  jsx.attribute(name, jsx.container(es.number(value)))

/** A `className` value: a plain string as an attribute string, anything else in braces. */
export function classValue(value: es.SyntaxNode): es.SyntaxNode {
  return value.type === 'Literal' && typeof value.value === 'string'
    ? jsx.stringValue(value.value)
    : jsx.container(value)
}

/** `element`, recorded as drawing `layerId`, so code can link back to that layer. */
export function drawing(
  element: es.SyntaxNode,
  layerId: string | undefined,
  uses: MarkupUses
): es.SyntaxNode {
  if (layerId) uses.layers.set(element, layerId)
  return element
}

/** The layer of each JSX element in `program`, in the order the elements open. */
export function elementLayers(
  program: es.SyntaxNode,
  layers: WeakMap<es.SyntaxNode, string>
): (string | null)[] {
  const found: (string | null)[] = []
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item)
      return
    }
    if (!es.isNode(value)) return
    if (value.type === 'JSXElement') found.push(layers.get(value) ?? null)
    for (const item of Object.values(value)) visit(item)
  }
  visit(program)
  return found
}
