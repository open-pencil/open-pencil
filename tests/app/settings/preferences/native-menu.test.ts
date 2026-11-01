import { afterEach, expect, test } from 'bun:test'

import { nextTick, shallowReactive, shallowRef } from 'vue'

import { followNativeCanvasViewMenu } from '@/app/settings/preferences/native-menu'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

afterEach(clearTauriMocks)

/** Lets a change reach the watcher and its chained native calls finish. */
async function settle() {
  await nextTick()
  await new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

function documentShowing(showRulers: boolean, showPixelGrid?: boolean) {
  return { state: shallowReactive({ showRulers, showPixelGrid }) }
}

test('the native Rulers and Pixel Grid items follow the active document', async () => {
  const checked = new Map<string, boolean>()
  await mockTauriIPC((command, args) => {
    expect(command).toBe('set_native_menu_checked')
    const { id, checked: value } = args as { id: string; checked: boolean }
    checked.set(id, value)
  })
  const first = documentShowing(true)
  const active = shallowRef<ReturnType<typeof documentShowing> | undefined>(first)
  const stop = followNativeCanvasViewMenu(active)
  await settle()
  expect(Object.fromEntries(checked)).toEqual({ 'view-rulers': true, 'view-pixel-grid': true })

  // A key or the zoom menu toggles the document's state, not the native item.
  first.state.showRulers = false
  first.state.showPixelGrid = false
  await settle()
  expect(Object.fromEntries(checked)).toEqual({ 'view-rulers': false, 'view-pixel-grid': false })

  active.value = documentShowing(true, true)
  await settle()
  expect(Object.fromEntries(checked)).toEqual({ 'view-rulers': true, 'view-pixel-grid': true })
  stop()
})

test('the native items end on the latest state however their calls are answered', async () => {
  const checked = new Map<string, boolean>()
  const answers: (() => void)[] = []
  await mockTauriIPC((_command, args) => {
    const { id, checked: value } = args as { id: string; checked: boolean }
    // Every call waits until the test answers it, so the first sync is still running below.
    return new Promise<void>((resolve) => {
      answers.push(() => {
        checked.set(id, value)
        resolve()
      })
    })
  })
  const shown = documentShowing(true, true)
  const stop = followNativeCanvasViewMenu(shallowRef(shown))
  await nextTick()
  shown.state.showRulers = false
  await nextTick()
  // The second sync waits for the first, so only the first pair has been sent.
  expect(answers).toHaveLength(2)

  // Answering the calls in reverse order still cannot leave the earlier value behind.
  while (answers.length > 0) {
    answers.pop()?.()
    await settle()
  }
  expect(Object.fromEntries(checked)).toEqual({ 'view-rulers': false, 'view-pixel-grid': true })
  stop()
})
