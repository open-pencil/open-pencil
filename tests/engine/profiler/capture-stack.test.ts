import { describe, it, expect } from 'bun:test'

import { CaptureStack } from '@open-pencil/core'

describe('CaptureStack', () => {
  it('builds a tree of node profiles', () => {
    const stack = new CaptureStack()
    stack.reset(performance.now())

    stack.begin('node-1', 'Frame 1', 'FRAME', false)
    stack.begin('node-2', 'Rect', 'RECTANGLE', false)
    stack.end(2)
    stack.end(3)

    const roots = stack.getRootProfiles()
    expect(roots).toHaveLength(1)
    expect(roots[0].nodeId).toBe('node-1')
    expect(roots[0].children).toHaveLength(1)
    expect(roots[0].children[0].nodeId).toBe('node-2')
    expect(roots[0].children[0].drawCalls).toBe(2)
  })
})

