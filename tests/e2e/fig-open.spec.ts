import { test, expect } from '@playwright/test'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import { CanvasHelper } from '../helpers/canvas'
import { initCodec, SceneGraph, exportFigFile } from '@open-pencil/core'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = resolve(__dirname, '../fixtures')

let minimalFigBase64: string

test.describe('Open .fig file', () => {
  test.slow()
  test.setTimeout(90_000)
  let helper: CanvasHelper

  test.beforeAll(async ({ browser }) => {
    await initCodec()
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    graph.createNode('RECTANGLE', page.id, {
      name: 'Test Rect',
      x: 50,
      y: 50,
      width: 100,
      height: 80,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.6, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    const bytes = await exportFigFile(graph)
    minimalFigBase64 = Buffer.from(bytes).toString('base64')

    const pwPage = await browser.newPage()
    helper = new CanvasHelper(pwPage)
    await pwPage.goto('http://localhost:1420/?test&no-chrome')
    await helper.waitForInit()
  })

  test.afterAll(async () => {
    await helper.page.close()
  })

  test('opens minimal .fig and renders', async () => {
    const result = await helper.page.evaluate(
      async (b64: string) => {
        const binary = atob(b64)
        const arr = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
        const file = new File([arr], 'minimal.fig', { type: 'application/octet-stream' })
        const store = window.__OPEN_PENCIL_STORE__!
        await store.openFigFile(file)
        return {
          nodeCount: store.graph.nodes.size,
          pageCount: store.graph.getPages().length,
          documentName: store.state.documentName,
          loading: store.state.loading
        }
      },
      minimalFigBase64
    )

    expect(result.loading).toBe(false)
    expect(result.documentName).toBe('minimal')
    expect(result.pageCount).toBeGreaterThan(0)
    expect(result.nodeCount).toBeGreaterThan(0)
  })

  test.skip('opens gold-preview.fig (regression: parse + render)', async () => {
    test.setTimeout(90_000)
    const buf = readFileSync(resolve(FIXTURES, 'gold-preview.fig'))
    const base64 = Buffer.from(buf).toString('base64')

    const result = await helper.page.evaluate(async (b64: string) => {
      const binary = atob(b64)
      const arr = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
      const file = new File([arr], 'gold-preview.fig', { type: 'application/octet-stream' })
      const store = window.__OPEN_PENCIL_STORE__!
      await store.openFigFile(file)
      return {
        nodeCount: store.graph.nodes.size,
        documentName: store.state.documentName,
        loading: store.state.loading
      }
    }, base64)

    expect(result.loading).toBe(false)
    expect(result.documentName).toBe('gold-preview')
    expect(result.nodeCount).toBeGreaterThan(1000)
  })
})
