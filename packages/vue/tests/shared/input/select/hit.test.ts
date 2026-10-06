import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

import type { HitTestFns } from '#vue/shared/input/select'
import { resolveHit } from '#vue/shared/input/select/hit'

let editor: Editor

afterEach(() => editor.dispose())

function labelHits(hits: Partial<Record<'frame' | 'section' | 'component', SceneNode>>): HitTestFns {
  return {
    hitTestInScope: () => null,
    isInsideContainerBounds: () => false,
    hitTestFrameTitle: () => hits.frame ?? null,
    hitTestSectionTitle: () => hits.section ?? null,
    hitTestComponentLabel: () => hits.component ?? null
  }
}

describe('label hits', () => {
  test('a press on overlapping labels picks the one drawn on top', () => {
    editor = createEditor()
    const pageId = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', pageId, { name: 'Frame' })
    const section = editor.graph.createNode('SECTION', pageId, { name: 'Section' })
    const component = editor.graph.createNode('COMPONENT', pageId, { name: 'Button' })

    // Labels are drawn frames, then sections, then components.
    expect(resolveHit(0, 0, editor, labelHits({ frame, section, component }))?.id).toBe(
      component.id
    )
    expect(resolveHit(0, 0, editor, labelHits({ frame, section }))?.id).toBe(section.id)
    expect(resolveHit(0, 0, editor, labelHits({ frame }))?.id).toBe(frame.id)
  })
})
