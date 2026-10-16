import type { Page } from '@playwright/test'

import type { Color } from '@open-pencil/scene-graph/primitives'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test')

const SOURCE = { r: 1, g: 0, b: 0, a: 1 }
const TARGET = { r: 0.2, g: 0.4, b: 0.8, a: 1 }

interface Paint {
  color: Color
}

function selectedId(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return [...store.state.selectedIds][0]
  })
}

async function paint(page: Page, id: string, kind: 'fills' | 'strokes'): Promise<Paint | null> {
  return page.evaluate(
    ([nodeId, key]) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      return store.graph.getNode(nodeId)?.[key].at(-1) ?? null
    },
    [id, kind] as const
  )
}

async function setFill(page: Page, id: string, color: Color) {
  await page.evaluate(
    ([nodeId, value]) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      store.updateNodeWithUndo(nodeId, {
        fills: [{ type: 'SOLID', color: value, opacity: 1, visible: true }]
      })
    },
    [id, color] as const
  )
}

/** A red source rectangle left of a blue target rectangle; the target ends up selected. */
async function sourceAndTarget() {
  const { page, canvas } = editor
  await canvas.drawRect(100, 120, 100, 100)
  await setFill(page, await selectedId(page), SOURCE)
  await canvas.drawRect(300, 120, 100, 100)
  const target = await selectedId(page)
  await setFill(page, target, TARGET)
  return target
}

test('I then a click paints the selection with the sampled color in one undo step', async () => {
  const { page, canvas } = editor
  const target = await sourceAndTarget()

  await canvas.pressKey('i')
  await canvas.click(150, 170)
  await expect.poll(() => paint(page, target, 'fills')).toMatchObject({ color: SOURCE })
  expect(await selectedId(page)).toBe(target)

  await canvas.undo()
  await expect.poll(() => paint(page, target, 'fills')).toMatchObject({ color: TARGET })
})

test('Alt-click samples into the stroke and keeps the fill', async () => {
  const { page, canvas } = editor
  const target = await sourceAndTarget()

  await canvas.pressKey('i')
  await page.keyboard.down('Alt')
  await canvas.click(150, 170)
  await page.keyboard.up('Alt')

  await expect.poll(() => paint(page, target, 'strokes')).toMatchObject({ color: SOURCE })
  expect(await paint(page, target, 'fills')).toMatchObject({ color: TARGET })
})

test('Escape leaves the eyedropper without changing the selection', async () => {
  const { page, canvas } = editor
  const target = await sourceAndTarget()

  await canvas.pressKey('i')
  await canvas.pressKey('Escape')
  // With the Move tool back, the same click selects the source rectangle instead of sampling it.
  await canvas.click(150, 170)
  await expect.poll(() => selectedId(page)).not.toBe(target)
  expect(await paint(page, target, 'fills')).toMatchObject({ color: TARGET })
})

test('I types a letter while editing text', async () => {
  const { page, canvas } = editor
  await canvas.pressKey('t')
  await canvas.click(200, 300)
  await page.keyboard.type('AIB')
  await canvas.pressKey('Escape')

  const text = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getNode([...store.state.selectedIds][0])?.text
  })
  expect(text).toBe('AIB')
})

test('the color picker button samples the canvas and the picker stays open', async () => {
  const { page, canvas } = editor
  const target = await sourceAndTarget()

  await page.getByTestId('fill-picker-swatch').first().click()
  const pick = page.getByRole('button', { name: 'Pick a color from the canvas' })
  await pick.click()
  await canvas.click(150, 170)

  await expect.poll(() => paint(page, target, 'fills')).toMatchObject({ color: SOURCE })
  await expect(pick).toBeVisible()
})
