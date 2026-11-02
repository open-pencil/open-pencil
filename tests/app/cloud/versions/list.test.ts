import 'fake-indexeddb/auto'
import { describe, expect, test } from 'bun:test'

import { closeVersionHistory, openVersionHistory } from '@/app/cloud/versions/history'
import { useVersionList } from '@/app/cloud/versions/list'
import { createEditorStore } from '@/app/editor/session/create'

describe('version list', () => {
  test('lasts while the history is open, so a remounted panel keeps its place', () => {
    const store = createEditorStore()
    openVersionHistory(store)
    const list = useVersionList(store)
    list.onlyYours.value = true
    list.scrollTop.value = 240
    expect(useVersionList(store)).toBe(list)

    closeVersionHistory(store)
    openVersionHistory(store)
    const reopened = useVersionList(store)
    expect(reopened).not.toBe(list)
    expect(reopened.onlyYours.value).toBe(false)
    expect(reopened.scrollTop.value).toBe(0)
    closeVersionHistory(store)
  })
})
