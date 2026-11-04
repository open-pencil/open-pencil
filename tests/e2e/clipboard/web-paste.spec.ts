import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'

const editor = useEditorSetup()

const WEB_HTML =
  '<h2 style="font-size: 32px; font-weight: 700">Design without lock-in</h2>' +
  '<p>Open files and <a href="https://openpencil.dev">an editor</a>.</p>' +
  '<div style="display: flex; gap: 8px"><span style="background-color: rgb(37, 99, 235); padding: 8px 12px">Get started</span></div>'
const WEB_TEXT = 'Design without lock-in\nOpen files and an editor.\nGet started'
const SOURCE =
  '<div style="display: flex; padding: 12px; background-color: rgb(238, 238, 255)"><button>Get started</button></div>'

test.beforeAll(async () => {
  await editor.page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
})

test.beforeEach(async () => {
  await editor.canvas.clearCanvas()
})

type Layer = { type: string; text: string; links: string[]; children: Layer[] }

function pageLayers() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const describe = (id: string): Layer => {
      const node = store.graph.getNode(id)
      if (!node) throw new Error(`Missing layer ${id}`)
      return {
        type: node.type,
        text: node.text,
        links: node.styleRuns.flatMap((run) =>
          run.style.hyperlink ? [run.style.hyperlink.value] : []
        ),
        children: node.childIds.map(describe)
      }
    }
    return store.graph.getChildren(store.state.currentPageId).map((node) => describe(node.id))
  })
}

function texts(layers: Layer[]): string[] {
  return layers.flatMap((layer) => [
    ...(layer.type === 'TEXT' ? [layer.text] : []),
    ...texts(layer.children)
  ])
}

async function paste(data: Record<string, string>) {
  await editor.page.evaluate((entries) => {
    const transfer = new DataTransfer()
    for (const [type, value] of Object.entries(entries)) transfer.setData(type, value)
    document.body.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true })
    )
  }, data)
}

test('a web page pastes as text with its links, and the notice pastes it as layers', async () => {
  await paste({ 'text/html': WEB_HTML, 'text/plain': WEB_TEXT })

  await expect
    .poll(pageLayers)
    .toEqual([{ type: 'TEXT', text: WEB_TEXT, links: ['https://openpencil.dev'], children: [] }])
  await expect(editor.page.getByText('Pasted as text.', { exact: true })).toBeVisible()

  await editor.page.getByRole('button', { name: 'Paste as layers' }).click()

  await expect
    .poll(async () => texts(await pageLayers()))
    .toEqual(['Design without lock-in', 'Open files and an editor.', 'Get started'])
  expect((await pageLayers()).some((layer) => layer.type === 'FRAME')).toBe(true)

  // The text paste was taken back, so one undo removes the layers and leaves nothing.
  await editor.page.keyboard.press('ControlOrMeta+KeyZ')
  await expect.poll(pageLayers).toEqual([])
})

test('a sentence copied from a page pastes as text without offering layers', async () => {
  // As Chromium copies a sentence from inside a paragraph: text styling only, no boxes.
  const textStyle = 'color: rgb(0, 0, 0); font-family: system-ui; font-size: 16px'
  await paste({
    'text/html':
      `<span style="${textStyle}; display: inline !important;">Open files and </span>` +
      `<a href="https://openpencil.dev/" style="${textStyle}">an editor</a>`,
    'text/plain': 'Open files and an editor'
  })

  await expect.poll(pageLayers).toEqual([
    {
      type: 'TEXT',
      text: 'Open files and an editor',
      links: ['https://openpencil.dev/'],
      children: []
    }
  ])
  await expect(editor.page.getByRole('button', { name: 'Paste as layers' })).toHaveCount(0)
})

test('plain text pastes as a text layer with nothing to offer', async () => {
  await paste({ 'text/plain': 'Just a sentence' })

  await expect
    .poll(pageLayers)
    .toEqual([{ type: 'TEXT', text: 'Just a sentence', links: [], children: [] }])
  await expect(editor.page.getByRole('button', { name: 'Paste as layers' })).toHaveCount(0)
})

test('HTML source copied as text pastes as layers from the notice', async () => {
  // Editors put a highlighted rendering of the code beside it; the layers come from the code.
  await paste({
    'text/plain': SOURCE,
    'text/html': `<pre><span style="color: red">${SOURCE}</span></pre>`
  })
  await expect.poll(async () => (await pageLayers())[0]?.text).toBe(SOURCE)

  await editor.page.getByRole('button', { name: 'Paste as layers' }).click()

  await expect.poll(async () => texts(await pageLayers())).toEqual(['Get started'])
})

test('Paste as layers in the canvas menu lays the clipboard out where it was opened', async () => {
  await editor.page.evaluate(
    async ([html, text]) => {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' })
        })
      ])
    },
    [WEB_HTML, WEB_TEXT]
  )
  const box = expectDefined(await editor.canvas.canvas.boundingBox(), 'canvas bounds')

  await editor.page.mouse.click(box.x + 300, box.y + 250, { button: 'right' })
  await editor.page.getByTestId('context-paste-as-layers').click()

  await expect
    .poll(async () => texts(await pageLayers()))
    .toEqual(['Design without lock-in', 'Open files and an editor.', 'Get started'])
})
