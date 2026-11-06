import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'

import { createNavigationSettle } from '#vue/shared/input/navigation-settle'

let editor: Editor

afterEach(() => editor.dispose())

describe('navigation settle', () => {
  test('settles to idle after the delay', async () => {
    editor = createEditor()
    const settle = createNavigationSettle(editor, 5)

    editor.setNavigationPhase('pan')
    settle.settle()
    expect(editor.state.navigation.phase).toBe('settling')

    await Bun.sleep(20)
    expect(editor.state.navigation.phase).toBe('idle')
  })

  test('a new gesture keeps the phase it started', async () => {
    editor = createEditor()
    const settle = createNavigationSettle(editor, 5)

    editor.setNavigationPhase('pan')
    settle.settle()
    settle.cancel()
    editor.setNavigationPhase('pan')

    await Bun.sleep(20)
    expect(editor.state.navigation.phase).toBe('pan')
  })
})
