import {
  layoutSizing,
  layoutSizingError,
  layoutSizingUpdates,
  type LayoutMode,
  type LayoutSizing,
  type LayoutSizingAxis,
  type SceneNode
} from '@open-pencil/scene-graph'

import {
  graph,
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'

export function installLayoutNodeProxyAccessors(
  prototype: object,
  internals: NodeProxyInternals
): void {
  Object.defineProperties(prototype, {
    layoutMode: simpleAccessor(internals, 'layoutMode'),
    layoutDirection: {
      get(this: ProxyThis): string {
        const node = raw(this, internals)
        return Object.hasOwn(node, 'layoutDirection') ? node.layoutDirection : 'AUTO'
      },
      set(this: ProxyThis, value: string) {
        updateNode(this, internals, { layoutDirection: value as SceneNode['layoutDirection'] })
      }
    },
    primaryAxisAlignItems: mappedAccessor(internals, 'primaryAxisAlign'),
    counterAxisAlignItems: mappedAccessor(internals, 'counterAxisAlign'),
    itemSpacing: simpleAccessor(internals, 'itemSpacing'),
    counterAxisSpacing: simpleAccessor(internals, 'counterAxisSpacing'),
    paddingTop: simpleAccessor(internals, 'paddingTop'),
    paddingRight: simpleAccessor(internals, 'paddingRight'),
    paddingBottom: simpleAccessor(internals, 'paddingBottom'),
    paddingLeft: simpleAccessor(internals, 'paddingLeft'),
    layoutWrap: mappedAccessor(internals, 'layoutWrap'),
    primaryAxisSizingMode: axisSizingModeAccessor(internals, 'primaryAxisSizing'),
    counterAxisSizingMode: axisSizingModeAccessor(internals, 'counterAxisSizing'),
    counterAxisAlignContent: mappedAccessor(internals, 'counterAxisAlignContent'),
    itemReverseZIndex: simpleAccessor(internals, 'itemReverseZIndex'),
    strokesIncludedInLayout: simpleAccessor(internals, 'strokesIncludedInLayout'),
    layoutPositioning: mappedAccessor(internals, 'layoutPositioning'),
    layoutGrow: simpleAccessor(internals, 'layoutGrow'),
    layoutAlign: {
      get(this: ProxyThis): string {
        const node = raw(this, internals)
        return node.layoutAlignSelf === 'AUTO' ? 'INHERIT' : node.layoutAlignSelf
      },
      set(this: ProxyThis, value: string) {
        const mapped = value === 'INHERIT' ? 'AUTO' : value
        updateNode(this, internals, { layoutAlignSelf: mapped as SceneNode['layoutAlignSelf'] })
      }
    },
    layoutSizingHorizontal: layoutSizingAccessor(internals, 'HORIZONTAL'),
    layoutSizingVertical: layoutSizingAccessor(internals, 'VERTICAL'),
    constraints: {
      get(this: ProxyThis): { horizontal: string; vertical: string } {
        const node = raw(this, internals)
        return { horizontal: node.horizontalConstraint, vertical: node.verticalConstraint }
      },
      set(this: ProxyThis, value: { horizontal: string; vertical: string }) {
        updateNode(this, internals, {
          horizontalConstraint: value.horizontal as SceneNode['horizontalConstraint'],
          verticalConstraint: value.vertical as SceneNode['verticalConstraint']
        })
      }
    },
    minWidth: simpleAccessor(internals, 'minWidth'),
    maxWidth: simpleAccessor(internals, 'maxWidth'),
    minHeight: simpleAccessor(internals, 'minHeight'),
    maxHeight: simpleAccessor(internals, 'maxHeight')
  })
}

function axisSizingModeAccessor(
  internals: NodeProxyInternals,
  field: 'primaryAxisSizing' | 'counterAxisSizing'
): PropertyDescriptor {
  return {
    get(this: ProxyThis): string {
      const value = raw(this, internals)[field]
      return value === 'HUG' ? 'AUTO' : value
    },
    set(this: ProxyThis, value: string) {
      if (value !== 'FIXED' && value !== 'AUTO') {
        throw new TypeError(`Invalid ${field}Mode: ${String(value)}`)
      }
      updateNode(this, internals, { [field]: value === 'AUTO' ? 'HUG' : 'FIXED' })
    }
  }
}

const LAYOUT_SIZINGS = new Set<unknown>(['FIXED', 'HUG', 'FILL'] satisfies LayoutSizing[])

function isLayoutSizing(value: unknown): value is LayoutSizing {
  return LAYOUT_SIZINGS.has(value)
}

function layoutSizingAccessor(
  internals: NodeProxyInternals,
  axis: LayoutSizingAxis
): PropertyDescriptor {
  const property = axis === 'HORIZONTAL' ? 'layoutSizingHorizontal' : 'layoutSizingVertical'
  return {
    get(this: ProxyThis): LayoutSizing {
      return layoutSizing(graph(this, internals), raw(this, internals), axis)
    },
    set(this: ProxyThis, value: unknown) {
      if (!isLayoutSizing(value)) throw new TypeError(`Invalid ${property}: ${String(value)}`)
      const sceneGraph = graph(this, internals)
      const node = raw(this, internals)
      const error = layoutSizingError(sceneGraph, node, value)
      if (error) throw new Error(`in set_${property}: ${error}`)
      updateNode(this, internals, layoutSizingUpdates(sceneGraph, node, axis, value))
    }
  }
}

function simpleAccessor(internals: NodeProxyInternals, field: keyof SceneNode): PropertyDescriptor {
  return {
    get(this: ProxyThis): unknown {
      return raw(this, internals)[field]
    },
    set(this: ProxyThis, value: unknown) {
      updateNode(this, internals, { [field]: value } as Partial<SceneNode>)
    }
  }
}

function mappedAccessor(internals: NodeProxyInternals, field: keyof SceneNode): PropertyDescriptor {
  return {
    get(this: ProxyThis): unknown {
      return raw(this, internals)[field]
    },
    set(this: ProxyThis, value: string) {
      updateNode(this, internals, { [field]: value } as Partial<SceneNode>)
    }
  }
}

export type { LayoutMode }
