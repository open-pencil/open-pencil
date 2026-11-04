import { expect, mock, test } from 'bun:test'

import { setActiveEditorStore } from '@/app/editor/active-store'
import { createEditorStore } from '@/app/editor/session/create'
import { createSharedEditorMenuActions } from '@/app/shell/menu/actions/editor'

// The desktop menu reaches the editor through these actions, so View → Variables… needs one here.
test('View → Variables… opens the variables dialog from the native menu as from the app menu', () => {
  const store = createEditorStore()
  setActiveEditorStore(store)
  const actions: Partial<Record<string, () => void>> = createSharedEditorMenuActions(mock())
  expect(store.state.variablesOpen).toBe(false)
  actions.variables?.()
  expect(store.state.variablesOpen).toBe(true)
})
