import { readFile } from 'node:fs/promises'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { pasteFigmaClipboard } from '#tests/helpers/canvas/figma-paste'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('FigJam connectors draw their elbows, curve, caps, dashes, and label as Figma routed them', async () => {
  const html = await readFile('tests/fixtures/clipboard/figjam-connectors.html', 'utf8')
  await pasteFigmaClipboard(editor.page, html)
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('figjam-connectors.png')
})
