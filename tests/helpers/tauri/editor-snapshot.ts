export type NativeLayerFixture = {
  first: string
  second: string
  third: string
}

export async function createNativeLayerFixture(): Promise<NativeLayerFixture> {
  return browser.execute(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil editor is not ready')
    const pageId = store.state.currentPageId
    for (const node of store.graph.getChildren(pageId)) store.graph.deleteNode(node.id)
    const first = store.graph.createNode('RECTANGLE', pageId, { name: 'Native Layer A' })
    const second = store.graph.createNode('RECTANGLE', pageId, { name: 'Native Layer B' })
    const third = store.graph.createNode('RECTANGLE', pageId, { name: 'Native Layer C' })
    store.requestRender()
    return { first: first.id, second: second.id, third: third.id }
  })
}

export async function readNativeLayerOrder(parentId?: string): Promise<string[]> {
  return browser.execute((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil editor is not ready')
    return store.graph.getNode(id ?? store.state.currentPageId)?.childIds ?? []
  }, parentId)
}

export type NativeEditorSnapshot = {
  editingTextId: string | null
  selectedIds: string[]
  renderVersion: number
  sceneVersion: number
  editingText: string | null
  editingNodeExists: boolean
  textNodeCount: number
}

export async function readNativeEditorSnapshot(): Promise<NativeEditorSnapshot> {
  return browser.execute(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil editor is not ready')
    const editingTextId = store.state.editingTextId
    const node = editingTextId ? store.graph.getNode(editingTextId) : null
    let textNodeCount = 0
    for (const pageNode of store.graph.getChildren(store.state.currentPageId)) {
      if (pageNode.type === 'TEXT') textNodeCount++
    }
    return {
      editingTextId,
      selectedIds: [...store.state.selectedIds],
      renderVersion: store.state.renderVersion,
      sceneVersion: store.state.sceneVersion,
      editingText: node?.type === 'TEXT' ? (node.text ?? '') : null,
      editingNodeExists: editingTextId !== null && node !== undefined,
      textNodeCount
    }
  })
}

export async function createNativeTextFixture(text = ''): Promise<string> {
  return browser.execute((initialText) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil editor is not ready')
    for (const node of store.graph.getChildren(store.state.currentPageId)) {
      store.graph.deleteNode(node.id)
    }
    const id = store.createShape('TEXT', 120, 120, 320, 60)
    store.graph.updateNode(id, {
      text: initialText,
      fontSize: 32,
      fontFamily: 'Inter',
      textAutoResize: 'WIDTH_AND_HEIGHT',
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })
    store.select([id])
    store.startTextEditing(id)
    store.textEditor?.selectAll()
    store.requestRender()
    return id
  }, text)
}
