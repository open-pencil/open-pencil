import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { propertySection } from '#tests/helpers/properties'

const editor = useEditorSetupWithClear('/?test&no-rulers')

/** A Switch set whose State=On and State=Off variants differ, and an Off instance below it. */
async function createSwitch() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const graph = store.graph
    const pageId = store.state.currentPageId
    const solid = (r: number, g: number, b: number) => [
      { type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }
    ]
    const set = graph.createNode('COMPONENT_SET', pageId, {
      name: 'Switch',
      x: 120,
      y: 120,
      width: 200,
      height: 80,
      componentPropertyDefinitions: [
        {
          id: 'state',
          name: 'State',
          type: 'VARIANT',
          defaultValue: 'Off',
          variantOptions: ['On', 'Off']
        }
      ]
    })
    const variant = (value: string, index: number, on: boolean) => {
      const component = graph.createNode('COMPONENT', set.id, {
        name: `State=${value}`,
        x: 20 + index * 90,
        y: 20,
        width: 56,
        height: 32,
        cornerRadius: 16,
        fills: on ? solid(0.2, 0.6, 1) : solid(0.8, 0.8, 0.85),
        componentPropertyValues: { State: value }
      })
      graph.createNode('ELLIPSE', component.id, {
        name: 'Knob',
        x: on ? 28 : 4,
        y: 4,
        width: 24,
        height: 24,
        fills: solid(1, 1, 1)
      })
      return component
    }
    variant('On', 0, true)
    const off = variant('Off', 1, false)
    const instance = graph.createInstance(off.id, pageId, { x: 120, y: 260 })
    if (!instance) throw new Error('Instance not created')
    store.select([set.id])
    return { setId: set.id, offId: off.id, instanceId: instance.id }
  })
}

test('a Switch behaviour flips in preview and leaves the document alone', async () => {
  const ids = await createSwitch()
  await editor.canvas.waitForRender()

  const section = propertySection(editor.page, 'Behaviour')
  await section.getByRole('button', { name: 'Add behaviour' }).click()
  await editor.page.getByRole('option', { name: /Switch/ }).click()
  await section.getByRole('combobox', { name: 'Value' }).click()
  await editor.page.getByRole('option', { name: 'State' }).click()
  await expect(section.getByText('Ready to preview')).toBeVisible()

  await editor.page.keyboard.press('Meta+Alt+Enter')
  await expect(editor.page.getByRole('button', { name: /Leave preview/ })).toBeVisible()
  const point = await editor.page.evaluate(() => {
    const state = window.openPencil?.getStore?.()?.state
    if (!state) throw new Error('OpenPencil store not initialized')
    return { x: 148 * state.zoom + state.panX, y: 276 * state.zoom + state.panY }
  })
  const box = await editor.canvas.canvas.boundingBox()
  if (!box) throw new Error('Canvas has no bounding box')
  await editor.page.mouse.click(box.x + point.x, box.y + point.y)
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('switch-previewed-on.png', {
    maxDiffPixelRatio: 0,
    threshold: 0
  })

  const document = await editor.page.evaluate((instanceId) => {
    const store = window.openPencil?.getStore?.()
    return store?.graph.getNode(instanceId)?.componentId
  }, ids.instanceId)
  expect(document).toBe(ids.offId)

  await editor.page.keyboard.press('Escape')
  await expect(editor.page.getByRole('button', { name: /Leave preview/ })).toHaveCount(0)
  // Editing again: the panels and their Preview button are back.
  await expect(editor.page.getByRole('button', { name: /^Preview/ })).toBeVisible()
})
