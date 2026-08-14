import { afterEach, describe, expect, test, vi } from 'bun:test'

import { createRenderer, defineComponent, h, type ComponentPublicInstance } from 'vue'

import {
  useDocumentWorkspace,
  type DocumentWorkspaceItem,
  type DocumentWorkspaceSource
} from '@open-pencil/vue'

type HostNode = {
  children: HostNode[]
  parent: HostNode | null
  text: string
}

type Deferred<Value> = {
  promise: Promise<Value>
  resolve(value: Value): void
}

function deferred<Value>(): Deferred<Value> {
  let resolvePromise: ((value: Value) => void) | null = null
  const promise = new Promise<Value>((resolve) => {
    resolvePromise = resolve
  })
  return {
    promise,
    resolve(value) {
      resolvePromise?.(value)
    }
  }
}

function hostNode(text = ''): HostNode {
  return { children: [], parent: null, text }
}

const renderer = createRenderer<HostNode, HostNode>({
  patchProp() {
    return undefined
  },
  insert(child, parent, anchor) {
    child.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    if (index < 0) parent.children.push(child)
    else parent.children.splice(index, 0, child)
  },
  remove(child) {
    const parent = child.parent
    if (!parent) return
    const index = parent.children.indexOf(child)
    if (index !== -1) parent.children.splice(index, 1)
    child.parent = null
  },
  createElement() {
    return hostNode()
  },
  createText: hostNode,
  createComment: hostNode,
  setText(node, text) {
    node.text = text
  },
  setElementText(node, text) {
    node.text = text
  },
  parentNode(node) {
    return node.parent
  },
  nextSibling(node) {
    const parent = node.parent
    if (!parent) return null
    return parent.children[parent.children.indexOf(node) + 1] ?? null
  },
  querySelector() {
    return null
  },
  setScopeId() {
    return undefined
  },
  insertStaticContent(content, parent, anchor) {
    const node = hostNode(content)
    this.insert(node, parent, anchor)
    return [node, node]
  }
})

type Workspace = ReturnType<typeof useDocumentWorkspace<DocumentWorkspaceItem>>

type WorkspaceHolder = { current: Workspace | null }

async function flushTasks(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
}

function mountWorkspace(
  source: DocumentWorkspaceSource<DocumentWorkspaceItem>,
  options: { previewConcurrency?: number } = {}
): { workspace: Workspace; unmount(): void } {
  const holder: WorkspaceHolder = { current: null }
  const component = defineComponent({
    setup() {
      holder.current = useDocumentWorkspace({
        source,
        previewConcurrency: options.previewConcurrency,
        refreshOnFocus: false,
        refreshOnReconnect: false
      })
      return () => h('div')
    }
  })
  const app = renderer.createApp(component)
  app.mount(hostNode()) as ComponentPublicInstance
  const workspace = holder.current
  if (workspace == null) throw new Error('Workspace composable did not initialize')
  return { workspace, unmount: () => app.unmount() }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useDocumentWorkspace', () => {
  test('shares an in-flight refresh and responds to source events', async () => {
    const firstRefresh = deferred<DocumentWorkspaceItem[]>()
    let sourceListener: (() => void) | null = null
    const refresh = vi
      .fn<() => Promise<DocumentWorkspaceItem[]>>()
      .mockImplementationOnce(() => firstRefresh.promise)
      .mockResolvedValueOnce([{ id: 'second', name: 'Second', updatedAt: '2026-08-10' }])
    const mounted = mountWorkspace({
      refresh,
      loadPreview: async () => null,
      subscribe(listener) {
        sourceListener = listener
        return () => {
          sourceListener = null
        }
      }
    })

    const inFlightA = mounted.workspace.refresh()
    const inFlightB = mounted.workspace.refresh()
    expect(inFlightA).toBe(inFlightB)
    expect(refresh).toHaveBeenCalledTimes(1)

    sourceListener?.()
    sourceListener?.()
    firstRefresh.resolve([{ id: 'first', name: 'First', updatedAt: '2026-08-09' }])
    await inFlightA
    await flushTasks()
    expect(refresh).toHaveBeenCalledTimes(2)
    expect(mounted.workspace.documents.value.map(({ id }) => id)).toEqual(['second'])

    mounted.unmount()
    expect(sourceListener).toBeNull()
  })

  test('invalidates an in-flight preview when the document changes', async () => {
    const previewLoad = deferred<Uint8Array | null>()
    const freshPreviewLoad = deferred<Uint8Array | null>()
    const refresh = vi
      .fn<() => Promise<DocumentWorkspaceItem[]>>()
      .mockResolvedValueOnce([{ id: 'one', name: 'One', updatedAt: 'first' }])
      .mockResolvedValueOnce([{ id: 'one', name: 'One', updatedAt: 'second' }])
    const loadPreview = vi
      .fn<() => Promise<Uint8Array | null>>()
      .mockImplementationOnce(() => previewLoad.promise)
      .mockImplementationOnce(() => freshPreviewLoad.promise)
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
    const mounted = mountWorkspace({ refresh, loadPreview })
    await flushTasks()

    mounted.workspace.loadPreview('one')
    expect(loadPreview).toHaveBeenCalledTimes(1)
    await mounted.workspace.refresh()
    previewLoad.resolve(new Uint8Array([1]))
    await previewLoad.promise
    await flushTasks()

    expect(createObjectURL).not.toHaveBeenCalled()
    expect(loadPreview).toHaveBeenCalledTimes(2)
    freshPreviewLoad.resolve(new Uint8Array([2]))
    await freshPreviewLoad.promise
    await flushTasks()
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    mounted.unmount()
  })

  test('surfaces preview failures to consumers', async () => {
    const failure = new Error('preview failed')
    const onPreviewError = vi.fn()
    const holder: WorkspaceHolder = { current: null }
    const component = defineComponent({
      setup() {
        holder.current = useDocumentWorkspace({
          source: {
            refresh: async () => [],
            loadPreview: async () => {
              throw failure
            }
          },
          refreshOnFocus: false,
          refreshOnReconnect: false,
          onPreviewError
        })
        return () => h('div')
      }
    })
    const app = renderer.createApp(component)
    app.mount(hostNode())
    holder.current?.loadPreview('one')
    await flushTasks()

    expect(holder.current?.previewErrors.value.one).toBe(failure)
    expect(onPreviewError).toHaveBeenCalledWith('one', failure)
    app.unmount()
  })

  test('deduplicates previews, limits concurrency, and revokes URLs on unmount', async () => {
    const loads = new Map<string, Deferred<Uint8Array | null>>()
    const loadPreview = vi.fn((id: string) => {
      const load = deferred<Uint8Array | null>()
      loads.set(id, load)
      return load.promise
    })
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const mounted = mountWorkspace(
      { refresh: async () => [], loadPreview },
      { previewConcurrency: 2 }
    )

    mounted.workspace.loadPreview('one')
    mounted.workspace.loadPreview('one')
    mounted.workspace.loadPreview('two')
    mounted.workspace.loadPreview('three')
    expect(loadPreview.mock.calls.map((call) => call[0])).toEqual(['one', 'two'])

    loads.get('one')?.resolve(new Uint8Array([1]))
    await loads.get('one')?.promise
    await flushTasks()
    expect(loadPreview.mock.calls.map((call) => call[0])).toEqual(['one', 'two', 'three'])
    expect(createObjectURL).toHaveBeenCalledTimes(1)

    mounted.unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview')

    loads.get('two')?.resolve(new Uint8Array([2]))
    loads.get('three')?.resolve(new Uint8Array([3]))
    await Promise.all([loads.get('two')?.promise, loads.get('three')?.promise])
    await flushTasks()
    expect(createObjectURL).toHaveBeenCalledTimes(1)
  })
})
