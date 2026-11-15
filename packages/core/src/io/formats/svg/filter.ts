import type { Effect } from '@open-pencil/scene-graph'

import { formatColor, type SVGExportContext } from './defs'
import { svg, svgElement, type SVGNode } from './node'
import { round } from './paths'

/** Every pixel the layer covers at full strength, which Figma casts its shadows from. */
export const HARD_ALPHA = 'hardAlpha'

/** An SVG filter's primitives as they are added, each naming its result uniquely. */
export class FilterBuilder {
  readonly primitives: SVGNode[] = []
  private count = 0

  constructor(
    private readonly id: string,
    private readonly ctx: SVGExportContext
  ) {}

  /** A primitive with as many children as `children` holds. */
  pushElement(
    tag: string,
    attrs: Record<string, string | number | undefined>,
    children: SVGNode[]
  ) {
    this.primitives.push(svgElement(tag, attrs, children))
  }

  /** The colour space the export writes colours in. */
  get colorSpace(): SVGExportContext['colorSpace'] {
    return this.ctx.colorSpace
  }

  /** A new result name, unique in this filter. */
  result(name: string): string {
    this.count += 1
    return `${this.id}_${name}${this.count}`
  }

  push(tag: string, attrs: Record<string, string | number | undefined>, ...children: SVGNode[]) {
    this.primitives.push(svg(tag, attrs, ...children))
  }

  /**
   * A shadow's alpha: the layer's grown by `spread` (shrunk when negative), moved by the offset,
   * and blurred. Returns its result name.
   */
  shadowAlpha(effect: Effect, spread: number): string {
    let input = HARD_ALPHA
    if (spread !== 0) {
      const morphed = this.result('spread')
      this.push('feMorphology', {
        in: HARD_ALPHA,
        operator: spread > 0 ? 'dilate' : 'erode',
        radius: round(Math.abs(spread)),
        result: morphed
      })
      input = morphed
    }
    const offset = this.result('offset')
    this.push('feOffset', {
      in: input,
      dx: round(effect.offset.x),
      dy: round(effect.offset.y),
      result: offset
    })
    if (effect.radius <= 0) return offset
    const blurred = this.result('blur')
    this.push('feGaussianBlur', {
      in: offset,
      stdDeviation: round(effect.radius / 2),
      result: blurred
    })
    return blurred
  }

  /** The shadow's colour inside `alpha`, under the name `result`. */
  shadowColor(effect: Effect, alpha: string, result: string): void {
    const color = this.result('color')
    this.push('feFlood', {
      'flood-color': formatColor(effect.color, 1, this.ctx.colorSpace),
      'flood-opacity': round(effect.color.a),
      result: color
    })
    this.push('feComposite', { in: color, in2: alpha, operator: 'in', result })
  }
}
