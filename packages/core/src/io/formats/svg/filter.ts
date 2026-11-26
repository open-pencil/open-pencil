import type { Effect } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { formatColor, type SVGExportContext } from './defs'
import { svg, svgElement, type SVGNode } from './node'
import { round } from './paths'

/**
 * A flood's colour, opaque: its alpha goes in `flood-opacity`, which a Display P3 colour would
 * otherwise carry a second time.
 */
export function floodColor(color: Color, colors: SVGExportContext['colors']): string {
  return formatColor({ ...color, a: 1 }, 1, colors)
}

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

  /** The profiles the export's colours are stored and written in. */
  get colors(): SVGExportContext['colors'] {
    return this.ctx.colors
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
      'flood-color': floodColor(effect.color, this.ctx.colors),
      'flood-opacity': round(effect.color.a),
      result: color
    })
    this.push('feComposite', { in: color, in2: alpha, operator: 'in', result })
  }
}
