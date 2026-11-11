import { describe, expect, test } from 'bun:test'

import { renderNodesToSVG } from '@open-pencil/core/io/formats/svg'
import { SceneGraph, type SceneNode, type Stroke } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

/** The attributes of the `<line>` an SVG export writes for a line with a 6 px black stroke. */
function exportedLine(
  props: Partial<SceneNode>,
  stroke: Partial<Stroke> = {}
): Map<string, string> {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const line = graph.createNode('LINE', page, {
    width: 300,
    height: 0,
    strokeWeight: 6,
    ...props,
    strokes: [
      {
        type: 'SOLID',
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true,
        weight: 6,
        align: 'CENTER',
        ...stroke
      }
    ]
  })
  const svg = expectDefined(renderNodesToSVG(graph, page, [line.id]), 'SVG output')
  const element = expectDefined(/<line\b([^>]*)>/.exec(svg), 'line element')[1]
  return new Map(
    Array.from(element.matchAll(/([\w-]+)="([^"]*)"/g), ([, name, value]) => [name, value])
  )
}

// The canvas strokes a line as Figma 126 does; its export draws the same.
describe('a line exported to SVG', () => {
  test('takes its cap from the layer when the stroke has none, pulled in to end with the line', () => {
    const line = exportedLine({ strokeCap: 'ROUND' })
    expect(line.get('stroke-linecap')).toBe('round')
    expect(line.get('x1')).toBe('3')
    expect(line.get('x2')).toBe('297')
    expect(line.get('y1')).toBe('-3')
  })

  test('stretches its dashes to whole periods, with half a dash at each end', () => {
    // Dashes of 10 and gaps of 5 fit 20 times into 300 and 7 times, stretched, into 100: Figma's
    // stroke geometry for the 100 px line starts with a dash from 0 to 4.7619, which SVG rounds.
    const long = exportedLine({}, { dashPattern: [10, 5] })
    expect(long.get('stroke-dasharray')).toBe('10 5')
    expect(long.get('stroke-dashoffset')).toBe('5')
    const short = exportedLine({ width: 100 }, { dashPattern: [10, 5] })
    expect(Number(short.get('stroke-dashoffset'))).toBeCloseTo(4.7619, 1)
  })
})
