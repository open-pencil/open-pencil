import type { ArcData, SceneNode } from '@open-pencil/scene-graph'

import {
  raw,
  updateNode,
  type NodeProxyInternals,
  type ProxyThis
} from '#core/figma-api/accessor-utils'
import { invalid, numberProblem, received } from '#core/figma-api/accessors/text/messages'

/** Figma caps a polygon or star at this many points, past which it keeps the cap. */
const MAX_POINT_COUNT = 60

const ARC_FIELDS = ['startingAngle', 'endingAngle', 'innerRadius'] as const

/** Figma's complaint about a ratio outside 0 to 1, or null. */
function ratioProblem(value: number, at = ''): string | null {
  if (value < 0) return `Too small: expected number to be >=0${at}`
  if (value > 1) return `Too big: expected number to be <=1${at}`
  return null
}

function parsePointCount(value: unknown): number {
  const problem =
    numberProblem(value) ??
    (Number.isInteger(value) ? null : 'Expected int, received number') ??
    ((value as number) < 3 ? 'Too small: expected number to be >=3' : null)
  if (problem) throw invalid('set_pointCount', problem, 'pointCount')
  return Math.min(value as number, MAX_POINT_COUNT)
}

function parseInnerRadius(value: unknown): number {
  const problem = numberProblem(value) ?? ratioProblem(value as number)
  if (problem) throw invalid('set_innerRadius', problem, 'innerRadius')
  return value as number
}

/** Figma checks every field and lists each problem on its own line. */
function parseArcData(value: unknown): ArcData {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalid('set_arcData', `Expected object, received ${received(value)}`, 'arcData')
  }
  const fields = value as Partial<Record<(typeof ARC_FIELDS)[number], unknown>>
  // Each field read once, so a getter cannot pass the checks and then store something else.
  const values = ARC_FIELDS.map((field) => fields[field])
  const problems = values.map((value, index) => numberProblem(value, ` at .${ARC_FIELDS[index]}`))
  const [startingAngle, endingAngle, innerRadius] = values
  if (!problems[2]) problems[2] = ratioProblem(innerRadius as number, ' at .innerRadius')
  const listed = problems.filter((problem) => problem !== null)
  if (listed.length > 0) throw invalid('set_arcData', listed.join('\n'), 'arcData')
  return {
    startingAngle: startingAngle as number,
    endingAngle: endingAngle as number,
    innerRadius: innerRadius as number
  }
}

/** An ellipse without arc data is a whole one, which Figma reports as a full turn. */
const WHOLE_ELLIPSE: ArcData = { startingAngle: 0, endingAngle: 2 * Math.PI, innerRadius: 0 }

/**
 * The members of Figma's `PolygonNode`, `StarNode`, and `EllipseNode` that shape them: a point
 * count, a star's inner radius, and an ellipse's arc. Installed on the proxies of those nodes
 * alone, as Figma has them on no other node.
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
