import { describe, expect, test } from 'bun:test'

import type { NodeChange } from '#core/kiwi/fig/codec'
import { nodeChangeToProps } from '#core/kiwi/fig/node-change/convert'

import { parseFixture } from '#tests/helpers/fig-fixtures'
import { collectAllNodes } from '#tests/helpers/fig-traversal'

describe('Figma group reclassification on import', () => {
  test('FRAME with resizeToFit imports as GROUP', () => {
    const props = nodeChangeToProps(
      { type: 'FRAME', name: 'Group 1', resizeToFit: true } as NodeChange,
      []
    )
    expect(props.nodeType).toBe('GROUP')
    // groups never clip their children
    expect(props.clipsContent).toBe(false)
  })

  test('plain FRAME stays FRAME', () => {
    const props = nodeChangeToProps(
      { type: 'FRAME', name: 'Frame', resizeToFit: false } as NodeChange,
      []
    )
    expect(props.nodeType).toBe('FRAME')
  })

  test('FRAME with no resizeToFit flag stays FRAME', () => {
    const props = nodeChangeToProps({ type: 'FRAME', name: 'Frame' } as NodeChange, [])
    expect(props.nodeType).toBe('FRAME')
  })

  test('auto-layout hug frame stays FRAME (not GROUP)', () => {
    const props = nodeChangeToProps(
      {
        type: 'FRAME',
        name: 'AutoLayout',
        stackMode: 'VERTICAL',
        stackPrimarySizing: 'RESIZE_TO_FIT'
      } as NodeChange,
      []
    )
    expect(props.nodeType).toBe('FRAME')
  })

  test('auto-layout frame that also carries resizeToFit stays FRAME', () => {
    const props = nodeChangeToProps(
      {
        type: 'FRAME',
        name: 'AutoLayout2',
        stackMode: 'HORIZONTAL',
        resizeToFit: true
      } as NodeChange,
      []
    )
    expect(props.nodeType).toBe('FRAME')
  })

  test('gold-preview.fig fixture imports its groups as GROUP nodes', async () => {
    const graph = await parseFixture('gold-preview.fig')
    const groups = collectAllNodes(graph).filter((n) => n.type === 'GROUP')
    // gold-preview.fig contains real Figma groups (FRAME + resizeToFit) that must
    // import as GROUP, not FRAME.
    expect(groups.length).toBeGreaterThan(0)
  }, 30_000)
})
