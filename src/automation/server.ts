import { makeFigmaFromStore } from '@/automation/figma-factory'
/**
 * Browser-side automation handler.
 *
 * Connects to the bridge via WebSocket, receives RPC requests,
 * executes them against the live EditorStore, and sends results back.
 */
import {
  ALL_TOOLS,
  AUTOMATION_WS_PORT,
  executeRpcCommand,
  renderTreeNode,
  computeAllLayouts,
  selectionToJSX,
  sceneNodeToJSX,
  randomHex
} from '@open-pencil/core'

import type { EditorStore } from '@/stores/editor'
import type { ExportFormat } from '@open-pencil/core'

export function connectAutomation(getStore: () => EditorStore) {
  const token = randomHex(32)
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined

  function makeFigma() {
    return makeFigmaFromStore(getStore())
  }

  async function handleEval(store: EditorStore, args: unknown): Promise<unknown> {
    const code = (args as { code?: string }).code
    if (!code) throw new Error('Missing "code" in args')
    const figma = makeFigma()
    const AsyncFunction = Object.getPrototypeOf(async function () {
      /* noop */
    }).constructor
    const wrappedCode = code.trim().startsWith('return')
      ? code
      : `return (async () => { ${code} })()`
    const fn = new AsyncFunction('figma', wrappedCode)
    const result = await fn(figma)
    store.requestRender()
    return { ok: true, result: result ?? null }
  }

  async function handleToolRender(
    store: EditorStore,
    toolArgs: Record<string, unknown>
  ): Promise<unknown> {
    const tree = toolArgs.tree as Parameters<typeof renderTreeNode>[1]
    const result = await renderTreeNode(store.graph, tree, {
      parentId: (toolArgs.parent_id as string | undefined) ?? store.state.currentPageId,
      x: toolArgs.x as number | undefined,
      y: toolArgs.y as number | undefined
    })
    computeAllLayouts(store.graph, store.state.currentPageId)
    store.requestRender()
    store.flashNodes([result.id])
    return {
      ok: true,
      result: { id: result.id, name: result.name, type: result.type, children: result.childIds }
    }
  }

  async function handleTool(store: EditorStore, args: unknown): Promise<unknown> {
    const toolName = (args as { name?: string }).name
    const toolArgs = (args as { args?: Record<string, unknown> }).args ?? {}
    if (!toolName) throw new Error('Missing "name" in args')

    if (toolName === 'render' && toolArgs.tree) {
      return handleToolRender(store, toolArgs)
    }

    const def = ALL_TOOLS.find((t) => t.name === toolName)
    if (!def) throw new Error(`Unknown tool: ${toolName}`)
    const figma = makeFigma()
    const result = await def.execute(figma, toolArgs)

    if (figma.currentPageId !== store.state.currentPageId) {
      void store.switchPage(figma.currentPageId)
    }

    if (def.mutates) {
      computeAllLayouts(store.graph, store.state.currentPageId)
      store.requestRender()
      store.flashNodes(extractNodeIds(result))
    }
    return { ok: true, result }
  }

  async function handleExport(store: EditorStore, args: unknown): Promise<unknown> {
    const exportArgs = args as { nodeIds?: string[]; scale?: number; format?: string } | undefined
    const nodeIds = exportArgs?.nodeIds ?? [...store.state.selectedIds]
    if (nodeIds.length === 0) throw new Error('No nodes to export')
    const data = await store.renderExportImage(
      nodeIds,
      exportArgs?.scale ?? 1,
      (exportArgs?.format ?? 'PNG') as ExportFormat
    )
    if (!data) throw new Error('Export failed')
    let binary = ''
    for (const byte of data) binary += String.fromCharCode(byte)
    const base64 = btoa(binary)
    return {
      ok: true,
      result: { base64, mimeType: `image/${(exportArgs?.format ?? 'png').toLowerCase()}` }
    }
  }

  async function handleExportJsx(store: EditorStore, args: unknown): Promise<unknown> {
    const jsxArgs = args as { nodeIds?: string[]; style?: string } | undefined
    const style = (jsxArgs?.style ?? 'openpencil') as 'openpencil' | 'tailwind'
    const currentPage = store.graph.getNode(store.state.currentPageId)
    const nodeIds = jsxArgs?.nodeIds ?? currentPage?.childIds ?? []
    const jsx =
      nodeIds.length === 1
        ? sceneNodeToJSX(nodeIds[0], store.graph, style)
        : selectionToJSX(nodeIds, store.graph, style)
    return { ok: true, result: { jsx } }
  }

  const commandHandlers: Partial<
    Record<string, (store: EditorStore, args: unknown) => Promise<unknown>>
  > = {
    eval: handleEval,
    tool: handleTool,
    export: handleExport,
    export_jsx: handleExportJsx
  }

  async function handleRequest(_id: string, command: string, args: unknown): Promise<unknown> {
    const store = getStore()
    const handler = commandHandlers[command]
    if (handler) return handler(store, args)
    const result = executeRpcCommand(store.graph, command, args ?? {})
    return { ok: true, result }
  }

  function connect() {
    try {
      ws = new WebSocket(`ws://127.0.0.1:${AUTOMATION_WS_PORT}`)
    } catch {
      scheduleReconnect()
      return
    }

    ws.onopen = () => {
      ws?.send(JSON.stringify({ type: 'register', token }))
    }

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data) as {
          type: string
          id: string
          command: string
          args?: unknown
        }
        if (msg.type !== 'request' || !msg.id) return
        try {
          const result = await handleRequest(msg.id, msg.command, msg.args)
          ws?.send(JSON.stringify({ type: 'response', id: msg.id, ...(result as object) }))
        } catch (e) {
          ws?.send(
            JSON.stringify({
              type: 'response',
              id: msg.id,
              ok: false,
              error: e instanceof Error ? e.message : String(e)
            })
          )
        }
      } catch (e) {
        console.warn('Failed to parse WebSocket message:', e)
      }
    }

    ws.onclose = () => {
      ws = null
      scheduleReconnect()
    }

    ws.onerror = () => {
      ws?.close()
    }
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(connect, 2000)
  }

  function disconnect() {
    clearTimeout(reconnectTimer)
    ws?.close()
    ws = null
  }

  connect()
  return { disconnect, token }
}

function extractNodeIds(result: unknown): string[] {
  if (!result || typeof result !== 'object') return []
  const obj = result as Record<string, unknown>
  if (typeof obj.deleted === 'string') return []
  const ids: string[] = []
  if (typeof obj.id === 'string') ids.push(obj.id)
  if (Array.isArray(obj.results)) {
    for (const item of obj.results) {
      if (
        item &&
        typeof item === 'object' &&
        typeof (item as Record<string, unknown>).id === 'string'
      )
        ids.push((item as Record<string, unknown>).id as string)
    }
  }
  return ids
}
