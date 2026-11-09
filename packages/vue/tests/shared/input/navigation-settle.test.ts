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

  test('a gesture that starts while settling survives the pending timer', async () => {
    editor = createEditor()
    const settle = createNavigationSettle(editor, 5)

    editor.setNavigationPhase('pan')
    settle.settle()
    editor.setNavigationPhase('pan')

    await Bun.sleep(20)
    expect(editor.state.navigation.phase).toBe('pan')
  })

  test('disposing a settling navigation returns it to idle', async () => {
    editor = createEditor()
    const settle = createNavigationSettle(editor, 5)
    editor.setNavigationPhase('pan')
    settle.settle()

    settle.dispose()

    expect(editor.state.navigation.phase).toBe('idle')
    await Bun.sleep(20)
    expect(editor.state.navigation.phase).toBe('idle')
  })

  test('disposing leaves a newer gesture alone', async () => {
    editor = createEditor()
    const settle = createNavigationSettle(editor, 5)
    editor.setNavigationPhase('pan')
    settle.settle()
    editor.setNavigationPhase('pan')

    settle.dispose()

    expect(editor.state.navigation.phase).toBe('pan')
  })
})
