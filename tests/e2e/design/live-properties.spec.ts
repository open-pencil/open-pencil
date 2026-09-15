import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'

const editor = useEditorSetupWithClear('/?test')

test.beforeEach(async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const id = store.createShape('FRAME', 100, 100, 320, 120)
    store.select([id])
  })
  await expect(
    editor.page.getByRole('spinbutton', { name: 'X Axis', exact: true })
  ).toHaveAttribute('aria-valuenow', '100')
})

test('position fields follow movement before the pointer is released', async () => {
  const box = expectDefined(await editor.canvas.canvas.boundingBox(), 'canvas bounds')
  await editor.page.mouse.move(box.x + 250, box.y + 160)
  await editor.page.mouse.down()
  try {
    await editor.page.mouse.move(box.x + 330, box.y + 195, { steps: 4 })
    await expect(
      editor.page.getByRole('spinbutton', { name: 'X Axis', exact: true })
    ).toHaveAttribute('aria-valuenow', '180')
    await expect(
      editor.page.getByRole('spinbutton', { name: 'Y Axis', exact: true })
    ).toHaveAttribute('aria-valuenow', '135')
    const selected = await editor.page.evaluate(() => {
      const node = window.openPencil?.getStore?.().selectedNode.value
      return node ? { x: node.x, y: node.y } : null
    })
    expect(selected).toEqual({ x: 180, y: 135 })
    const reads = await editor.page.evaluateHandle(() => {
      const graph = window.openPencil?.getStore?.().graph
      if (!graph) throw new Error('Editor unavailable')
      const original = graph.getAllNodes
      let count = 0
      graph.getAllNodes = () => {
        count++
        return original.call(graph)
      }
      return {
        count: () => count,
        restore: () => {
          graph.getAllNodes = original
        }
      }
    })
    try {
      await editor.page.mouse.move(box.x + 350, box.y + 205)
      await expect(
        editor.page.getByRole('spinbutton', { name: 'X Axis', exact: true })
      ).toHaveAttribute('aria-valuenow', '200')
      await expect(
        editor.page.getByRole('spinbutton', { name: 'Y Axis', exact: true })
      ).toHaveAttribute('aria-valuenow', '145')
      expect(await reads.evaluate((probe) => probe.count())).toBe(0)
    } finally {
      try {
        await reads.evaluate((probe) => probe.restore())
      } finally {
        await reads.dispose()
      }
    }
  } finally {
    await editor.page.mouse.up()
  }
})

for (const field of [
  { name: 'X Axis', property: 'x', initial: 100 },
  { name: 'Width', property: 'width', initial: 320 }
] as const) {
  test(`${field.name} scrubbing stays a live preview until release`, async () => {
    const input = editor.page.getByRole('spinbutton', { name: field.name, exact: true })
    const box = expectDefined(await input.boundingBox(), 'field bounds')
    const version = await editor.page.evaluate(
      () => window.openPencil?.getStore?.().state.sceneVersion
    )
    await editor.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await editor.page.mouse.down()
    try {
      await editor.page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2, { steps: 4 })
      await expect(input).toHaveAttribute('aria-valuenow', String(field.initial + 20))
      expect(
        await editor.page.evaluate(() => window.openPencil?.getStore?.().state.sceneVersion)
      ).toBe(version)
    } finally {
      await editor.page.mouse.up()
    }
    await editor.page.evaluate(() => window.openPencil?.getStore?.().undoAction())
    await expect(input).toHaveAttribute('aria-valuenow', String(field.initial))
  })
}

test('size fields follow resizing before the pointer is released', async () => {
  const box = expectDefined(await editor.canvas.canvas.boundingBox(), 'canvas bounds')
  await editor.page.mouse.move(box.x + 420, box.y + 220)
  await editor.page.mouse.down()
  try {
    await editor.page.mouse.move(box.x + 480, box.y + 260, { steps: 4 })
    await expect(
      editor.page.getByRole('spinbutton', { name: 'Width', exact: true })
    ).toHaveAttribute('aria-valuenow', '380')
    await expect(
      editor.page.getByRole('spinbutton', { name: 'Height', exact: true })
    ).toHaveAttribute('aria-valuenow', '160')
    await editor.page.mouse.move(box.x + 500, box.y + 270)
    await expect(
      editor.page.getByRole('spinbutton', { name: 'Width', exact: true })
    ).toHaveAttribute('aria-valuenow', '400')
    await expect(
      editor.page.getByRole('spinbutton', { name: 'Height', exact: true })
    ).toHaveAttribute('aria-valuenow', '170')
  } finally {
    await editor.page.mouse.up()
  }
})
