import { existsSync, readFileSync } from 'node:fs'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const appleGothic = '/System/Library/Fonts/Supplemental/AppleGothic.ttf'

test.skip(
  process.platform !== 'darwin' || !existsSync(appleGothic),
  'CJK visual snapshot uses macOS AppleGothic for Hangul coverage'
)

async function expectCanvas(name: string) {
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.canvas.screenshot()
  expect(buffer).toMatchSnapshot(`${name}.png`)
}

test('renders Simplified Chinese, Traditional Chinese, Japanese, and Korean fallback text', async () => {
  await editor.page.route('**/__test-fonts/apple-gothic.ttf', async (route) => {
    await route.fulfill({ body: readFileSync(appleGothic), contentType: 'font/ttf' })
  })

  const smoke = await editor.page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const { fontManager } = await import('/packages/core/src/text/fonts.ts')

    const [notoResponse, appleGothicResponse] = await Promise.all([
      fetch('/tests/fixtures/fonts/NotoSansSC-Regular.ttf'),
      fetch('/__test-fonts/apple-gothic.ttf')
    ])
    if (!notoResponse.ok) throw new Error(`Failed to load Noto Sans SC: ${notoResponse.status}`)
    if (!appleGothicResponse.ok) {
      throw new Error(`Failed to load AppleGothic: ${appleGothicResponse.status}`)
    }

    fontManager.markLoaded('Noto Sans SC', 'Regular', await notoResponse.arrayBuffer())
    fontManager.markLoaded('AppleGothic', 'Regular', await appleGothicResponse.arrayBuffer())
    fontManager.setCJKFallbackFamily('Noto Sans SC')
    fontManager.setCJKFallbackFamily('AppleGothic')

    const lines = [
      { label: 'Simplified Chinese', text: '你好世界' },
      { label: 'Traditional Chinese', text: '繁體中文' },
      { label: 'Japanese', text: '日本語かなカナ' },
      { label: 'Korean', text: '안녕하세요' }
    ]

    store.graph.createNode('FRAME', pageId, {
      name: 'CJK rendering visual backdrop',
      x: 64,
      y: 52,
      width: 720,
      height: 312,
      cornerRadius: 20,
      fills: [
        { type: 'SOLID', color: { r: 0.97, g: 0.98, b: 1, a: 1 }, visible: true, opacity: 1 }
      ],
      strokes: [
        {
          color: { r: 0.78, g: 0.84, b: 0.95, a: 1 },
          weight: 1,
          visible: true,
          opacity: 1,
          align: 'INSIDE'
        }
      ]
    })

    for (const [index, line] of lines.entries()) {
      const y = 84 + index * 64
      store.graph.createNode('TEXT', pageId, {
        name: `${line.label} label`,
        x: 96,
        y,
        width: 210,
        height: 28,
        text: line.label,
        fontFamily: 'Inter',
        fontSize: 17,
        fontWeight: 600,
        fills: [
          { type: 'SOLID', color: { r: 0.25, g: 0.32, b: 0.45, a: 1 }, visible: true, opacity: 1 }
        ]
      })
      store.graph.createNode('TEXT', pageId, {
        name: `${line.label} sample`,
        x: 328,
        y: y - 4,
        width: 360,
        height: 42,
        text: line.text,
        fontFamily: 'Inter',
        fontSize: 32,
        textAutoResize: 'HEIGHT',
        fills: [
          { type: 'SOLID', color: { r: 0.04, g: 0.06, b: 0.12, a: 1 }, visible: true, opacity: 1 }
        ]
      })
    }

    await store.loadFontsForNodes(store.graph.getPages().flatMap((page) => page.childIds))
    store.clearSelection()
    store.requestRender()

    return {
      loaded: {
        noto: fontManager.isStyleLoaded('Noto Sans SC', 'Regular'),
        appleGothic: fontManager.isStyleLoaded('AppleGothic', 'Regular')
      },
      fallbacks: fontManager.getCJKFallbackFamilies()
    }
  })

  expect(smoke.loaded).toEqual({ noto: true, appleGothic: true })
  expect(smoke.fallbacks).toEqual(expect.arrayContaining(['Noto Sans SC', 'AppleGothic']))
  await editor.canvas.waitForRender()
  await expectCanvas('cjk-fallback-text-rendering')
})
