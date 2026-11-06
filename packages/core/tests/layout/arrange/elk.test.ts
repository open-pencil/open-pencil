import { describe, expect, test } from 'bun:test'

import { createElkLayout } from '#core/layout/arrange/elk'

const graph = { id: 'root', children: [{ id: 'a', width: 40, height: 20 }] }

describe('ELK layout', () => {
  test('rejects a layout when its worker fails, and starts another worker for the next', async () => {
    let started = 0
    const layout = createElkLayout(() => {
      started++
      return new Worker(new URL('./missing-worker.js', import.meta.url), { type: 'module' })
    })

    await expect(layout(graph)).rejects.toThrow("ELK's worker failed")
    await expect(layout(graph)).rejects.toThrow("ELK's worker failed")
    expect(started).toBe(2)
  })
})
