import type { Vector } from '@open-pencil/scene-graph/primitives'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { stickyDriver } from '#tests/helpers/canvas/sticky-driver'
import { propertyField, propertySection } from '#tests/helpers/properties'
import { toolbarToolTestId } from '#tests/helpers/test-ids'

const editor = useEditorSetupWithClear()
const sticky = stickyDriver(() => editor.page)

const YELLOW = { r: 1, g: 226 / 255, b: 153 / 255, a: 1 }

test.beforeEach(async () => {
  await editor.page.keyboard.press('Escape')
  await sticky.showOrigin()
})

/** The page's last note, which each test places or sets up itself. */
async function lastNote() {
  const note = (await sticky.notes()).at(-1)
  if (!note) throw new Error('Missing sticky note')
  return note
}

async function clickNote(x: number, y: number) {
  const point = sticky.point(x, y)
  await editor.canvas.click(point.x, point.y)
  await editor.canvas.waitForRender()
}

test('the toolbar keeps the sticky tool hidden, and S does not pick it', async () => {
  await expect(editor.page.getByTestId(toolbarToolTestId('STICKY'))).toHaveCount(0)
  await editor.page.keyboard.press('s')
  expect((await sticky.focus()).tool).toBe('SELECT')
})

test('a click with the sticky tool places a note with its corner there, to type into', async () => {
  await sticky.showTool()
  await sticky.pickTool()
  await clickNote(300, 200)
  const placed = await lastNote()
  expect(placed).toMatchObject({ x: 300, y: 200, width: 240, height: 240, body: { text: '' } })
  const focus = await sticky.focus()
  expect(focus.selected).toEqual([placed.id])
  expect(focus.editing).not.toBeNull()

  await editor.page.keyboard.type('Hello sticky')
  await editor.page.keyboard.press('Escape')
  await editor.canvas.waitForRender()
  expect(await lastNote()).toMatchObject({ name: 'Hello sticky', body: { text: 'Hello sticky' } })
  expect(await sticky.focus()).toMatchObject({
    tool: 'SELECT',
    selected: [placed.id],
    editing: null
  })
})

/** Presses at `from` with the sticky tool and moves to `to`, both page points, holding the button. */
async function pressAndDrag(from: Vector, to: Vector) {
  const box = await editor.canvas.canvas.boundingBox()
  if (!box) throw new Error('Missing canvas')
  const start = sticky.point(from.x, from.y)
  const end = sticky.point(to.x, to.y)
  await editor.page.mouse.move(box.x + start.x, box.y + start.y)
  await editor.page.mouse.down()
  await editor.page.mouse.move(box.x + end.x, box.y + end.y, { steps: 6 })
  await editor.canvas.waitForRender()
}

test('the sticky tool draws a note as a frame is drawn, growing with the drag', async () => {
  await sticky.showTool()
  await sticky.pickTool()
  const before = (await sticky.notes()).length
  await pressAndDrag({ x: 300, y: 200 }, { x: 420, y: 260 })
  // While the button is held, the note is already there, as large as the drag.
  expect(await sticky.notes()).toHaveLength(before + 1)
  expect(await lastNote()).toMatchObject({ x: 300, y: 200, width: 120, height: 120 })
  await editor.page.mouse.up()
  await editor.canvas.waitForRender()
  // Its text scales with it, as a note keeps its shape.
  expect(await lastNote()).toMatchObject({
    x: 300,
    y: 200,
    width: 120,
    height: 120,
    body: { fontSize: 8 }
  })
  expect((await sticky.focus()).editing).not.toBeNull()
  await editor.page.keyboard.press('Escape')
  // Drawing it was one step.
  await editor.page.keyboard.press('ControlOrMeta+z')
  await editor.canvas.waitForRender()
  expect(await sticky.notes()).toHaveLength(before)
})

test('a note drawn up and to the left grows from the press that way', async () => {
  await sticky.showTool()
  await sticky.pickTool()
  await pressAndDrag({ x: 600, y: 500 }, { x: 420, y: 440 })
  await editor.page.mouse.up()
  await editor.canvas.waitForRender()
  expect(await lastNote()).toMatchObject({ x: 420, y: 320, width: 180, height: 180 })
  await editor.page.keyboard.press('Escape')
})

test('Escape while drawing a note leaves no note', async () => {
  await sticky.showTool()
  await sticky.pickTool()
  const before = (await sticky.notes()).length
  await pressAndDrag({ x: 300, y: 200 }, { x: 400, y: 300 })
  await editor.page.keyboard.press('Escape')
  await editor.page.mouse.up()
  await editor.canvas.waitForRender()
  expect(await sticky.notes()).toHaveLength(before)
})

test('the Sticky note section recolours a note, sizes its text, and hides its author', async () => {
  await sticky.add([{ x: 300, y: 200, text: 'Panel', author: 'Ada' }])
  await clickNote(300, 200)
  const section = editor.page.getByRole('region', { name: 'Sticky note' })

  await section.getByRole('radio', { name: 'Yellow' }).click()
  await expect.poll(async () => (await lastNote()).fill).toBe('#ffe299')

  await section.getByRole('combobox', { name: 'Text size' }).click()
  await editor.page.getByRole('option', { name: 'Large', exact: true }).click()
  await expect.poll(async () => (await lastNote()).body.fontSize).toBe(40)

  await section.getByRole('switch', { name: 'Show author' }).click()
  await expect.poll(async () => (await lastNote()).author.visible).toBe(false)
})

// Figma keeps a note upright and gives it no strokes or effects: its shadow is part of the note.
// A note keeps FigJam's fixed choices, which its Sticky note section offers; free-form styling
// would make notes FigJam itself cannot make.
test("a note's panel keeps to FigJam's choices: no free-form fill, appearance, stroke, or effects", async () => {
  await sticky.add([{ x: 300, y: 200, text: 'Upright' }])
  await clickNote(300, 200)

  await expect(propertySection(editor.page, 'Sticky note')).toBeVisible()
  await expect(propertyField(editor.page, 'x')).toBeVisible()
  await expect(propertyField(editor.page, 'rotation')).toHaveCount(0)
  for (const section of ['Fill', 'Appearance', 'Stroke', 'Effects']) {
    await expect(propertySection(editor.page, section)).toHaveCount(0)
  }
})

test('a note selected with a rectangle offers no free-form styling either', async () => {
  await sticky.add([{ x: 150, y: 150, text: 'One' }])
  const from = sticky.point(550, 100)
  const to = sticky.point(650, 200)
  await editor.canvas.pressKey('r')
  await editor.canvas.drag(from.x, from.y, to.x, to.y)
  await editor.page.keyboard.down('Shift')
  await clickNote(150, 150)
  await editor.page.keyboard.up('Shift')

  await expect(editor.page.getByTestId('design-panel-multi')).toBeVisible()
  for (const section of ['Fill', 'Stroke', 'Effects']) {
    await expect(propertySection(editor.page, section)).toHaveCount(0)
  }
})

test('the sticky tool places notes in the colour picked last', async () => {
  await sticky.add([{ x: 150, y: 150, text: 'First' }])
  await clickNote(150, 150)
  await editor.page
    .getByRole('region', { name: 'Sticky note' })
    .getByRole('radio', { name: 'Yellow' })
    .click()
  await sticky.showTool()
  await sticky.pickTool()
  await clickNote(600, 150)
  expect((await lastNote()).fill).toBe('#ffe299')
})

test('double-clicking a note edits its body with all of it selected', async () => {
  await sticky.add([{ x: 300, y: 200, text: 'Draft', color: YELLOW }])
  const point = sticky.point(300, 200)
  await editor.canvas.dblclick(point.x, point.y)
  await editor.canvas.waitForRender()
  expect((await sticky.focus()).editing).not.toBeNull()

  await editor.page.keyboard.type('Replaced')
  await editor.page.keyboard.press('Escape')
  await editor.canvas.waitForRender()
  const edited = await lastNote()
  expect(edited).toMatchObject({ body: { text: 'Replaced' }, name: 'Replaced' })
  expect((await sticky.focus()).selected).toEqual([edited.id])
})

test("dragging a note's side makes it wide, and back square, as in FigJam", async () => {
  await sticky.add([{ x: 300, y: 200, text: 'Wide' }])
  await clickNote(300, 200)
  // The note spans 180 to 420 across, centred on 200 down.
  const edge = sticky.point(420, 200)
  await editor.canvas.drag(edge.x, edge.y, edge.x + 150, edge.y)
  await expect.poll(async () => (await lastNote()).width).toBe(416)
  await editor.canvas.drag(edge.x + 176, edge.y, edge.x - 20, edge.y)
  await expect.poll(async () => (await lastNote()).width).toBe(240)
})
