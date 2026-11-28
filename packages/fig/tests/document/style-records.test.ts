import { describe, expect, test } from 'bun:test'

import { figArchiveOf } from '#fig-tests/helpers/fig-fixtures'
import { materializeDocument, materializeFigArchive } from '#fig/document/materialize'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { expectDefined } from '@open-pencil/test-support/assert'
import { guid } from '@open-pencil/test-support/fig/guid'

const PALE_GREEN: Color = { r: 0.875, g: 1, b: 0.875, a: 1 }
const GREEN: Color = { r: 0.125, g: 0.625, b: 0.125, a: 1 }
const CYAN: Color = { r: 0, g: 0.5, b: 0.625, a: 1 }

const solid = (color: Color): NonNullable<NodeChange['fillPaints']> => [
  { type: 'SOLID', color, opacity: 1, visible: true }
]
const under = (parent: number) => ({ guid: guid(parent), position: '!' })
const styleRef = (localID: number) => ({ guid: guid(localID) })

const SELF_NAMING = 10
const GREEN_STYLE = 11
const CYAN_STYLE = 12

// A style's record can keep a fill style reference from before it was duplicated and recolored,
// naming itself or another style. Figma reads the style's value from the record's own paints.
const RECORDS: NodeChange[] = [
  { guid: guid(0), type: 'DOCUMENT', phase: 'CREATED' },
  { guid: guid(1), type: 'CANVAS', phase: 'CREATED', name: 'Page', parentIndex: under(0) },
  { guid: guid(2), type: 'CANVAS', phase: 'CREATED', internalOnly: true, parentIndex: under(0) },
  {
    guid: guid(SELF_NAMING),
    type: 'RECTANGLE',
    phase: 'CREATED',
    styleType: 'FILL',
    parentIndex: under(2),
    fillPaints: solid(PALE_GREEN),
    styleIdForFill: styleRef(SELF_NAMING)
  },
  {
    guid: guid(GREEN_STYLE),
    type: 'RECTANGLE',
    phase: 'CREATED',
    styleType: 'FILL',
    parentIndex: under(2),
    fillPaints: solid(GREEN)
  },
  {
    guid: guid(CYAN_STYLE),
    type: 'RECTANGLE',
    phase: 'CREATED',
    styleType: 'FILL',
    parentIndex: under(2),
    fillPaints: solid(CYAN),
    styleIdForFill: styleRef(GREEN_STYLE)
  },
  ...[SELF_NAMING, CYAN_STYLE].map((style, index): NodeChange => ({
    guid: guid(20 + index),
    type: 'RECTANGLE',
    phase: 'CREATED',
    name: `Uses ${style}`,
    parentIndex: under(1),
    size: { x: 10, y: 10 },
    fillPaints: solid({ r: 0, g: 0, b: 0, a: 1 }),
    styleIdForFill: styleRef(style)
  }))
]

function fillOf(graph: ReturnType<typeof materializeDocument>['graph'], name: string): Color {
  const node = expectDefined(
    [...graph.nodes.values()].find((candidate) => candidate.name === name),
    name
  )
  return expectDefined(node.fills[0], `${name} fill`).color
}

describe('style records', () => {
  test('keep their own paints when read whole', () => {
    const { graph } = materializeDocument(RECORDS)

    expect(fillOf(graph, `Uses ${SELF_NAMING}`)).toEqual(PALE_GREEN)
    expect(fillOf(graph, `Uses ${CYAN_STYLE}`)).toEqual(CYAN)
  })

  test('keep their own paints when read from an archive', async () => {
    const { graph } = materializeFigArchive(await figArchiveOf(RECORDS))

    expect(fillOf(graph, `Uses ${SELF_NAMING}`)).toEqual(PALE_GREEN)
    expect(fillOf(graph, `Uses ${CYAN_STYLE}`)).toEqual(CYAN)
  })
})
