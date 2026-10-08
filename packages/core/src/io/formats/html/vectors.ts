import type { DesignElement, DesignNode, VectorElementRenderer } from '@open-pencil/dom-css/export'

import { renderNodeSVGElement } from '#core/io/formats/svg/export'
import type { SVGNode } from '#core/io/formats/svg/node'

function designNode(node: SVGNode | string): DesignNode {
  if (typeof node === 'string') return { type: 'text', text: node }
  return {
    type: 'element',
    tagName: node.tag,
    attrs: Object.fromEntries(
      Object.entries(node.attrs).map(([name, value]) => [name, String(value)])
    ),
    children: node.children.map(designNode)
  }
}

/**
 * Vector layers in HTML exports as inline SVG from the SVG export, so paths, gradients, and
 * shadows draw as they do there. Def ids start with the layer's id, so several SVGs on one page
 * never pick up each other's gradients or filters.
 */
export const vectorElement: VectorElementRenderer = (graph, node) => {
  const idPrefix = `${node.id.replace(/[^\w-]/g, '-')}-`
  const drawn = renderNodeSVGElement(graph, node, {
    idPrefix,
    colorSpace: graph.documentColorSpace
  })
  const element = drawn && designNode(drawn)
  if (element?.type !== 'element') return null
  // Strokes and shadows can reach past the layer's box, which an inline SVG would clip.
  return { ...element, inlineStyle: { overflow: 'visible' } } satisfies DesignElement
}
