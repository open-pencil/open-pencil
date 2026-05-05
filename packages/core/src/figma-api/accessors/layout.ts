import {
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import type { LayoutMode, SceneGraph, SceneNode } from '#core/scene-graph'

function graph(target: ProxyThis, internals: NodeProxyInternals): SceneGraph {
  return target[internals.graph] as SceneGraph
}

function parentLayout(
  target: ProxyThis,
  internals: NodeProxyInternals
): 'HORIZONTAL' | 'VERTICAL' | 'NONE' {
  const node = raw(target, internals)
  if (!node.parentId) return 'NONE'
  const parent = graph(target, internals).getNode(node.parentId)
  if (!parent) return 'NONE'
  const mode = parent.layoutMode
  return mode === 'HORIZONTAL' || mode === 'VERTICAL' ? mode : 'NONE'
}

function setLayoutSizing(
  target: ProxyThis,
  internals: NodeProxyInternals,
  axis: 'HORIZONTAL' | 'VERTICAL',
  value: string
): void {
  const node = raw(target, internals)
  const layout = node.layoutMode !== 'NONE' ? node.layoutMode : parentLayout(target, internals)
  const isHorizontal = axis === 'HORIZONTAL'
  const usesCounterAxis = isHorizontal ? layout === 'VERTICAL' : layout === 'HORIZONTAL'
  const updates: Partial<SceneNode> = usesCounterAxis
    ? { counterAxisSizing: value as SceneNode['counterAxisSizing'] }
    : { primaryAxisSizing: value as SceneNode['primaryAxisSizing'] }
  if (parentLayout(target, internals) === axis) updates.layoutGrow = value === 'FILL' ? 1 : 0
  updateNode(target, internals, updates)
}

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
      const mapped = value === 'AUTO' ? 'HUG' : value
      updateNode(this, internals, { [field]: mapped } as Partial<SceneNode>)
    }
  }
}

function layoutSizingAccessor(
  internals: NodeProxyInternals,
  axis: 'HORIZONTAL' | 'VERTICAL'
): PropertyDescriptor {
  return {
    get(this: ProxyThis): string {
      const node = raw(this, internals)
      const layout = node.layoutMode !== 'NONE' ? node.layoutMode : parentLayout(this, internals)
      if (layout === 'NONE') return 'FIXED'
      return layout === axis ? node.primaryAxisSizing : node.counterAxisSizing
    },
    set(this: ProxyThis, value: string) {
      setLayoutSizing(this, internals, axis, value)
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
