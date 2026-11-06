import { describe, expect, test } from 'bun:test'

import { attachTestRenderer, createAPI } from '#core-tests/helpers/figma-api'
import { registerTestFont } from '@open-pencil/test-support/fonts/bundled'
import type { SkiaRenderer } from '@open-pencil/core/canvas'
import type { FigmaAPI } from '@open-pencil/core/figma-api'

// Figma's answers measured in Figma desktop 126.

const RED = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }] as const
const BLUE = [{ type: 'SOLID', color: { r: 0, g: 0, b: 1 } }] as const

/** Figma's `strokeGeometry` for a 40 by 20 rectangle with a 4 px inside stroke. */
const FIGMA_INSIDE_4 =
  'M0 0 L0 -4 L-4 -4 L-4 0 L0 0 Z M40 0 L44 0 L44 -4 L40 -4 L40 0 Z M40 20 L40 24 L44 24 L44 20 L40 20 Z M0 20 L-4 20 L-4 24 L0 24 L0 20 Z M0 0 L0 4 L40 4 L40 0 L40 -4 L0 -4 L0 0 Z M40 0 L36 0 L36 20 L40 20 L44 20 L44 0 L40 0 Z M40 20 L40 16 L0 16 L0 20 L0 24 L40 24 L40 20 Z M0 20 L4 20 L4 0 L0 0 L-4 0 L-4 20 L0 20 Z'
/** The same rectangle with a 4 px centred stroke. */
const FIGMA_CENTER_4 =
  'M0 0 L0 -2 L-2 -2 L-2 0 L0 0 Z M40 0 L42 0 L42 -2 L40 -2 L40 0 Z M40 20 L40 22 L42 22 L42 20 L40 20 Z M0 20 L-2 20 L-2 22 L0 22 L0 20 Z M0 0 L0 2 L40 2 L40 0 L40 -2 L0 -2 L0 0 Z M40 0 L38 0 L38 20 L40 20 L42 20 L42 0 L40 0 Z M40 20 L40 18 L0 18 L0 20 L0 22 L40 22 L40 20 Z M0 20 L2 20 L2 0 L0 0 L-2 0 L-2 20 L0 20 Z'
/** With inside sides of 4, 0, 1, and 2 px, top first. */
const FIGMA_SIDES =
  'M0 0 L0 -4 L-2 -4 L-2 0 L0 0 Z M0 20 L-2 20 L-2 21 L0 21 L0 20 Z M0 0 L0 4 L40 4 L40 0 L40 -4 L0 -4 L0 0 Z M40 20 L40 19 L0 19 L0 20 L0 21 L40 21 L40 20 Z M0 20 L2 20 L2 0 L0 0 L-2 0 L-2 20 L0 20 Z'
/** With a 2 px inside stroke dashed 4 on, 4 off. */
const FIGMA_DASHED =
  'M0 0 L0 -1 L-1 -1 L-1 0 L0 0 Z M40 0 L41 0 L41 -1 L40 -1 L40 0 Z M40 20 L40 21 L41 21 L41 20 L40 20 Z M0 20 L-1 20 L-1 21 L0 21 L0 20 Z M0 0 L-1 0 L-1 1.66667 L0 1.66667 L1 1.66667 L1 0 L0 0 Z M0 5 L-1 5 L-1 8.33333 L0 8.33333 L1 8.33333 L1 5 L0 5 Z M0 11.6667 L-1 11.6667 L-1 15 L0 15 L1 15 L1 11.6667 L0 11.6667 Z M0 18.3333 L-1 18.3333 L-1 20 L0 20 L1 20 L1 18.3333 L0 18.3333 Z M0 20 L0 21 L2 21 L2 20 L2 19 L0 19 L0 20 Z M6 20 L6 21 L10 21 L10 20 L10 19 L6 19 L6 20 Z M14 20 L14 21 L18 21 L18 20 L18 19 L14 19 L14 20 Z M22 20 L22 21 L26 21 L26 20 L26 19 L22 19 L22 20 Z M30 20 L30 21 L34 21 L34 20 L34 19 L30 19 L30 20 Z M38 20 L38 21 L40 21 L40 20 L40 19 L38 19 L38 20 Z M40 20 L41 20 L41 18.3333 L40 18.3333 L39 18.3333 L39 20 L40 20 Z M40 15 L41 15 L41 11.6667 L40 11.6667 L39 11.6667 L39 15 L40 15 Z M40 8.33333 L41 8.33333 L41 5 L40 5 L39 5 L39 8.33333 L40 8.33333 Z M40 1.66667 L41 1.66667 L41 0 L40 0 L39 0 L39 1.66667 L40 1.66667 Z M40 0 L40 -1 L38 -1 L38 0 L38 1 L40 1 L40 0 Z M34 0 L34 -1 L30 -1 L30 0 L30 1 L34 1 L34 0 Z M26 0 L26 -1 L22 -1 L22 0 L22 1 L26 1 L26 0 Z M18 0 L18 -1 L14 -1 L14 0 L14 1 L18 1 L18 0 Z M10 0 L10 -1 L6 -1 L6 0 L6 1 L10 1 L10 0 Z M2 0 L2 -1 L0 -1 L0 0 L0 1 L2 1 L2 0 Z M0 0 L0 -2 L-2 -2 L-2 0 L0 0 Z M40 0 L42 0 L42 -2 L40 -2 L40 0 Z M40 20 L40 22 L42 22 L42 20 L40 20 Z M0 20 L-2 20 L-2 22 L0 22 L0 20 Z M0 0 L-2 0 L-2 1.66667 L0 1.66667 L2 1.66667 L2 0 L0 0 Z M0 5 L-2 5 L-2 8.33333 L0 8.33333 L2 8.33333 L2 5 L0 5 Z M0 11.6667 L-2 11.6667 L-2 15 L0 15 L2 15 L2 11.6667 L0 11.6667 Z M0 18.3333 L-2 18.3333 L-2 20 L0 20 L2 20 L2 18.3333 L0 18.3333 Z M0 20 L0 22 L2 22 L2 20 L2 18 L0 18 L0 20 Z M6 20 L6 22 L10 22 L10 20 L10 18 L6 18 L6 20 Z M14 20 L14 22 L18 22 L18 20 L18 18 L14 18 L14 20 Z M22 20 L22 22 L26 22 L26 20 L26 18 L22 18 L22 20 Z M30 20 L30 22 L34 22 L34 20 L34 18 L30 18 L30 20 Z M38 20 L38 22 L40 22 L40 20 L40 18 L38 18 L38 20 Z M40 20 L42 20 L42 18.3333 L40 18.3333 L38 18.3333 L38 20 L40 20 Z M40 15 L42 15 L42 11.6667 L40 11.6667 L38 11.6667 L38 15 L40 15 Z M40 8.33333 L42 8.33333 L42 5 L40 5 L38 5 L38 8.33333 L40 8.33333 Z M40 1.66667 L42 1.66667 L42 0 L40 0 L38 0 L38 1.66667 L40 1.66667 Z M40 0 L40 -2 L38 -2 L38 0 L38 2 L40 2 L40 0 Z M34 0 L34 -2 L30 -2 L30 0 L30 2 L34 2 L34 0 Z M26 0 L26 -2 L22 -2 L22 0 L22 2 L26 2 L26 0 Z M18 0 L18 -2 L14 -2 L14 0 L14 2 L18 2 L18 0 Z M10 0 L10 -2 L6 -2 L6 0 L6 2 L10 2 L10 0 Z M2 0 L2 -2 L0 -2 L0 0 L0 2 L2 2 L2 0 Z'
/** A 40 by 20 and a 20 by 40 rectangle united, with a 2 px centred stroke. */
const FIGMA_BOOLEAN =
  'M40 0 L41 0 L41 -1 L40 -1 L40 0 Z M40 20 L40 21 L41 21 L41 20 L40 20 Z M20 20 L20 19 L19 19 L19 20 L20 20 Z M20 40 L20 41 L21 41 L21 40 L20 40 Z M0 40 L-1 40 L-1 41 L0 41 L0 40 Z M0 0 L0 -1 L-1 -1 L-1 0 L0 0 Z M40 0 L39 0 L39 20 L40 20 L41 20 L41 0 L40 0 Z M40 20 L40 19 L20 19 L20 20 L20 21 L40 21 L40 20 Z M20 20 L19 20 L19 40 L20 40 L21 40 L21 20 L20 20 Z M20 40 L20 39 L0 39 L0 40 L0 41 L20 41 L20 40 Z M0 40 L1 40 L1 0 L0 0 L-1 0 L-1 40 L0 40 Z M0 0 L0 1 L40 1 L40 0 L40 -1 L0 -1 L0 0 Z'
/** Inside sides of 4, 0, 1, and 2 px, top first, dashed 4 on, 4 off. */
const FIGMA_SIDES_DASHED =
  'M0 0 L0 -2 L-1 -2 L-1 0 L0 0 Z M0 20 L-1 20 L-1 20.5 L0 20.5 L0 20 Z M0 0 L-1 0 L-1 1.66667 L0 1.66667 L1 1.66667 L1 0 L0 0 Z M0 5 L-1 5 L-1 8.33333 L0 8.33333 L1 8.33333 L1 5 L0 5 Z M0 11.6667 L-1 11.6667 L-1 15 L0 15 L1 15 L1 11.6667 L0 11.6667 Z M0 18.3333 L-1 18.3333 L-1 20 L0 20 L1 20 L1 18.3333 L0 18.3333 Z M0 20 L0 20.5 L2 20.5 L2 20 L2 19.5 L0 19.5 L0 20 Z M6 20 L6 20.5 L10 20.5 L10 20 L10 19.5 L6 19.5 L6 20 Z M14 20 L14 20.5 L18 20.5 L18 20 L18 19.5 L14 19.5 L14 20 Z M22 20 L22 20.5 L26 20.5 L26 20 L26 19.5 L22 19.5 L22 20 Z M30 20 L30 20.5 L34 20.5 L34 20 L34 19.5 L30 19.5 L30 20 Z M38 20 L38 20.5 L40 20.5 L40 20 L40 19.5 L38 19.5 L38 20 Z M40 0 L40 -2 L38 -2 L38 0 L38 2 L40 2 L40 0 Z M34 0 L34 -2 L30 -2 L30 0 L30 2 L34 2 L34 0 Z M26 0 L26 -2 L22 -2 L22 0 L22 2 L26 2 L26 0 Z M18 0 L18 -2 L14 -2 L14 0 L14 2 L18 2 L18 0 Z M10 0 L10 -2 L6 -2 L6 0 L6 2 L10 2 L10 0 Z M2 0 L2 -2 L0 -2 L0 0 L0 2 L2 2 L2 0 Z M0 0 L0 -4 L-2 -4 L-2 0 L0 0 Z M0 20 L-2 20 L-2 21 L0 21 L0 20 Z M0 0 L-2 0 L-2 1.66667 L0 1.66667 L2 1.66667 L2 0 L0 0 Z M0 5 L-2 5 L-2 8.33333 L0 8.33333 L2 8.33333 L2 5 L0 5 Z M0 11.6667 L-2 11.6667 L-2 15 L0 15 L2 15 L2 11.6667 L0 11.6667 Z M0 18.3333 L-2 18.3333 L-2 20 L0 20 L2 20 L2 18.3333 L0 18.3333 Z M0 20 L0 21 L2 21 L2 20 L2 19 L0 19 L0 20 Z M6 20 L6 21 L10 21 L10 20 L10 19 L6 19 L6 20 Z M14 20 L14 21 L18 21 L18 20 L18 19 L14 19 L14 20 Z M22 20 L22 21 L26 21 L26 20 L26 19 L22 19 L22 20 Z M30 20 L30 21 L34 21 L34 20 L34 19 L30 19 L30 20 Z M38 20 L38 21 L40 21 L40 20 L40 19 L38 19 L38 20 Z M40 0 L40 -4 L38 -4 L38 0 L38 4 L40 4 L40 0 Z M34 0 L34 -4 L30 -4 L30 0 L30 4 L34 4 L34 0 Z M26 0 L26 -4 L22 -4 L22 0 L22 4 L26 4 L26 0 Z M18 0 L18 -4 L14 -4 L14 0 L14 4 L18 4 L18 0 Z M10 0 L10 -4 L6 -4 L6 0 L6 4 L10 4 L10 0 Z M2 0 L2 -4 L0 -4 L0 0 L0 4 L2 4 L2 0 Z'
/** A 2 px inside top side and no others, the stroke's own weight 0. */
const FIGMA_TOP_SIDE = 'M0 0 L0 2 L40 2 L40 0 L40 -2 L0 -2 L0 0 Z'
/** Two 20 px square loops of one vector, a 2 px centred stroke dashed 4 on, 4 off. */
const FIGMA_TWO_LOOPS =
  'M0 0 L0 -1 L-1 -1 L-1 0 L0 0 Z M20 0 L21 0 L21 -1 L20 -1 L20 0 Z M20 20 L20 21 L21 21 L21 20 L20 20 Z M0 20 L-1 20 L-1 21 L0 21 L0 20 Z M40 0 L40 -1 L39 -1 L39 0 L40 0 Z M60 0 L61 0 L61 -1 L60 -1 L60 0 Z M60 20 L60 21 L61 21 L61 20 L60 20 Z M40 20 L39 20 L39 21 L40 21 L40 20 Z M0 0 L-1 0 L-1 1.66667 L0 1.66667 L1 1.66667 L1 0 L0 0 Z M0 5 L-1 5 L-1 8.33333 L0 8.33333 L1 8.33333 L1 5 L0 5 Z M0 11.6667 L-1 11.6667 L-1 15 L0 15 L1 15 L1 11.6667 L0 11.6667 Z M0 18.3333 L-1 18.3333 L-1 20 L0 20 L1 20 L1 18.3333 L0 18.3333 Z M0 20 L0 21 L1.66667 21 L1.66667 20 L1.66667 19 L0 19 L0 20 Z M5 20 L5 21 L8.33333 21 L8.33333 20 L8.33333 19 L5 19 L5 20 Z M11.6667 20 L11.6667 21 L15 21 L15 20 L15 19 L11.6667 19 L11.6667 20 Z M18.3333 20 L18.3333 21 L20 21 L20 20 L20 19 L18.3333 19 L18.3333 20 Z M20 20 L21 20 L21 18.3333 L20 18.3333 L19 18.3333 L19 20 L20 20 Z M20 15 L21 15 L21 11.6667 L20 11.6667 L19 11.6667 L19 15 L20 15 Z M20 8.33333 L21 8.33333 L21 5 L20 5 L19 5 L19 8.33333 L20 8.33333 Z M20 1.66667 L21 1.66667 L21 0 L20 0 L19 0 L19 1.66667 L20 1.66667 Z M20 0 L20 -1 L18.3333 -1 L18.3333 0 L18.3333 1 L20 1 L20 0 Z M15 0 L15 -1 L11.6667 -1 L11.6667 0 L11.6667 1 L15 1 L15 0 Z M8.33333 0 L8.33333 -1 L5 -1 L5 0 L5 1 L8.33333 1 L8.33333 0 Z M1.66667 0 L1.66667 -1 L0 -1 L0 0 L0 1 L1.66667 1 L1.66667 0 Z M40 0 L39 0 L39 1.66667 L40 1.66667 L41 1.66667 L41 0 L40 0 Z M40 5 L39 5 L39 8.33333 L40 8.33333 L41 8.33333 L41 5 L40 5 Z M40 11.6667 L39 11.6667 L39 15 L40 15 L41 15 L41 11.6667 L40 11.6667 Z M40 18.3333 L39 18.3333 L39 20 L40 20 L41 20 L41 18.3333 L40 18.3333 Z M40 20 L40 21 L41.6667 21 L41.6667 20 L41.6667 19 L40 19 L40 20 Z M45 20 L45 21 L48.3333 21 L48.3333 20 L48.3333 19 L45 19 L45 20 Z M51.6667 20 L51.6667 21 L55 21 L55 20 L55 19 L51.6667 19 L51.6667 20 Z M58.3333 20 L58.3333 21 L60 21 L60 20 L60 19 L58.3333 19 L58.3333 20 Z M60 20 L61 20 L61 18.3333 L60 18.3333 L59 18.3333 L59 20 L60 20 Z M60 15 L61 15 L61 11.6667 L60 11.6667 L59 11.6667 L59 15 L60 15 Z M60 8.33333 L61 8.33333 L61 5 L60 5 L59 5 L59 8.33333 L60 8.33333 Z M60 1.66667 L61 1.66667 L61 0 L60 0 L59 0 L59 1.66667 L60 1.66667 Z M60 0 L60 -1 L58.3333 -1 L58.3333 0 L58.3333 1 L60 1 L60 0 Z M55 0 L55 -1 L51.6667 -1 L51.6667 0 L51.6667 1 L55 1 L55 0 Z M48.3333 0 L48.3333 -1 L45 -1 L45 0 L45 1 L48.3333 1 L48.3333 0 Z M41.6667 0 L41.6667 -1 L40 -1 L40 0 L40 1 L41.6667 1 L41.6667 0 Z'
/** A 30 px line with a 2 px stroke. */
const FIGMA_LINE_2 = 'M0 -1 L0 0 L30 0 L30 -1 L30 -2 L0 -2 L0 -1 Z'
/** An open V, 20 wide and 10 deep, with a 2 px stroke. */
const FIGMA_OPEN_V =
  'M10 10 L9.29289 10.7071 L10 11.4142 L10.7071 10.7071 L10 10 Z M0 0 L-0.707107 0.707107 L9.29289 10.7071 L10 10 L10.7071 9.29289 L0.707107 -0.707107 L0 0 Z M10 10 L10.7071 10.7071 L20.7071 0.707107 L20 0 L19.2929 -0.707107 L9.29289 9.29289 L10 10 Z'

/**
 * Whether two path data strings fill the same area. Figma builds a stroke from a piece per edge
 * and per corner, Skia from one outline, so the text differs where the area does not.
 */
function sameArea(renderer: SkiaRenderer, a: string, b: string): boolean {
  const { ck } = renderer
  // A union with itself fills each piece of Figma's once where they overlap.
  const [first, second] = [a, b].map((data) => {
    const read = ck.Path.MakeFromSVGString(data)
    if (!read) throw new Error('unreadable path data')
    const filled = ck.Path.MakeFromOp(read, read, ck.PathOp.Union)
    read.delete()
    if (!filled) throw new Error('union failed')
    return filled
  })
  const difference = ck.Path.MakeFromOp(first, second, ck.PathOp.XOR)
  first.delete()
  second.delete()
  if (!difference) throw new Error('XOR failed')
  const [left, top, right, bottom] = difference.computeTightBounds()
  difference.delete()
  return right - left < 1e-3 || bottom - top < 1e-3
}

async function setup(): Promise<{ figma: FigmaAPI; renderer: SkiaRenderer }> {
  const figma = createAPI()
  return { figma, renderer: await attachTestRenderer(figma) }
}

function rectangle(figma: FigmaAPI, props: Record<string, unknown> = {}) {
  const rect = figma.createRectangle()
  rect.resize(40, 20)
  rect.fills = [...RED]
  Object.assign(rect, props)
  return rect
}

describe('fillGeometry', () => {
  test('is the shape’s outline, whatever its fills or visibility', async () => {
    const { figma } = await setup()
    const outline = [{ windingRule: 'NONZERO', data: 'M0 0 L40 0 L40 20 L0 20 L0 0 Z' }] as const
    expect(rectangle(figma).fillGeometry).toEqual(outline)
    expect(rectangle(figma, { fills: [] }).fillGeometry).toEqual(outline)
    expect(rectangle(figma, { visible: false }).fillGeometry).toEqual(outline)
  })

  test('draws an ellipse with Figma’s curves', async () => {
    const { figma } = await setup()
    const ellipse = figma.createEllipse()
    ellipse.resize(20, 20)
    expect(ellipse.fillGeometry).toEqual([
      {
        windingRule: 'NONZERO',
        data: 'M20 10 C20 15.5228 15.5228 20 10 20 C4.47715 20 0 15.5228 0 10 C0 4.47715 4.47715 0 10 0 C15.5228 0 20 4.47715 20 10 Z'
      }
    ])
  })

  test('draws Figma’s default star', async () => {
    const { figma } = await setup()
    const star = figma.createStar()
    star.resize(20, 20)
    expect(star.fillGeometry).toEqual([
      {
        windingRule: 'NONZERO',
        data: 'M10 0 L12.2451 6.90983 L19.5106 6.90983 L13.6327 11.1803 L15.8779 18.0902 L10 13.8197 L4.12215 18.0902 L6.36729 11.1803 L0.489435 6.90983 L7.75486 6.90983 L10 0 Z'
      }
    ])
  })

  test('follows a vector edited after it was read', async () => {
    const { figma } = await setup()
    const vector = figma.createVector()
    vector.vectorPaths = [{ windingRule: 'NONZERO', data: 'M 0 0 L 10 0 L 10 10 Z' }]
    expect(vector.fillGeometry[0]?.data).toBe('M0 0 L10 0 L10 10 L0 0 Z')
    vector.vectorPaths = [{ windingRule: 'NONZERO', data: 'M 0 0 L 20 0 L 20 20 Z' }]
    expect(vector.fillGeometry[0]?.data).toBe('M0 0 L20 0 L20 20 L0 0 Z')
  })

  test('is empty for a line and an open vector', async () => {
    const { figma } = await setup()
    const line = figma.createLine()
    line.resize(30, 0)
    const open = figma.createVector()
    open.vectorPaths = [{ windingRule: 'NONE', data: 'M 0 0 L 10 10 L 20 0' }]
    expect(line.fillGeometry).toEqual([])
    expect(open.fillGeometry).toEqual([])
  })
})

describe('strokeGeometry', () => {
  test('is empty without a visible stroke of some weight', async () => {
    const { figma } = await setup()
    expect(rectangle(figma).strokeGeometry).toEqual([])
    expect(rectangle(figma, { strokes: [...BLUE], strokeWeight: 0 }).strokeGeometry).toEqual([])
    const hidden = [{ ...BLUE[0], visible: false }]
    expect(rectangle(figma, { strokes: hidden, strokeWeight: 4 }).strokeGeometry).toEqual([])
  })

  test('centres the band, twice as wide for an inside or outside stroke', async () => {
    const { figma, renderer } = await setup()
    const cases = [
      [{ strokeAlign: 'INSIDE', strokeWeight: 4 }, FIGMA_INSIDE_4],
      [{ strokeAlign: 'OUTSIDE', strokeWeight: 4 }, FIGMA_INSIDE_4],
      [{ strokeAlign: 'CENTER', strokeWeight: 4 }, FIGMA_CENTER_4],
      [
        { strokeTopWeight: 4, strokeRightWeight: 0, strokeBottomWeight: 1, strokeLeftWeight: 2 },
        FIGMA_SIDES
      ],
      // A hidden layer still has its stroke.
      [{ strokeAlign: 'CENTER', strokeWeight: 4, visible: false }, FIGMA_CENTER_4]
    ] as const
    for (const [props, figmaData] of cases) {
      const [stroke] = rectangle(figma, { strokes: [...BLUE], ...props }).strokeGeometry
      expect(stroke.windingRule).toBe('NONZERO')
      expect(sameArea(renderer, stroke.data, figmaData)).toBe(true)
    }
  })

  test('dashes the band as Figma does', async () => {
    const { figma, renderer } = await setup()
    const dashed = rectangle(figma, { strokes: [...BLUE], strokeWeight: 2, dashPattern: [4, 4] })
    expect(sameArea(renderer, dashed.strokeGeometry[0].data, FIGMA_DASHED)).toBe(true)
    // The comparison tells bands apart.
    expect(sameArea(renderer, FIGMA_INSIDE_4, FIGMA_CENTER_4)).toBe(false)
  })

  test('strokes a boolean along its result', async () => {
    const { figma, renderer } = await setup()
    const wide = figma.createRectangle()
    wide.resize(40, 20)
    const tall = figma.createRectangle()
    tall.resize(20, 40)
    const union = figma.union([wide, tall], figma.currentPage)
    union.strokes = [...BLUE]
    union.strokeWeight = 2
    union.strokeAlign = 'CENTER'
    expect(sameArea(renderer, union.strokeGeometry[0].data, FIGMA_BOOLEAN)).toBe(true)
  })

  test('strokes sides of their own weights, dashed or with the stroke’s own weight 0', async () => {
    const { figma, renderer } = await setup()
    const sides = {
      strokeTopWeight: 4,
      strokeRightWeight: 0,
      strokeBottomWeight: 1,
      strokeLeftWeight: 2
    }
    const dashed = rectangle(figma, { strokes: [...BLUE], ...sides, dashPattern: [4, 4] })
    expect(sameArea(renderer, dashed.strokeGeometry[0].data, FIGMA_SIDES_DASHED)).toBe(true)
    const top = rectangle(figma, {
      strokes: [...BLUE],
      strokeTopWeight: 2,
      strokeRightWeight: 0,
      strokeBottomWeight: 0,
      strokeLeftWeight: 0
    })
    expect(sameArea(renderer, top.strokeGeometry[0].data, FIGMA_TOP_SIDE)).toBe(true)
  })

  test('keeps dashed sides of a rounded layer within its rounded stroke', async () => {
    const { figma, renderer } = await setup()
    const sides = {
      strokeTopWeight: 4,
      strokeRightWeight: 2,
      strokeBottomWeight: 1,
      strokeLeftWeight: 2
    }
    const solid = rectangle(figma, { strokes: [...BLUE], cornerRadius: 8, ...sides })
    const dashed = rectangle(figma, {
      strokes: [...BLUE],
      cornerRadius: 8,
      ...sides,
      dashPattern: [4, 4]
    })
    const { ck } = renderer
    const ring = ck.Path.MakeFromSVGString(solid.strokeGeometry[0].data)
    const dashes = ck.Path.MakeFromSVGString(dashed.strokeGeometry[0].data)
    if (!ring || !dashes) throw new Error('unreadable path data')
    const outside = ck.Path.MakeFromOp(dashes, ring, ck.PathOp.Difference)
    if (!outside) throw new Error('difference failed')
    expect(outside.isEmpty()).toBe(true)
    for (const path of [ring, dashes, outside]) path.delete()
  })

  test('dashes every loop of a vector', async () => {
    const { figma, renderer } = await setup()
    const loops = figma.createVector()
    loops.vectorPaths = [
      {
        windingRule: 'NONZERO',
        data: 'M 0 0 L 20 0 L 20 20 L 0 20 Z M 40 0 L 60 0 L 60 20 L 40 20 Z'
      }
    ]
    loops.strokes = [...BLUE]
    loops.strokeWeight = 2
    loops.strokeAlign = 'CENTER'
    loops.dashPattern = [4, 4]
    expect(sameArea(renderer, loops.strokeGeometry[0].data, FIGMA_TWO_LOOPS)).toBe(true)
  })

  test('measures the layout a script left pending', async () => {
    const { figma } = await setup()
    const frame = figma.createFrame()
    frame.layoutMode = 'HORIZONTAL'
    frame.primaryAxisSizingMode = 'AUTO'
    frame.counterAxisSizingMode = 'AUTO'
    const child = figma.createRectangle()
    child.resize(30, 10)
    frame.appendChild(child)
    child.resize(50, 10)
    expect(frame.fillGeometry).toEqual([
      { windingRule: 'NONZERO', data: 'M0 0 L50 0 L50 10 L0 10 L0 0 Z' }
    ])
  })

  test('strokes a line and an open vector along their path', async () => {
    const { figma, renderer } = await setup()
    const line = figma.createLine()
    line.resize(30, 0)
    line.strokes = [...BLUE]
    line.strokeWeight = 2
    const open = figma.createVector()
    open.vectorPaths = [{ windingRule: 'NONE', data: 'M 0 0 L 10 10 L 20 0' }]
    open.strokes = [...BLUE]
    open.strokeWeight = 2
    expect(sameArea(renderer, line.strokeGeometry[0].data, FIGMA_LINE_2)).toBe(true)
    expect(sameArea(renderer, open.strokeGeometry[0].data, FIGMA_OPEN_V)).toBe(true)
  })
})

describe('outlineStroke', () => {
  test('adds the stroke as a vector at the end of the page and keeps the layer', async () => {
    const { figma } = await setup()
    const frame = figma.createFrame()
    frame.x = 1000
    frame.y = 500
    const rect = rectangle(figma, {
      name: 'R',
      x: 5,
      y: 7,
      strokes: [...BLUE],
      strokeWeight: 4,
      strokeAlign: 'INSIDE',
      opacity: 0.5
    })
    frame.appendChild(rect)
    const outline = rect.outlineStroke()
    expect(outline).not.toBeNull()
    expect(outline?.type).toBe('VECTOR')
    expect(outline?.name).toBe('R (Stroke)')
    // Figma puts it on the page at the layer's place in its parent.
    expect(outline?.parent?.id).toBe(figma.currentPage.id)
    expect(figma.currentPage.children.at(-1)?.id).toBe(outline?.id)
    expect([outline?.x, outline?.y, outline?.width, outline?.height]).toEqual([5, 7, 40, 20])
    expect(outline?.fills).toMatchObject([{ type: 'SOLID', color: { r: 0, g: 0, b: 1 } }])
    expect(outline?.strokes).toEqual([])
    expect(outline?.opacity).toBe(0.5)
    expect(rect.removed).toBe(false)
  })

  test('is null without a visible stroke', async () => {
    const { figma } = await setup()
    expect(rectangle(figma).outlineStroke()).toBeNull()
    const hidden = [{ ...BLUE[0], visible: false }]
    expect(rectangle(figma, { strokes: hidden, strokeWeight: 4 }).outlineStroke()).toBeNull()
  })

  test('outlines text as a group of glyph vectors', async () => {
    const { figma } = await setup()
    await registerTestFont('Inter')
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
    const text = figma.createText()
    text.name = 'T'
    text.characters = 'Hi'
    text.strokes = [...BLUE]
    const outline = text.outlineStroke()
    expect(outline?.type).toBe('GROUP')
    expect(outline?.name).toBe('T (Stroke)')
    expect(outline?.children.length).toBeGreaterThan(0)
    expect(outline?.children.every((glyph) => glyph.type === 'VECTOR')).toBe(true)
  })
})

describe('geometry members', () => {
  test('exist where Figma has them', () => {
    const figma = createAPI()
    const group = figma.group([figma.createRectangle()], figma.currentPage)
    for (const node of [figma.createRectangle(), figma.createFrame(), figma.createLine()]) {
      expect('fillGeometry' in node && 'strokeGeometry' in node && 'outlineStroke' in node).toBe(
        true
      )
    }
    for (const node of [group, figma.currentPage, figma.createSection()]) {
      expect('fillGeometry' in node || 'outlineStroke' in node).toBe(false)
    }
  })

  test('say so on a host without a renderer', () => {
    const figma = createAPI()
    const rect = figma.createRectangle()
    expect(() => rect.fillGeometry).toThrow(
      'in get_fillGeometry: This host has no renderer to measure geometry with'
    )
    expect(() => rect.outlineStroke()).toThrow(
      'in outlineStroke: This host has no renderer to measure geometry with'
    )
  })
})
