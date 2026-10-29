import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { OPEN_PENCIL_PLUGIN_DATA, withPluginData } from '@open-pencil/scene-graph/plugin-data'
import {
  findStatusState,
  readStatusWorkflow,
  STATUS_WORKFLOW_PRESETS,
  writeStatusWorkflow
} from '@open-pencil/scene-graph/statuses'

describe('status workflow', () => {
  test("a document without one has Figma's Ready for dev and Completed", () => {
    expect(readStatusWorkflow(new SceneGraph())).toEqual(STATUS_WORKFLOW_PRESETS.handoff)
  })

  test('is stored on the document node and read back', () => {
    const graph = new SceneGraph()
    writeStatusWorkflow(graph, STATUS_WORKFLOW_PRESETS.review)
    expect(readStatusWorkflow(graph)).toEqual(STATUS_WORKFLOW_PRESETS.review)
  })

  test('a workflow with repeated ids is ignored', () => {
    const graph = new SceneGraph()
    const root = graph.getNode(graph.rootId)
    if (!root) throw new Error('missing root')
    const [state] = STATUS_WORKFLOW_PRESETS.simple.states
    graph.updateNode(root.id, {
      pluginData: withPluginData(root.pluginData, OPEN_PENCIL_PLUGIN_DATA.statuses, {
        states: [state, state]
      })
    })
    expect(readStatusWorkflow(graph)).toEqual(STATUS_WORKFLOW_PRESETS.handoff)
  })

  test("Figma's states read even in a workflow that removed them", () => {
    const { simple } = STATUS_WORKFLOW_PRESETS
    expect(findStatusState(simple, 'ready-for-dev')?.name).toBe('Ready for dev')
    expect(findStatusState(simple, 'completed')?.name).toBe('Done')
    expect(findStatusState(simple, 'unknown')).toBeUndefined()
  })
})
