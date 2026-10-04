import { describe, expect, test } from 'bun:test'

import type { LintMessage } from '@open-pencil/core/lint'
import { SceneGraph } from '@open-pencil/scene-graph'

import {
  countIssues,
  groupIssuesByRule,
  highlightForIssue,
  issuesWithin,
  markersForIssues,
  mostSevereIssue,
  toDesignIssues
} from '@/app/editor/design-check/issues'

function message(
  ruleId: string,
  nodeId: string,
  severity: LintMessage['severity'],
  data?: LintMessage['data']
): LintMessage {
  return { ruleId, nodeId, severity, message: ruleId, nodeName: nodeId, nodePath: [nodeId], data }
}

describe('design issues', () => {
  test('keep their identity across re-checks, even with several findings per layer', () => {
    const messages = [
      message('consistent-spacing', 'card', 'warning'),
      message('consistent-spacing', 'card', 'warning'),
      message('no-groups', 'card', 'info')
    ]

    const first = toDesignIssues(messages, 'page').map((issue) => issue.id)
    const second = toDesignIssues(messages, 'page').map((issue) => issue.id)

    expect(first).toEqual([
      'consistent-spacing:card:0',
      'consistent-spacing:card:1',
      'no-groups:card:0'
    ])
    expect(second).toEqual(first)
  })

  test('mark each layer once, by its most severe problem, and leave suggestions to the panel', () => {
    const issues = toDesignIssues(
      [
        message('consistent-spacing', 'card', 'warning'),
        message('color-contrast', 'card', 'error'),
        message('no-groups', 'group', 'info')
      ],
      'page'
    )

    expect(markersForIssues(issues)).toEqual([{ nodeId: 'card', severity: 'error', count: 2 }])
    expect(countIssues(issues)).toEqual({ error: 1, warning: 1, info: 1 })
    expect(mostSevereIssue(issues)?.ruleId).toBe('color-contrast')
  })

  test('group by rule, most severe and most frequent first', () => {
    const issues = toDesignIssues(
      [
        message('no-default-names', 'a', 'info'),
        message('consistent-spacing', 'a', 'warning'),
        message('no-hardcoded-colors', 'b', 'warning'),
        message('no-hardcoded-colors', 'c', 'warning'),
        message('color-contrast', 'd', 'error')
      ],
      'page'
    )

    expect(groupIssuesByRule(issues).map((group) => [group.ruleId, group.issues.length])).toEqual([
      ['color-contrast', 1],
      ['no-hardcoded-colors', 2],
      ['consistent-spacing', 1],
      ['no-default-names', 1]
    ])
  })

  test('narrow to the selected layers and everything inside them', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const card = graph.createNode('FRAME', pageId, { name: 'Card' })
    const label = graph.createNode('TEXT', card.id, { name: 'Label' })
    const other = graph.createNode('FRAME', pageId, { name: 'Other' })
    const issues = toDesignIssues(
      [
        message('color-contrast', label.id, 'error'),
        message('no-groups', other.id, 'info'),
        message('consistent-spacing', card.id, 'warning')
      ],
      'page'
    )

    const inside = issuesWithin(issues, graph, new Set([card.id]))

    expect(inside.map((issue) => issue.nodeId)).toEqual([label.id, card.id])
    expect(issuesWithin(issues, graph, new Set())).toEqual([])
  })

  test('highlight touch targets with the size they should reach', () => {
    const [target, text] = toDesignIssues(
      [
        message('touch-target-size', 'chip', 'warning', { width: 60, height: 24, minSize: 44 }),
        message('min-text-size', 'caption', 'warning', { fontSize: 10, minSize: 12 })
      ],
      'page'
    )

    expect(highlightForIssue(target)).toEqual({
      nodeId: 'chip',
      severity: 'warning',
      minSize: { width: 44, height: 44 }
    })
    expect(highlightForIssue(text).minSize).toBeUndefined()
  })
})
