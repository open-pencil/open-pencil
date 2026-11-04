import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import {
  statusWorkflowImpact,
  STATUS_WORKFLOW_PRESETS,
  type StatusWorkflow
} from '@open-pencil/scene-graph/statuses'

const { review } = STATUS_WORKFLOW_PRESETS

function setup(states: Record<string, string>) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  for (const [name, status] of Object.entries(states))
    graph.createNode('FRAME', page, { name, status })
  return graph
}

function renamed(workflow: StatusWorkflow, id: string, name: string): StatusWorkflow {
  return {
    states: workflow.states.map((state) => (state.id === id ? { ...state, name } : state))
  }
}

describe('what a workflow change does to layers', () => {
  test('nothing for a change no layer shows', () => {
    const graph = setup({ A: 'approved' })
    expect(statusWorkflowImpact(graph, review, renamed(review, 'draft', 'Idea'), {})).toEqual([])
  })

  test('a rename of a state in use, counted per pair of names', () => {
    const graph = setup({ A: 'approved', B: 'approved', C: 'draft' })
    expect(
      statusWorkflowImpact(graph, review, renamed(review, 'approved', 'Signed off'), {})
    ).toEqual([{ from: 'Approved', to: 'Signed off', count: 2 }])
  })

  test('a dropped state moves its layers or clears their status', () => {
    const graph = setup({ A: 'approved', B: 'draft' })
    const next = {
      states: review.states.filter((state) => state.id !== 'approved' && state.id !== 'draft')
    }
    expect(
      statusWorkflowImpact(graph, review, next, { approved: 'ready-for-dev', draft: null })
    ).toEqual([
      { from: 'Approved', to: 'Ready for dev', count: 1 },
      { from: 'Draft', to: null, count: 1 }
    ])
  })
})
