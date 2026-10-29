import { beforeAll, describe, expect, test } from 'bun:test'

import { registerTestFont } from '#core-tests/helpers/figma-api'

import { FigmaAPI, type FigmaConnectorNode } from '@open-pencil/core/figma-api'
import { ALL_TOOLS } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

beforeAll(() => registerTestFont())

/** Runs the tool as its executors do, loading the label's font first. */
async function createConnector(figma: FigmaAPI, args: Record<string, unknown>) {
  const tool = ALL_TOOLS.find((item) => item.name === 'create_connector')
  if (!tool) throw new Error('No create_connector tool')
  await tool.loadFonts(figma, args)
  return tool.execute(figma, args)
}

describe('create_connector', () => {
  test('joins two layers with a labelled elbow that follows them', async () => {
    const figma = new FigmaAPI(new SceneGraph())
    const a = figma.createRectangle()
    const b = figma.createRectangle()
    b.x = 400
    const summary = await createConnector(figma, {
      start: { id: a.id },
      end: { id: b.id, magnet: 'LEFT' },
      label: 'Next'
    }) as { id: string }
    const connector = figma.getNodeById(summary.id) as FigmaConnectorNode
    expect(connector.connectorStart).toEqual({ endpointNodeId: a.id, magnet: 'AUTO' })
    expect(connector.connectorEnd).toEqual({ endpointNodeId: b.id, magnet: 'LEFT' })
    expect(connector.text.characters).toBe('Next')
  })

  test('a straight connector to a point attaches by the layer centre', async () => {
    const figma = new FigmaAPI(new SceneGraph())
    const a = figma.createRectangle()
    const summary = await createConnector(figma, {
      start: { id: a.id },
      end: { x: 300, y: 300 },
      line_type: 'STRAIGHT',
      end_cap: 'TRIANGLE_FILLED'
    }) as { id: string }
    const connector = figma.getNodeById(summary.id) as FigmaConnectorNode
    expect(connector.connectorStart).toEqual({ endpointNodeId: a.id, magnet: 'CENTER' })
    expect(connector.connectorEndStrokeCap).toBe('TRIANGLE_FILLED')
  })
})
