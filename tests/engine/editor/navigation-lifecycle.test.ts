import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

describe('navigation lifecycle', () => {
  test('increments generation when a new gesture starts but not during one gesture', () => {
    const editor = createEditor()
    const events: Array<{ phase: string; generation: number }> = []
    const off = editor.onEditorEvent('navigation:changed', (navigation) => {
      events.push({ phase: navigation.phase, generation: navigation.generation })
    })

    editor.setNavigationPhase('zoom', 10)
    editor.setNavigationPhase('zoom', 20)
    editor.setNavigationPhase('settling', 20)
    editor.setNavigationPhase('zoom', 30)
    editor.setNavigationPhase('idle', 40)

    expect(events).toEqual([
      { phase: 'zoom', generation: 1 },
      { phase: 'zoom', generation: 1 },
      { phase: 'settling', generation: 1 },
      { phase: 'zoom', generation: 2 },
      { phase: 'idle', generation: 2 }
    ])
    off()
    editor.dispose()
  })
})
