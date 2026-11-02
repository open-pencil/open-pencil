import type { ComponentSetNode } from '@figma/plugin-typings/plugin-api-standalone'
import * as v from 'valibot'

import type { SceneNode } from '@open-pencil/scene-graph'
import { defaultVariant, variantOptions } from '@open-pencil/scene-graph/components'

import {
  graph,
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import type { FigmaNodeProxy, NodeProxyHost } from '#core/figma-api/proxy'
import { parseFigma } from '#core/figma-api/validation'

function wrap(target: ProxyThis, internals: NodeProxyInternals, id: string): FigmaNodeProxy {
  return (target[internals.api] as NodeProxyHost).wrapNode(id)
}

function instancesOf(target: ProxyThis, internals: NodeProxyInternals): FigmaNodeProxy[] {
  const id = raw(target, internals).id
  return graph(target, internals)
    .getInstances(id)
    .map((instance) => wrap(target, internals, instance.id))
}

/**
 * The members Figma's `ComponentNode` and `ComponentSetNode` add: a description, a component's
 * instances, and a set's default variant and variant values. Installed on the proxies of those
 * nodes alone, as Figma has them on no other node.
 */
export function installComponentNodeAccessors(
  target: object,
  internals: NodeProxyInternals,
  type: SceneNode['type']
): void {
  if (type !== 'COMPONENT' && type !== 'COMPONENT_SET') return
  Object.defineProperty(target, 'description', {
    get(this: ProxyThis): string {
      return raw(this, internals).symbolDescription
    },
    set(this: ProxyThis, value: unknown) {
      const description = parseFigma(v.string(), value, 'set_description', 'description')
      updateNode(this, internals, { symbolDescription: description })
    }
  })
  if (type === 'COMPONENT') {
    Object.defineProperties(target, {
      instances: {
        get(this: ProxyThis): FigmaNodeProxy[] {
          return instancesOf(this, internals)
        }
      },
      // Async, so a removed component rejects rather than throwing.
      getInstancesAsync: {
        async value(this: ProxyThis): Promise<FigmaNodeProxy[]> {
          return instancesOf(this, internals)
        }
      }
    })
    return
  }
  Object.defineProperties(target, {
    defaultVariant: {
      get(this: ProxyThis): FigmaNodeProxy | null {
        const variant = defaultVariant(graph(this, internals), raw(this, internals))
        return variant ? wrap(this, internals, variant.id) : null
      }
    },
    // Figma's deprecated reading of the variant properties: each one's values, in order.
    variantGroupProperties: {
      get(this: ProxyThis): ComponentSetNode['variantGroupProperties'] {
        const set = raw(this, internals)
        return Object.fromEntries(
          set.componentPropertyDefinitions
            .filter((definition) => definition.type === 'VARIANT')
            .map((definition) => [
              definition.name,
              { values: variantOptions(graph(this, internals), set, definition) }
            ])
        )
      }
    }
  })
}
