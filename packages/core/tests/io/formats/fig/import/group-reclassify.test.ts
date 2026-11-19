import { expect, test } from 'bun:test'

import { nodeChangeToProps } from '@open-pencil/fig/node-change'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { parseFixture } from '@open-pencil/test-support/fig/fixtures'
import { collectAllNodes } from '@open-pencil/test-support/fig/traversal'
import { heavy, HEAVY_TEST_TIMEOUT_MS } from '@open-pencil/test-support/heavy'
heavy('Figma group reclassification on import', () => {
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

  test(
    'gold-preview.fig fixture imports its groups as GROUP nodes',
    async () => {
      const graph = await parseFixture('gold-preview.fig')
      const groups = collectAllNodes(graph).filter((n) => n.type === 'GROUP')
      // gold-preview.fig contains real Figma groups (FRAME + resizeToFit) that must
      // import as GROUP, not FRAME.
      expect(groups.length).toBeGreaterThan(0)
    },
    { timeout: HEAVY_TEST_TIMEOUT_MS }
  )
})
