import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('one click turns the design into variables, binds them, documents them, and undoes as one step', async ({
  page
}) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
  const button = await page.evaluate(() => {
    const store = window.lawha?.getStore?.()
    if (!store) throw new Error('Lawha store not initialized')
    const graph = store.graph
    const solid = (r: number, g: number, b: number) => [
      { type: 'SOLID' as const, color: { r, g, b, a: 1 }, opacity: 1, visible: true }
    ]
    const screen = graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Home',
      width: 390,
      height: 700,
      fills: solid(1, 1, 1),
      layoutMode: 'VERTICAL',
      itemSpacing: 16
    })
    for (const size of [28, 16, 16, 12])
      graph.createNode('TEXT', screen.id, {
        name: `Text ${size}`,
        text: 'Hello',
        fontFamily: 'Inter',
        fontSize: size,
        fills: solid(0.07, 0.09, 0.15)
      })
    const cta = graph.createNode('FRAME', screen.id, {
      name: 'Button',
      width: 342,
      height: 52,
      cornerRadius: 12,
      fills: solid(0.05, 0.62, 0.43)
    })
    store.select([])
    return cta.id
  })

  await page.getByTestId('design-system-build').click()
  const read = () =>
    page.evaluate((id) => {
      const graph = window.lawha?.getStore?.().graph
      if (!graph) return null
      const name = (variableId?: string) =>
        [...graph.variables.values()].find((v) => v.id === variableId)?.name ?? null
      const node = graph.getNode(id)
      return {
        variables: graph.variables.size,
        fill: name(node?.boundVariables['fills/0/color']),
        radius: name(node?.boundVariables.cornerRadius),
        docs: graph.getPages().some((p) => p.name === 'Design System')
      }
    }, button)
  await expect.poll(read).toMatchObject({ fill: 'color/primary', radius: 'radius/12', docs: true })
  expect((await read())?.variables).toBeGreaterThan(8)

  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(read).toMatchObject({ variables: 0, fill: null, docs: false })
})
