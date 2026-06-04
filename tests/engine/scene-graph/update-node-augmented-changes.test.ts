import { describe, expect, mock, test } from 'bun:test'

import { SceneGraph, type FigmaDerivedTextGlyph, type SceneNode } from '#core/scene-graph'

function getLastEmittedChanges(
  spy: ReturnType<typeof mock<(id: string, changes: Partial<SceneNode>) => void>>
): Partial<SceneNode> {
  const lastCall = spy.mock.calls[spy.mock.calls.length - 1]
  if (!lastCall) throw new Error('Expected node:updated to be emitted')
  return lastCall[1] as Partial<SceneNode>
}

describe('SceneGraph.updateNode augmented changes', () => {
  test('TC AS1 emits textPicture and figmaDerivedTextGlyphs when TEXT text changes', () => {
    // Given
    const graph = new SceneGraph()
    const page = graph.addPage('P')
    const text = graph.createNode('TEXT', page.id, { name: 'TXT', text: 'A' })
    const glyphs: FigmaDerivedTextGlyph[] = [
      { commandsBlob: new Uint8Array([1]), x: 0, y: 0, fontSize: 12 }
    ]
    text.textPicture = new Uint8Array([0, 1, 2])
    text.figmaDerivedTextGlyphs = glyphs
    const spy = mock<(id: string, changes: Partial<SceneNode>) => void>()
    const unbind = graph.onNodeEvents({ updated: spy })

    // When
    graph.updateNode(text.id, { text: 'B' })

    // Then
    expect(spy).toHaveBeenCalled()
    const emittedChanges = getLastEmittedChanges(spy)
    expect('textPicture' in emittedChanges).toBe(true)
    expect('figmaDerivedTextGlyphs' in emittedChanges).toBe(true)
    expect(emittedChanges.textPicture).toBeNull()
    expect(emittedChanges.figmaDerivedTextGlyphs).toBeNull()

    unbind()
  })

  test('TC AS2 emits source when imported node metadata is edited', () => {
    // Given
    const graph = new SceneGraph()
    const page = graph.addPage('P')
    const frame = graph.createNode('FRAME', page.id, { width: 100, height: 50 })
    frame.source.fig.rawNodeFields = { foo: 'bar' }
    const spy = mock<(id: string, changes: Partial<SceneNode>) => void>()
    const unbind = graph.onNodeEvents({ updated: spy })

    // When
    graph.updateNode(frame.id, {
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })

    // Then
    expect(spy).toHaveBeenCalled()
    const emittedChanges = getLastEmittedChanges(spy)
    expect('source' in emittedChanges).toBe(true)
    expect(emittedChanges.source).toBe(frame.source)
    expect(frame.source.fig.rawNodeFields).toEqual({})

    unbind()
  })

  test('TC AS3 does not add extra keys for non-TEXT non-import x updates', () => {
    // Given
    const graph = new SceneGraph()
    const page = graph.addPage('P')
    const frame = graph.createNode('FRAME', page.id, { width: 100 })
    const spy = mock<(id: string, changes: Partial<SceneNode>) => void>()
    const unbind = graph.onNodeEvents({ updated: spy })

    // When
    graph.updateNode(frame.id, { x: 10 })

    // Then
    expect(spy).toHaveBeenCalled()
    const emittedChanges = getLastEmittedChanges(spy)
    expect('textPicture' in emittedChanges).toBe(false)
    expect('figmaDerivedTextGlyphs' in emittedChanges).toBe(false)
    expect('source' in emittedChanges).toBe(false)
    expect(emittedChanges).toEqual({ x: 10 })

    unbind()
  })
})
