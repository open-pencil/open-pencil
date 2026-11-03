import { sceneNodeToDesignDocument } from '@open-pencil/dom-css/export'

import { graph, raw, type NodeProxyInternals, type ProxyThis } from '#core/figma-api/accessor-utils'
import { flushPendingLayout } from '#core/figma-api/pending-layout'
import { vectorElement } from '#core/io/formats/html/vectors'

/**
 * `getCSSAsync()` on every node, as Figma's `BaseNodeMixin` has it: the CSS OpenPencil's HTML
 * export writes for the layer, which draws it in a browser. A hidden layer gives the CSS it would
 * have shown; a page and the document give none.
 */
export function installCSSAccessors(target: object, internals: NodeProxyInternals): void {
  Object.defineProperty(target, 'getCSSAsync', {
    // Async, so a removed node rejects rather than throwing before a promise exists.
    async value(this: ProxyThis): Promise<Record<string, string>> {
      const scene = graph(this, internals)
      const node = raw(this, internals)
      if (node.type === 'CANVAS' || node.id === scene.rootId) return {}
      // A script's edits that nothing read yet are laid out first, as Figma lays them out.
      flushPendingLayout(scene)
      const element = sceneNodeToDesignDocument(scene, node.id, {
        vectorElement,
        shown: new Set([node.id])
      }).children.at(0)
      return element?.type === 'element' ? { ...element.inlineStyle } : {}
    }
  })
}
