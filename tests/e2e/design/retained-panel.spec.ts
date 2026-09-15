import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'

const editor = useEditorSetupWithClear('/?test')

const width = () => editor.page.getByRole('spinbutton', { name: 'Width', exact: true })

async function setTool(tool: 'FRAME' | 'SELECT') {
  await editor.page.evaluate((tool) => window.openPencil?.getStore?.().setTool(tool), tool)
}

test.beforeEach(async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const id = store.createShape('FRAME', 100, 100, 320, 120)
    store.select([id])
  })
  await expect(width()).toHaveAttribute('aria-valuenow', '320')
})

test('reuses one panel without updating its detached fields', async () => {
  const probe = await width().evaluateHandle((element) => {
    let mutations = 0
    const observer = new MutationObserver((records) => {
      mutations += records.length
    })
    observer.observe(element, { attributes: true, childList: true, subtree: true })
    return {
      element,
      mutations: () => mutations,
      reset: () => {
        observer.takeRecords()
        mutations = 0
      },
      stop: () => observer.disconnect()
    }
  })
  try {
    await setTool('FRAME')
    await expect(width()).toHaveCount(0)
    await editor.page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve())
        })
    )
    await probe.evaluate((probe) => probe.reset())
    await editor.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      const node = store?.selectedNode.value
      if (!store || !node) throw new Error('Selected frame unavailable')
      for (let width = 321; width <= 380; width++) store.graph.updateNodePreview(node.id, { width })
    })
    expect(
      await probe.evaluate((probe) => ({
        connected: probe.element.isConnected,
        value: probe.element.getAttribute('aria-valuenow'),
        mutations: probe.mutations()
      }))
    ).toEqual({ connected: false, value: '320', mutations: 0 })

    for (let repeat = 0; repeat < 3; repeat++) {
      await setTool('SELECT')
      await expect(width()).toHaveAttribute('aria-valuenow', '380')
      expect(await width().evaluate((element, probe) => element === probe.element, probe)).toBe(
        true
      )
      if (repeat < 2) await setTool('FRAME')
    }
  } finally {
    await probe.evaluate((probe) => probe.stop())
    await probe.dispose()
  }
})

test('reuses the panel for a newly drawn frame', async () => {
  const original = await width().evaluateHandle((element) => element)
  try {
    const box = expectDefined(await editor.canvas.canvas.boundingBox(), 'canvas')
    await setTool('FRAME')
    await editor.page.mouse.move(box.x + 500, box.y + 350)
    await editor.page.mouse.down()
    await editor.page.mouse.move(box.x + 620, box.y + 430, { steps: 6 })
    await editor.page.mouse.up()
    await expect(width()).toHaveAttribute('aria-valuenow', '120')
    expect(await width().evaluate((element, original) => element === original, original)).toBe(true)
  } finally {
    await editor.page.mouse.up()
    await original.dispose()
  }
})

test('discards an unfinished text edit and restores normal editing on activation', async () => {
  await width().dblclick()
  await editor.page.keyboard.press('ControlOrMeta+A')
  await editor.page.keyboard.type('999')
  await setTool('FRAME')
  await expect(width()).toHaveCount(0)
  await setTool('SELECT')
  await expect(width()).toHaveAttribute('aria-valuenow', '320')
  await width().dblclick()
  await editor.page.keyboard.press('ControlOrMeta+A')
  await editor.page.keyboard.type('400')
  await editor.page.keyboard.press('Enter')
  await expect(width()).toHaveAttribute('aria-valuenow', '400')
  const url = editor.page.url()
  await editor.page.keyboard.press('Backspace')
  await expect(editor.page).toHaveURL(url)
  await expect(width()).toHaveCount(0)
})

test('restores a bound width when a live text edit is deactivated', async () => {
  const variableId = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    const node = store?.selectedNode.value
    if (!store || !node) throw new Error('Selected frame unavailable')
    const collection = store.graph.createCollection('Retention')
    const variable = store.graph.createVariable('Width/shared', 'FLOAT', collection.id, 320)
    store.bindVariable(node.id, 'width', variable.id)
    return variable.id
  })
  await width().dblclick()
  await editor.page.keyboard.press('ControlOrMeta+A')
  await editor.page.keyboard.type('999')
  await setTool('FRAME')
  await expect(width()).toHaveCount(0)
  await setTool('SELECT')
  await expect(width()).toHaveAttribute('aria-valuenow', '320')
  expect(
    await editor.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      return {
        binding: store?.selectedNode.value?.boundVariables.width,
        interactive: store?.isInteractiveEditing()
      }
    })
  ).toEqual({ binding: variableId, interactive: false })
})

test('removes open paint portals and does not reopen them on activation', async () => {
  const swatch = editor.page.getByTestId('fill-picker-swatch').first()
  await swatch.click()
  await expect(editor.page.getByRole('dialog')).toBeVisible()
  await setTool('FRAME')
  await expect(editor.page.getByRole('dialog')).toHaveCount(0)
  await setTool('SELECT')
  await expect(width()).toBeVisible()
  await expect(editor.page.getByRole('dialog')).toHaveCount(0)
  await swatch.click()
  await expect(editor.page.getByRole('dialog')).toBeVisible()
  await editor.page.keyboard.press('Escape')
  await expect(editor.page.getByRole('dialog')).toHaveCount(0)
})

test('cancels a held scrub before retaining the panel', async () => {
  const box = expectDefined(await width().boundingBox(), 'width field')
  await editor.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await editor.page.mouse.down()
  try {
    await editor.page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 4 })
    await expect(width()).toHaveAttribute('aria-valuenow', '360')
    await setTool('FRAME')
    await expect(width()).toHaveCount(0)
    expect(
      await editor.page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        return { width: store?.selectedNode.value?.width, preview: store?.isInteractiveEditing() }
      })
    ).toEqual({ width: 320, preview: false })
  } finally {
    await editor.page.mouse.up()
  }
  await setTool('SELECT')
  await expect(width()).toHaveAttribute('aria-valuenow', '320')
  await width().dblclick()
  await editor.page.keyboard.press('ControlOrMeta+A')
  await editor.page.keyboard.type('400')
  await editor.page.keyboard.press('Enter')
  await expect(width()).toHaveAttribute('aria-valuenow', '400')
  await editor.page.evaluate(() => window.openPencil?.getStore?.().undoAction())
  await expect(width()).toHaveAttribute('aria-valuenow', '320')
})
