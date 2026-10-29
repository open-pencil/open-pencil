import type { LayoutGrid, LayoutMode, LayoutSizing, SceneNode } from '@open-pencil/scene-graph'
import {
  aspectRatioLockEditable,
  layoutSizing,
  layoutSizingError,
  layoutSizingUpdates,
  lockedAspectRatioTarget,
  type LayoutSizingAxis,
  AUTO_LAYOUT_GRID_COUNT,
  isAutoGridCount,
  layoutGridCount
} from '@open-pencil/scene-graph/layout'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import {
  prepareFollowedFieldEdit,
  assertProxyEditable,
  graph,
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'

/** A guide in Figma's plugin shape, whether it was set that way or read from a file. */
function figmaLayoutGrid(grid: LayoutGrid): Readonly<LayoutGrid> {
  const visible = grid.visible ?? true
  const color = { ...(grid.color ?? { r: 1, g: 0, b: 0, a: 0.1 }) }
  if (grid.pattern === 'GRID')
    return Object.freeze({ pattern: 'GRID', sectionSize: grid.sectionSize ?? 10, visible, color })
  const rows = grid.pattern === 'ROWS' || (grid.pattern !== 'COLUMNS' && grid.axis === 'Y')
  const alignment = grid.alignment ?? grid.type ?? 'STRETCH'
  return Object.freeze({
    pattern: rows ? 'ROWS' : 'COLUMNS',
    alignment,
    gutterSize: grid.gutterSize ?? 0,
    count: layoutGridCount(grid) === AUTO_LAYOUT_GRID_COUNT ? null : layoutGridCount(grid),
    // A stretched guide's sections fill the frame, so Figma reports no section size for it.
    ...(alignment === 'STRETCH' ? {} : { sectionSize: grid.sectionSize ?? 0 }),
    offset: grid.offset ?? 0,
    visible,
    color
  })
}

export function installLayoutNodeProxyAccessors(
  prototype: object,
  internals: NodeProxyInternals
): void {
  Object.defineProperties(prototype, {
    layoutMode: {
      get(this: ProxyThis): LayoutMode {
        return raw(this, internals).layoutMode
      },
      set(this: ProxyThis, value: LayoutMode) {
        // A grid sizes to its tracks, so Figma fixes both axes; a flow keeps the sizing it had.
        const sizing =
          value === 'GRID'
            ? { primaryAxisSizing: 'FIXED' as const, counterAxisSizing: 'FIXED' as const }
            : {}
        updateNode(this, internals, { layoutMode: value, ...sizing })
      }
    },
    // Figma's grids, as a frame's Layout guide section shows them.
    layoutGrids: {
      get(this: ProxyThis): readonly LayoutGrid[] {
        return Object.freeze(raw(this, internals).layoutGrids.map(figmaLayoutGrid))
      },
      set(this: ProxyThis, value: readonly LayoutGrid[]) {
        if (!Array.isArray(value)) throw new TypeError('layoutGrids must be an array')
        // An Auto count is stored as the archive stores it, so it survives copies and saves.
        const grids = structuredClone([...value]).map((grid) =>
          isAutoGridCount(grid.count) ? { ...grid, count: AUTO_LAYOUT_GRID_COUNT } : grid
        )
        updateNode(this, internals, { layoutGrids: grids })
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
    counterAxisAlignContent: {
      get(this: ProxyThis): SceneNode['counterAxisAlignContent'] {
        return raw(this, internals).counterAxisAlignContent
      },
      set(this: ProxyThis, value: SceneNode['counterAxisAlignContent']) {
        prepareFollowedFieldEdit(
          graph(this, internals),
          raw(this, internals),
          'counterAxisAlignContent',
          'stack-counter-align-content'
        )
        updateNode(this, internals, { counterAxisAlignContent: value })
      }
    },
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
        prepareFollowedFieldEdit(
          graph(this, internals),
          raw(this, internals),
          'constraints',
          'vertical-constraint'
        )
        updateNode(this, internals, {
          horizontalConstraint: value.horizontal as SceneNode['horizontalConstraint'],
          verticalConstraint: value.vertical as SceneNode['verticalConstraint']
        })
      }
    },
    minWidth: simpleAccessor(internals, 'minWidth'),
    maxWidth: simpleAccessor(internals, 'maxWidth'),
    minHeight: simpleAccessor(internals, 'minHeight'),
    maxHeight: simpleAccessor(internals, 'maxHeight'),
    targetAspectRatio: {
      get(this: ProxyThis): Vector | null {
        const target = raw(this, internals).targetAspectRatio
        return target ? { ...target } : null
      }
    },
    constrainProportions: {
      get(this: ProxyThis): boolean {
        return raw(this, internals).targetAspectRatio !== null
      },
      set(this: ProxyThis, value: boolean) {
        setAspectRatioLock(this, internals, value)
      }
    }
  })

  Object.assign(prototype, {
    lockAspectRatio(this: ProxyThis): void {
      setAspectRatioLock(this, internals, true)
    },
    unlockAspectRatio(this: ProxyThis): void {
      setAspectRatioLock(this, internals, false)
    }
  })
}

/** Figma ignores the call, without an error, on a layer inside an instance. */
function setAspectRatioLock(target: ProxyThis, internals: NodeProxyInternals, locked: boolean) {
  assertProxyEditable(target, internals)
  const node = raw(target, internals)
  if (!aspectRatioLockEditable(graph(target, internals), node)) return
  updateNode(target, internals, {
    targetAspectRatio: locked ? lockedAspectRatioTarget(node.width, node.height) : null
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
