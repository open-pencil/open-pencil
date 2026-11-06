import * as v from 'valibot'

import type { ArcData, SceneNode } from '@open-pencil/scene-graph'
import { fitEnclosingGroups } from '@open-pencil/scene-graph/group-bounds'

import {
  graph,
  hostFitOptions,
  nodeId,
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import { finiteNumberSchema, unitIntervalSchema } from '#core/figma-api/schema'
import { parseFigma } from '#core/figma-api/validation'

/** Figma caps a polygon or star at this many points, past which it keeps the cap. */
const MAX_POINT_COUNT = 60

type BooleanOperation = NonNullable<SceneNode['booleanOperation']>

const BOOLEAN_OPERATIONS = [
  'UNION',
  'INTERSECT',
  'SUBTRACT',
  'EXCLUDE'
] as const satisfies readonly BooleanOperation[]

/** Figma checks the minimum before whole numbers, and reports both. */
const pointCountSchema = v.pipe(finiteNumberSchema, v.minValue(3), v.integer())
/** Figma's `ArcData`; it checks every field and lists each problem on its own line. */
const arcDataSchema = v.strictObject({
  startingAngle: finiteNumberSchema,
  endingAngle: finiteNumberSchema,
  innerRadius: unitIntervalSchema
})

function parsePointCount(value: unknown): number {
  const count = parseFigma(pointCountSchema, value, 'set_pointCount', 'pointCount')
  return Math.min(count, MAX_POINT_COUNT)
}

function parseInnerRadius(value: unknown): number {
  return parseFigma(unitIntervalSchema, value, 'set_innerRadius', 'innerRadius')
}

function parseArcData(value: unknown): ArcData {
  return parseFigma(arcDataSchema, value, 'set_arcData', 'arcData')
}

/** An ellipse without arc data is a whole one, which Figma reports as a full turn. */
const WHOLE_ELLIPSE: ArcData = { startingAngle: 0, endingAngle: 2 * Math.PI, innerRadius: 0 }

/**
 * The members of Figma's `PolygonNode`, `StarNode`, `EllipseNode`, and `BooleanOperationNode`
 * that shape them: a point count, a star's inner radius, an ellipse's arc, and a boolean's
 * operation. Installed on the proxies of those nodes alone, as Figma has them on no other node.
 */
export function installShapeNodeProxyAccessors(
  target: object,
  internals: NodeProxyInternals,
  type: SceneNode['type']
): void {
  if (type === 'POLYGON' || type === 'STAR') {
    Object.defineProperty(target, 'pointCount', {
      get(this: ProxyThis): number {
        return raw(this, internals).pointCount
      },
      set(this: ProxyThis, value: number) {
        updateNode(this, internals, { pointCount: parsePointCount(value) })
      }
    })
  }
  if (type === 'STAR') {
    Object.defineProperty(target, 'innerRadius', {
      get(this: ProxyThis): number {
        return raw(this, internals).starInnerRadius
      },
      set(this: ProxyThis, value: number) {
        updateNode(this, internals, { starInnerRadius: parseInnerRadius(value) })
      }
    })
  }
  if (type === 'BOOLEAN_OPERATION') {
    Object.defineProperty(target, 'booleanOperation', {
      get(this: ProxyThis): BooleanOperation {
        return raw(this, internals).booleanOperation ?? 'UNION'
      },
      set(this: ProxyThis, value: unknown) {
        const booleanOperation = parseFigma(
          v.picklist(BOOLEAN_OPERATIONS),
          value,
          'set_booleanOperation',
          'booleanOperation'
        )
        updateNode(this, internals, { booleanOperation })
        // The result's bounds change with the operation, and the groups around it follow.
        fitEnclosingGroups(
          graph(this, internals),
          [nodeId(this, internals)],
          hostFitOptions(this, internals)
        )
      }
    })
  }
  if (type === 'ELLIPSE') {
    Object.defineProperty(target, 'arcData', {
      get(this: ProxyThis): Readonly<ArcData> {
        return Object.freeze({ ...(raw(this, internals).arcData ?? WHOLE_ELLIPSE) })
      },
      set(this: ProxyThis, value: ArcData) {
        updateNode(this, internals, { arcData: parseArcData(value) })
      }
    })
  }
}
