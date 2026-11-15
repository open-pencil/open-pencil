import * as v from 'valibot'

import type { LayoutGrid, LayoutMode, LayoutSizing, SceneNode } from '@open-pencil/scene-graph'
import {
  aspectRatioLockEditable,
  counterAxisSpacingOf,
  layoutSizing,
  layoutSizingError,
  layoutSizingUpdates,
  lockedAspectRatioTarget,
  type LayoutSizingAxis,
  AUTO_LAYOUT_GRID_COUNT,
  isAutoGridCount,
  layoutGridAlignment,
  layoutGridColor,
  layoutGridCount,
  layoutGridPattern
} from '@open-pencil/scene-graph/layout'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import {
  prepareFollowedFieldEdit,
  assertProxyEditable,
  fieldAccessor,
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessors/utils'
import { graphOf } from '#core/figma-api/graph'
import { atLeast, finiteNumberSchema } from '#core/figma-api/schema'
import { parseFigma } from '#core/figma-api/validation'

/** A guide in Figma's plugin shape, whether it was set that way or read from a file. */
function figmaLayoutGrid(grid: LayoutGrid): Readonly<LayoutGrid> {
  const visible = grid.visible ?? true
  const color = layoutGridColor(grid)
  const pattern = layoutGridPattern(grid)
  if (pattern === 'GRID')
    return Object.freeze({
      pattern: 'GRID',
      sectionSize: grid.sectionSize ?? 10,
      visible,
      color,
      boundVariables: {}
    })
  const alignment = layoutGridAlignment(grid)
  return Object.freeze({
    pattern,
    alignment,
    gutterSize: grid.gutterSize ?? 0,
    count: layoutGridCount(grid) === AUTO_LAYOUT_GRID_COUNT ? null : layoutGridCount(grid),
    // A stretched guide's sections fill the frame, so Figma reports no section size for it.
    ...(alignment === 'STRETCH' ? {} : { sectionSize: grid.sectionSize ?? 0 }),
    offset: grid.offset ?? 0,
    visible,
    color,
    boundVariables: {}
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
        parseFigma(v.array(v.unknown()), value, 'set_layoutGrids', 'layoutGrids')
        // An Auto count is stored as the archive stores it, so it survives copies and saves.
        const grids = structuredClone([...value]).map((grid) =>
          isAutoGridCount(grid.count) ? { ...grid, count: AUTO_LAYOUT_GRID_COUNT } : grid
        )
        updateNode(this, internals, { layoutGrids: grids })
      }
    },
    primaryAxisAlignItems: fieldAccessor(
      internals,
      'primaryAxisAlign',
      primaryAxisAlignSchema,
      'primaryAxisAlignItems'
    ),
    counterAxisAlignItems: fieldAccessor(
      internals,
      'counterAxisAlign',
      counterAxisAlignSchema,
      'counterAxisAlignItems'
    ),
    itemSpacing: fieldAccessor(internals, 'itemSpacing', finiteNumberSchema),
    // null follows the item spacing, and reads back as it (Figma desktop 126).
    counterAxisSpacing: {
      get(this: ProxyThis): number {
        return counterAxisSpacingOf(raw(this, internals))
      },
      set(this: ProxyThis, value: unknown) {
        const counterAxisSpacing = parseFigma(
          v.nullable(finiteNumberSchema),
          value,
          'set_counterAxisSpacing',
          'counterAxisSpacing'
        )
        updateNode(this, internals, { counterAxisSpacing })
      }
    },
    paddingTop: padding(internals, 'paddingTop', ['paddingTop']),
    paddingRight: padding(internals, 'paddingRight', ['paddingRight']),
    paddingBottom: padding(internals, 'paddingBottom', ['paddingBottom']),
    paddingLeft: padding(internals, 'paddingLeft', ['paddingLeft']),
    // Figma's deprecated pairs read their first side and set both (Figma desktop 126).
    horizontalPadding: padding(internals, 'horizontalPadding', ['paddingLeft', 'paddingRight']),
    verticalPadding: padding(internals, 'verticalPadding', ['paddingTop', 'paddingBottom']),
    layoutWrap: fieldAccessor(internals, 'layoutWrap', v.picklist(['NO_WRAP', 'WRAP'])),
    primaryAxisSizingMode: axisSizingModeAccessor(internals, 'primaryAxisSizing'),
    counterAxisSizingMode: axisSizingModeAccessor(internals, 'counterAxisSizing'),
    counterAxisAlignContent: {
      get(this: ProxyThis): SceneNode['counterAxisAlignContent'] {
        return raw(this, internals).counterAxisAlignContent
      },
      set(this: ProxyThis, value: unknown) {
        const counterAxisAlignContent = parseFigma(
          v.picklist(['AUTO', 'SPACE_BETWEEN']),
          value,
          'set_counterAxisAlignContent',
          'counterAxisAlignContent'
        )
        prepareFollowedFieldEdit(
          graphOf(this),
          raw(this, internals),
          'counterAxisAlignContent',
          'stack-counter-align-content'
        )
        updateNode(this, internals, { counterAxisAlignContent })
      }
    },
    itemReverseZIndex: fieldAccessor(internals, 'itemReverseZIndex', v.boolean()),
    strokesIncludedInLayout: fieldAccessor(internals, 'strokesIncludedInLayout', v.boolean()),
    layoutPositioning: fieldAccessor(
      internals,
      'layoutPositioning',
      v.picklist(['AUTO', 'ABSOLUTE'])
    ),
    layoutGrow: fieldAccessor(internals, 'layoutGrow', layoutGrowSchema),
    layoutAlign: {
      get(this: ProxyThis): string {
        const node = raw(this, internals)
        return node.layoutAlignSelf === 'AUTO' ? 'INHERIT' : node.layoutAlignSelf
      },
      set(this: ProxyThis, value: unknown) {
        const align = parseFigma(layoutAlignSchema, value, 'set_layoutAlign', 'layoutAlign')
        updateNode(this, internals, { layoutAlignSelf: align === 'INHERIT' ? 'AUTO' : align })
      }
    },
    layoutSizingHorizontal: layoutSizingAccessor(internals, 'HORIZONTAL'),
    layoutSizingVertical: layoutSizingAccessor(internals, 'VERTICAL'),
    constraints: {
      get(this: ProxyThis): { horizontal: string; vertical: string } {
        const node = raw(this, internals)
        return { horizontal: node.horizontalConstraint, vertical: node.verticalConstraint }
      },
      set(this: ProxyThis, value: unknown) {
        const constraints = parseFigma(constraintsSchema, value, 'set_constraints', 'constraints')
        prepareFollowedFieldEdit(
          graphOf(this),
          raw(this, internals),
          'constraints',
          'vertical-constraint'
        )
        updateNode(this, internals, {
          horizontalConstraint: constraints.horizontal,
          verticalConstraint: constraints.vertical
        })
      }
    },
    minWidth: fieldAccessor(internals, 'minWidth', sizeLimitSchema),
    maxWidth: fieldAccessor(internals, 'maxWidth', sizeLimitSchema),
    minHeight: fieldAccessor(internals, 'minHeight', sizeLimitSchema),
    maxHeight: fieldAccessor(internals, 'maxHeight', sizeLimitSchema),
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
      set(this: ProxyThis, value: unknown) {
        const locked = parseFigma(
          v.boolean(),
          value,
          'set_constrainProportions',
          'constrainProportions'
        )
        setAspectRatioLock(this, internals, locked)
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
  if (!aspectRatioLockEditable(graphOf(target), node)) return
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
      return layoutSizing(graphOf(this), raw(this, internals), axis)
    },
    set(this: ProxyThis, value: unknown) {
      if (!isLayoutSizing(value)) throw new TypeError(`Invalid ${property}: ${String(value)}`)
      const sceneGraph = graphOf(this)
      const node = raw(this, internals)
      const error = layoutSizingError(sceneGraph, node, value)
      if (error) throw new Error(`in set_${property}: ${error}`)
      updateNode(this, internals, layoutSizingUpdates(sceneGraph, node, axis, value))
    }
  }
}

type PaddingSide = 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft'

/** A padding that reads its first side and sets each of `sides` to a finite number of 0 or more. */
function padding(
  internals: NodeProxyInternals,
  property: string,
  sides: readonly [PaddingSide, ...PaddingSide[]]
): PropertyDescriptor {
  return {
    get(this: ProxyThis): number {
      return raw(this, internals)[sides[0]]
    },
    set(this: ProxyThis, value: unknown) {
      const amount = parseFigma(atLeast(0), value, `set_${property}`, property)
      updateNode(this, internals, Object.fromEntries(sides.map((side) => [side, amount])))
    }
  }
}

/**
 * How auto layout places children along its direction, as Figma's schema lists the options. Figma
 * also takes `SPACE_AROUND` and `SPACE_EVENLY`, which OpenPencil's layout does not draw yet.
 */
const primaryAxisAlignSchema = v.picklist(['MIN', 'MAX', 'CENTER', 'SPACE_BETWEEN'])

/** How auto layout places children across its direction; Figma refuses `STRETCH` here. */
const counterAxisAlignSchema = v.picklist(['MIN', 'MAX', 'CENTER', 'BASELINE'])

/** How a child of auto layout is placed across it, `INHERIT` following its parent. */
const layoutAlignSchema = v.picklist(['MIN', 'CENTER', 'MAX', 'STRETCH', 'INHERIT'])

const constraintSchema = v.picklist(['MIN', 'CENTER', 'MAX', 'STRETCH', 'SCALE'])
const constraintsSchema = v.object({ horizontal: constraintSchema, vertical: constraintSchema })

/** Figma grows a layer to fill its auto layout with 1, and keeps its size with 0. */
const layoutGrowSchema = v.union([v.literal(0), v.literal(1)])

/** A minimum or maximum size, or none. */
const sizeLimitSchema = v.nullable(finiteNumberSchema)

export type { LayoutMode }
