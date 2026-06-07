import { describe, expect, test } from 'bun:test'

import type { Editor } from '@inkly/core/editor'
import type { SceneNode } from '@inkly/core/scene-graph'

import { usePropScrub } from '#vue/controls/prop-scrub/use'

function fakeNode(id: string, props: Record<string, number | string> = {}): SceneNode {
  const proxy = { id, ...props } as Partial<SceneNode>
  return proxy as SceneNode
}

interface UpdateCall {
  id: string
  patch: Record<string, unknown>
}
interface CommitCall {
  id: string
  patch: Record<string, unknown>
  label: string
}

function buildFakeEditor() {
  const updateCalls: UpdateCall[] = []
  const commitCalls: CommitCall[] = []
  const editor = {
    updateNode: (id: string, patch: Record<string, unknown>) => {
      updateCalls.push({ id, patch })
    },
    commitNodeUpdate: (id: string, patch: Record<string, unknown>, label: string) => {
      commitCalls.push({ id, patch, label })
    }
  }
  const editorRef = editor as Partial<Editor>
  return { editor: editorRef as Editor, updateCalls, commitCalls }
}

describe('usePropScrub', () => {
  test('updateProp on a single node calls editor.updateNode once', () => {
    const { editor, updateCalls } = buildFakeEditor()
    const scrub = usePropScrub(editor)
    const node = fakeNode('a', { width: 100 })

    scrub.updateProp([node], 'width', 200)

    expect(updateCalls).toEqual([{ id: 'a', patch: { width: 200 } }])
  })

  test('updateProp on multi nodes updates each node and snapshots previous values', () => {
    const { editor, updateCalls } = buildFakeEditor()
    const scrub = usePropScrub(editor)
    const nodes = [fakeNode('a', { width: 100 }), fakeNode('b', { width: 150 })]

    scrub.updateProp(nodes, 'width', 300)

    expect(updateCalls).toEqual([
      { id: 'a', patch: { width: 300 } },
      { id: 'b', patch: { width: 300 } }
    ])
  })

  test('repeated updateProp on the same node keeps the original previous value', () => {
    const { editor, commitCalls } = buildFakeEditor()
    const scrub = usePropScrub(editor)
    const nodes = [fakeNode('a', { width: 100 }), fakeNode('b', { width: 150 })]

    scrub.updateProp(nodes, 'width', 200)
    nodes[0] = fakeNode('a', { width: 200 })
    nodes[1] = fakeNode('b', { width: 200 })
    scrub.updateProp(nodes, 'width', 300)

    scrub.commitProp(nodes, 'width', 300, 99)

    expect(commitCalls.length).toBe(2)
    expect(commitCalls[0]).toEqual({ id: 'a', patch: { width: 100 }, label: 'Change width' })
    expect(commitCalls[1]).toEqual({ id: 'b', patch: { width: 150 }, label: 'Change width' })
  })

  test('commitProp on single node uses the passed-in previous value', () => {
    const { editor, commitCalls } = buildFakeEditor()
    const scrub = usePropScrub(editor)
    const node = fakeNode('a', { width: 200 })

    scrub.commitProp([node], 'width', 200, 100)

    expect(commitCalls).toEqual([{ id: 'a', patch: { width: 100 }, label: 'Change width' }])
  })

  test('commitProp on multi nodes without prior snapshot falls back to passed-in previous', () => {
    const { editor, commitCalls } = buildFakeEditor()
    const scrub = usePropScrub(editor)
    const nodes = [fakeNode('a', { width: 100 }), fakeNode('b', { width: 150 })]

    scrub.commitProp(nodes, 'width', 200, 999)

    expect(commitCalls.length).toBe(2)
    expect(commitCalls[0].patch).toEqual({ width: 999 })
    expect(commitCalls[1].patch).toEqual({ width: 999 })
  })

  test('previousValues are cleared after multi-node commitProp', () => {
    const { editor, commitCalls } = buildFakeEditor()
    const scrub = usePropScrub(editor)
    const nodes = [fakeNode('a', { width: 100 }), fakeNode('b', { width: 150 })]

    scrub.updateProp(nodes, 'width', 200)
    scrub.commitProp(nodes, 'width', 200, 1)
    commitCalls.length = 0

    scrub.commitProp(nodes, 'width', 200, 50)

    expect(commitCalls[0].patch).toEqual({ width: 50 })
    expect(commitCalls[1].patch).toEqual({ width: 50 })
  })
})
