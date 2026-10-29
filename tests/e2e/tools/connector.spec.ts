import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { connectorDriver } from '#tests/helpers/canvas/connector-driver'
import { toolbarToolTestId } from '#tests/helpers/test-ids'

const editor = useEditorSetupWithClear()
const connectors = connectorDriver(() => editor.page)

let ids: Record<string, string> = {}

test.beforeEach(async () => {
  await editor.page.keyboard.press('Escape')
  await connectors.showOrigin()
  ids = await connectors.addBoxes([
    { name: 'A', x: 0, y: 0, width: 200, height: 200 },
    { name: 'B', x: 500, y: 100, width: 200, height: 200 }
  ])
})

async function drag(from: [number, number], to: [number, number]) {
  const start = connectors.point(...from)
  const end = connectors.point(...to)
  await editor.canvas.drag(start.x, start.y, end.x, end.y, 12)
  await editor.canvas.waitForRender()
}

async function lastConnector() {
  const connector = (await connectors.connectors()).at(-1)
  if (!connector) throw new Error('Missing connector')
  return connector
}

test('the toolbar keeps the connector tool hidden', async () => {
  await expect(editor.page.getByTestId(toolbarToolTestId('CONNECTOR'))).toHaveCount(0)
})

test('the connector tool joins the layers a drag starts and ends on, and stays picked', async () => {
  await connectors.showTool()
  await connectors.pickTool()
  await drag([100, 100], [600, 200])
  const connector = await lastConnector()
  expect(connector.start).toMatchObject({ nodeId: ids.A, magnet: 'AUTO' })
  expect(connector.end).toMatchObject({ nodeId: ids.B, magnet: 'AUTO' })
  expect((await connectors.focus()).tool).toBe('CONNECTOR')
})

test('hovering a layer with the tool outlines it with its magnets', async () => {
  await connectors.showTool()
  await connectors.pickTool()
  const point = connectors.point(30, 100)
  await editor.canvas.hover(point.x, point.y)
  await editor.canvas.waitForRender()
  expect((await connectors.focus()).target).toEqual({ nodeId: ids.A, magnet: 'LEFT' })
})

test('a selected connector’s end drags to another layer', async () => {
  await connectors.showTool()
  await connectors.pickTool()
  await drag([100, 100], [400, 450])
  const drawn = await lastConnector()
  expect(drawn.end?.nodeId).toBeNull()
  await editor.page.keyboard.press('v')
  await connectors.select(drawn.id)

  // The free end sits where the drag ended; its handle is dragged from there.
  const { x, y } = drawn.end?.position ?? { x: 0, y: 0 }
  await drag([x, y], [600, 200])
  expect((await lastConnector()).end).toMatchObject({ nodeId: ids.B })
})

test('Escape while dragging a connector end puts it back', async () => {
  await connectors.showTool()
  await connectors.pickTool()
  await drag([100, 100], [400, 450])
  const drawn = await lastConnector()
  await editor.page.keyboard.press('v')
  await connectors.select(drawn.id)
  const box = await editor.canvas.canvas.boundingBox()
  if (!box) throw new Error('Missing canvas')
  const { x, y } = drawn.end?.position ?? { x: 0, y: 0 }
  const from = connectors.point(x, y)
  const to = connectors.point(600, 200)
  await editor.page.mouse.move(box.x + from.x, box.y + from.y)
  await editor.page.mouse.down()
  await editor.page.mouse.move(box.x + to.x, box.y + to.y, { steps: 8 })
  await editor.page.keyboard.press('Escape')
  await editor.page.mouse.up()
  await editor.canvas.waitForRender()
  expect((await lastConnector()).end).toEqual(drawn.end)
})

test('Enter on a selected connector types its label', async () => {
  await connectors.showTool()
  await connectors.pickTool()
  await drag([100, 100], [600, 200])
  await editor.page.keyboard.press('v')
  const connector = await lastConnector()
  await connectors.select(connector.id)
  await editor.page.keyboard.press('Enter')
  await editor.page.keyboard.type('Next')
  await editor.page.keyboard.press('Escape')
  await editor.canvas.waitForRender()
  expect((await lastConnector()).label).toBe('Next')
})

test('double-clicking a connector types its label', async () => {
  await connectors.showTool()
  await connectors.pickTool()
  await drag([100, 100], [600, 200])
  await editor.page.keyboard.press('v')
  const connector = await lastConnector()
  const point = await connectors.linePoint(connector.id)
  const at = connectors.point(point.x, point.y)
  const box = await editor.canvas.canvas.boundingBox()
  if (!box) throw new Error('Missing canvas')
  await editor.page.mouse.dblclick(box.x + at.x, box.y + at.y)
  await editor.page.keyboard.type('Next')
  await editor.page.keyboard.press('Escape')
  await editor.canvas.waitForRender()
  expect((await lastConnector()).label).toBe('Next')
})

test('the Connector section sets the line type and end caps', async () => {
  await connectors.showTool()
  await connectors.pickTool()
  await drag([100, 100], [600, 200])
  await editor.page.keyboard.press('v')
  const connector = await lastConnector()
  await connectors.select(connector.id)
  const section = editor.page.getByRole('region', { name: 'Connector' })
  await section.getByRole('combobox', { name: 'Line' }).click()
  await editor.page.getByRole('option', { name: 'Curved' }).click()
  await section.getByRole('combobox', { name: 'End point' }).click()
  await editor.page.getByRole('option', { name: 'Circle arrow' }).click()
  expect(await connectors.style(connector.id)).toEqual({
    line: 'CURVED',
    startCap: 'NONE',
    endCap: 'CIRCLE_FILLED'
  })
})

test("the Connector section draws the line in FigJam's palette, thick, and dashed", async () => {
  await connectors.showTool()
  await connectors.pickTool()
  await drag([100, 100], [600, 200])
  await editor.page.keyboard.press('v')
  const connector = await lastConnector()
  await connectors.select(connector.id)
  const section = editor.page.getByRole('region', { name: 'Connector' })
  await section
    .getByRole('radiogroup', { name: 'Color' })
    .getByRole('radio', { name: 'Blue', exact: true })
    .click()
  await section.locator('[data-property="connector-dashed"]').click()
  await section.locator('[data-property="connector-thick"]').click()
  await expect(section.locator('[data-property="connector-thick"]')).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  expect(await connectors.lineStroke(connector.id)).toEqual({
    color: '#3dadff',
    weight: 8,
    dash: [40, 24]
  })
})
