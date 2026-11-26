import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { pageScene } from '#tests/helpers/canvas/page-scene'
import { previewBox, previewHeight } from '#tests/helpers/canvas/preview-layout/probe'
import type * as PreviewLayoutScenes from '#tests/helpers/canvas/preview-layout/scene'

const editor = useEditorSetupWithClear('/?test&no-rulers')
const scenes = pageScene<typeof PreviewLayoutScenes>(
  () => editor.page,
  '/tests/helpers/canvas/preview-layout/scene.ts'
)

async function startPreview() {
  await editor.page.keyboard.press('ControlOrMeta+Alt+Enter')
  await expect(editor.page.getByRole('button', { name: /Leave preview/ })).toBeVisible()
}

test('an overfull space-between row overflows in preview as it does on the canvas', async () => {
  const row = await scenes.build('createOverfullRow')
  // 217 + 107 is wider than the row, so the control runs past its end.
  expect(row.boxes).toMatchObject({ Label: { x: 0, width: 217 }, Control: { x: 217, width: 107 } })
  await startPreview()
  for (const [name, box] of Object.entries(row.boxes))
    await expect.poll(() => previewBox(editor.page, row.id, name)).toEqual(box)
})

test('a stroke left out of layout and an automatic line height measure in preview as on the canvas', async () => {
  const card = await scenes.build('createStrokedCard')
  expect(card.boxes).toMatchObject({ Fill: { x: 24, width: 312 }, Lines: { height: 36 } })
  await startPreview()
  for (const [name, box] of Object.entries(card.boxes))
    await expect
      .poll(() => previewBox(editor.page, card.id, name))
      .toMatchObject({ x: box.x, y: box.y, height: box.height })
  await expect
    .poll(() => previewBox(editor.page, card.id, 'Fill'))
    .toMatchObject({ width: card.boxes.Fill.width })
  await expect.poll(() => previewHeight(editor.page, card.id)).toBe(card.height)
})
