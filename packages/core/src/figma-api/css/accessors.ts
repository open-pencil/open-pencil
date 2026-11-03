import { graph, raw, type NodeProxyInternals, type ProxyThis } from '#core/figma-api/accessor-utils'
import { flushPendingLayout } from '#core/figma-api/pending-layout'

import { layerCSS } from './properties'

/** `getCSSAsync()` on every layer and page, as Figma's `BaseNodeMixin` has it. */
export function installCSSAccessors(target: object, internals: NodeProxyInternals): void {
  Object.defineProperty(target, 'getCSSAsync', {
    value(this: ProxyThis): Promise<Record<string, string>> {
      // A script's edits that nothing read yet are laid out first, as Figma lays them out.
      flushPendingLayout(graph(this, internals))
      return Promise.resolve(layerCSS(graph(this, internals), raw(this, internals)))
    }
  })
}
