import fs from 'node:fs'
import path from 'node:path'

import type { Page } from '@playwright/test'

import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

type PerfBucketStat = {
  name: string
  track: string
  count: number
  totalMs: number
  avgMs: number
  p50Ms: number
  p95Ms: number
  maxMs: number
}

type PerfSummary = {
  totalEntries: number
  totalMs: number
  stats: PerfBucketStat[]
}

type PencilPerf = {
  enable: () => void
  disable: () => void
  clear: () => void
  summary: () => PerfSummary
}

declare global {
  interface Window {
    __pencilPerf?: PencilPerf
  }
}

const OUT_DIR = path.resolve(process.cwd(), '.context/scratch/perf-trace')

function writeSnapshot(label: string, payload: unknown) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(path.join(OUT_DIR, `${label}.json`), JSON.stringify(payload, null, 2))
}

async function seedNodes(page: Page, count: number) {
  await page.evaluate((n) => {
    const store = window.inkly?.getStore?.()
    if (!store) throw new Error('Inkly store missing')
    const graph = store.graph
    const pageId = store.state.currentPageId
    if (!pageId) throw new Error('currentPageId missing')
    const cols = Math.ceil(Math.sqrt(n))
    const cellW = 30
    const cellH = 30
    for (let i = 0; i < n; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      graph.createNode('RECT', pageId, {
        x: 20 + col * cellW,
        y: 20 + row * cellH,
        width: cellW - 4,
        height: cellH - 4
      })
    }
    store.requestRender()
  }, count)
}

async function pickFirstNode(page: Page) {
  return await page.evaluate(() => {
    const store = window.inkly?.getStore?.()
    if (!store) throw new Error('Inkly store missing')
    const currentPageId = store.state.currentPageId
    if (!currentPageId) throw new Error('currentPageId missing')
    const pageNode = store.graph.getNode(currentPageId)
    const firstChild = pageNode?.childIds[0]
    if (!firstChild) throw new Error('no node')
    const node = store.graph.getNode(firstChild)
    if (!node) throw new Error('no node')
    const abs = store.graph.getAbsolutePosition(firstChild)
    // oxlint-disable-next-line inkly/no-direct-selection-tool-state-mutation
    store.state.selectedIds = new Set([firstChild])
    store.requestRender()
    return { id: firstChild, x: abs.x + node.width / 2, y: abs.y + node.height / 2 }
  })
}

const editor = useEditorSetup()

test.describe('perf-trace large-doc', () => {
  for (const nodeCount of [100, 500, 1000, 2000]) {
    test(`drag を ${nodeCount} node ドキュメントで計測`, async () => {
      test.setTimeout(300_000)

      await editor.page.evaluate(() => {
        window.__pencilPerf?.enable()
        window.__pencilPerf?.clear()
      })

      await editor.canvas.clearCanvas()
      await seedNodes(editor.page, nodeCount)
      await editor.canvas.waitForRender()

      const target = await pickFirstNode(editor.page)

      await editor.page.evaluate(() => window.__pencilPerf?.clear())

      const startX = target.x
      const startY = target.y
      for (let i = 1; i <= 6; i++) {
        const toX = startX + i * 24
        const toY = startY + Math.round(Math.sin(i / 2) * 18)
        await editor.canvas.drag(startX + (i - 1) * 24, startY, toX, toY, 24)
        await editor.canvas.waitForRender()
      }

      const summary = await editor.page.evaluate(() => window.__pencilPerf?.summary())
      writeSnapshot(`large-doc-${nodeCount}`, {
        nodeCount,
        summary
      })

      expect(summary?.totalEntries ?? 0).toBeGreaterThan(0)
      const frame = summary?.stats.find((s) => s.name === 'frame')
      expect(frame?.maxMs ?? 0).toBeLessThan(60)

      editor.canvas.assertNoErrors()
    })
  }
})
