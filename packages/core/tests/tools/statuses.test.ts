import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'
import { STATUS_WORKFLOW_PRESETS, writeStatusWorkflow } from '@open-pencil/scene-graph/statuses'

import { getStatuses, setStatus } from '#core/tools/statuses'

describe('status tools', () => {
  test('agents list statuses, set one by name, and find the layers that show it', async () => {
    const graph = new SceneGraph()
    writeStatusWorkflow(graph, STATUS_WORKFLOW_PRESETS.review)
    const figma = new FigmaAPI(graph)
    const section = figma.createSection()
    section.name = 'Checkout'

    expect(await setStatus.execute(figma, { node: section.id, status: 'In review' })).toEqual({
      node: section.id,
      status: 'In review'
    })
    expect(await getStatuses.execute(figma, { status: 'In review' })).toMatchObject({
      layers: [{ id: section.id, name: 'Checkout', type: 'SECTION', status: 'In review' }]
    })
    expect(await getStatuses.execute(figma, { status: 'Approved' })).toMatchObject({ layers: [] })
  })

  test('an unknown status is reported, not set', async () => {
    const figma = new FigmaAPI(new SceneGraph())
    const section = figma.createSection()
    const result = await setStatus.execute(figma, { node: section.id, status: 'Approved' })
    expect(result).toEqual({
      error: 'No status named Approved; the document has Ready for dev, Completed'
    })
  })
})
