import { afterEach, expect, test } from 'bun:test'

import { nextTick, shallowReactive, shallowRef } from 'vue'

import { followNativeCanvasViewMenu } from '@/app/settings/preferences/native-menu'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

afterEach(clearTauriMocks)

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
  await nextTick()
  expect(Object.fromEntries(checked)).toEqual({ 'view-rulers': true, 'view-pixel-grid': true })

  // A key or the zoom menu toggles the document's state, not the native item.
  first.state.showRulers = false
  first.state.showPixelGrid = false
  await nextTick()
  expect(Object.fromEntries(checked)).toEqual({ 'view-rulers': false, 'view-pixel-grid': false })

  active.value = documentShowing(true, true)
  await nextTick()
  expect(Object.fromEntries(checked)).toEqual({ 'view-rulers': true, 'view-pixel-grid': true })
  stop()
})
