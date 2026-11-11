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

  test('a pending settle from one controller cannot end another controller settle', async () => {
    editor = createEditor()
    const wheel = createNavigationSettle(editor, 5)
    const pan = createNavigationSettle(editor, 30)

    editor.setNavigationPhase('pan')
    wheel.settle()
    editor.setNavigationPhase('pan')
    pan.settle()

    await Bun.sleep(12)
    expect(editor.state.navigation.phase).toBe('settling')

    await Bun.sleep(30)
    expect(editor.state.navigation.phase).toBe('idle')
  })

  test('disposing an older controller leaves a newer settle alone', async () => {
    editor = createEditor()
    const older = createNavigationSettle(editor, 5)
    const newer = createNavigationSettle(editor, 30)

    editor.setNavigationPhase('pan')
    older.settle()
    editor.setNavigationPhase('pan')
    newer.settle()
    older.dispose()

    expect(editor.state.navigation.phase).toBe('settling')
    await Bun.sleep(40)
    expect(editor.state.navigation.phase).toBe('idle')
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
