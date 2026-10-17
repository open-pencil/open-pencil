import { afterEach, describe, expect, test, vi } from 'bun:test'

import { defineComponent, h } from 'vue'

import { useDocumentWorkspace, type DocumentWorkspaceItem } from '@open-pencil/vue'

import { createTestRenderer, hostNode } from '#tests/helpers/vue/renderer'

const renderer = createTestRenderer()

async function flushTasks(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('storage design list refresh', () => {
  test('keeps the list, error, and old preview on screen while reloading', async () => {
    let urlCount = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:preview-${++urlCount}`)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    let updatedAt = '2026-10-01'
    let failNext = false
    const pending: { release: (() => void) | null } = { release: null }
    const held: { release: (() => void) | null } = { release: null }
    let holdNext = false
    const holder: {
      workspace: ReturnType<typeof useDocumentWorkspace<DocumentWorkspaceItem>> | null
    } = { workspace: null }
    const app = renderer.createApp(
      defineComponent({
        setup() {
          holder.workspace = useDocumentWorkspace<DocumentWorkspaceItem>({
            source: {
              async refresh() {
                if (holdNext) {
                  holdNext = false
                  await new Promise<void>((resolve) => {
                    held.release = resolve
                  })
                }
                if (failNext) throw new Error('offline')
                return [{ id: 'design', name: 'Design', updatedAt }]
              },
              loadPreview: (id) =>
                urlCount === 0
                  ? Promise.resolve(new Uint8Array([1]))
                  : new Promise((resolve) => {
                      pending.release = () => resolve(new Uint8Array([id.length]))
                    })
            },
            refreshOnFocus: false,
            refreshOnReconnect: false
          })
          return () => h('div')
        }
      })
    )
    app.mount(hostNode())
    const current = holder.workspace
    if (!current) throw new Error('Workspace did not initialize')
    await flushTasks()
    current.loadPreview('design')
    await flushTasks()
    expect(current.previewURL('design')).toBe('blob:preview-1')

    updatedAt = '2026-10-02'
    await current.refresh()
    expect(current.documents.value).toHaveLength(1)
    expect(current.previewURL('design')).toBe('blob:preview-1')
    pending.release?.()
    await flushTasks()
    expect(current.previewURL('design')).toBe('blob:preview-2')

    failNext = true
    await current.refresh()
    expect(current.error.value).toBeInstanceOf(Error)
    failNext = false
    holdNext = true
    const refreshing = current.refresh()
    await flushTasks()
    expect(held.release).not.toBeNull()
    expect(current.error.value).toBeInstanceOf(Error)
    expect(current.documents.value).toHaveLength(1)
    held.release?.()
    await refreshing
    expect(current.documents.value).toHaveLength(1)
    app.unmount()
  })
})
