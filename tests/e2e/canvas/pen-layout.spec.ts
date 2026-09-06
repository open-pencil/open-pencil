import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup('/?test&no-chrome&no-rulers')

test('lays out Pen frames whose default horizontal layout is omitted', async () => {
  await editor.page.evaluate(() =>
    window.openPencil?.openFile?.('/tests/fixtures/pen-layout-defaults.pen')
  )
  await editor.canvas.waitForInit()

  const geometry = await editor.page.evaluate(() => {
    const graph = window.openPencil?.getStore?.().graph
    if (!graph) throw new Error('OpenPencil graph not initialized')
    const section = graph.getNode('section')
    const fixed = graph.getNode('fixed-child')
    const fill = graph.getNode('fill-child')
    if (!section || !fixed || !fill) throw new Error('Imported layout nodes are missing')
    return {
      section: {
        layoutMode: section.layoutMode,
        width: section.width,
        height: section.height
      },
      fixed: { x: fixed.x, y: fixed.y, width: fixed.width, height: fixed.height },
      fill: { x: fill.x, y: fill.y, width: fill.width, height: fill.height }
    }
  })

  expect(geometry).toEqual({
    section: { layoutMode: 'HORIZONTAL', width: 1440, height: 564 },
    fixed: { x: 80, y: 72, width: 620, height: 420 },
    fill: { x: 756, y: 72, width: 604, height: 420 }
  })
})
