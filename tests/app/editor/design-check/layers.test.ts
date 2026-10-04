import { describe, expect, test } from 'bun:test'

import type { LintMessage } from '@open-pencil/core/lint'
import { SceneGraph } from '@open-pencil/scene-graph'

import { toDesignIssues } from '@/app/editor/design-check/issues'
import { layerIssueMarks } from '@/app/editor/design-check/layers'

function message(ruleId: string, nodeId: string, severity: LintMessage['severity']): LintMessage {
  return { ruleId, nodeId, severity, message: ruleId, nodeName: nodeId, nodePath: [nodeId] }
}

describe('layer issue marks', () => {
  test('mark layers with errors and warnings and the ancestors that contain them', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const card = graph.createNode('FRAME', pageId, { name: 'Card' })
    const row = graph.createNode('FRAME', card.id, { name: 'Row' })
    const label = graph.createNode('TEXT', row.id, { name: 'Label' })
    const icon = graph.createNode('VECTOR', card.id, { name: 'Icon' })

    const marks = layerIssueMarks(
      toDesignIssues(
        [
          message('color-contrast', label.id, 'error'),
          message('touch-target-size', icon.id, 'warning'),
          message('min-text-size', label.id, 'warning'),
          message('no-groups', card.id, 'info')
        ],
        'page'
      ),
      graph
    )

    expect(marks.get(label.id)).toEqual({ severity: 'error', count: 2, own: true })
    expect(marks.get(icon.id)).toEqual({ severity: 'warning', count: 1, own: true })
    expect(marks.get(row.id)).toEqual({ severity: 'error', count: 0, own: false })
    // A suggestion on the card is left to the Lint panel; it still contains an error.
    expect(marks.get(card.id)).toEqual({ severity: 'error', count: 0, own: false })
    expect(marks.has(pageId)).toBe(false)
  })
})
