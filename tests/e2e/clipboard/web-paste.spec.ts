import { expectDefined } from '@open-pencil/test-support/assert'

import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

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

/** The notices on screen, and the one offering to paste as layers, found by role, not copy. */
const toasts = () => editor.page.locator('[data-slot="toast"]')
const layersOffer = () => toasts().getByRole('button', { name: 'Paste as layers' })

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
  await layersOffer().click()

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
  await expect(layersOffer()).toHaveCount(0)
})

function linkRuns() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph
      .getChildren(store.state.currentPageId)
      .flatMap((node) =>
        node.styleRuns.flatMap((run) =>
          run.style.hyperlink
            ? [{ start: run.start, length: run.length, url: run.style.hyperlink.value }]
            : []
        )
      )
  })
}

test('links land on the words the page linked, across line breaks', async () => {
  await paste({
    'text/html':
      '<p>Home <a href="https://a.test/">Home</a> and <a href="https://b.test/">an editor</a></p>',
    'text/plain': 'Home Home and an\neditor'
  })

  await expect.poll(linkRuns).toEqual([
    { start: 5, length: 4, url: 'https://a.test/' },
    { start: 14, length: 9, url: 'https://b.test/' }
  ])
})

test('hidden text in the page does not move a link to another occurrence', async () => {
  await paste({
    'text/html':
      '<p><span style="display: none">Home </span>Home <a href="https://a.test/">Home</a></p>',
    'text/plain': 'Home Home'
  })

  await expect.poll(linkRuns).toEqual([{ start: 5, length: 4, url: 'https://a.test/' }])
})

test('HTML without text or boxes pastes nothing, as in Figma', async () => {
  await paste({ 'text/html': '<p>Hello</p><p>world</p>' })

  await expect.poll(pageLayers).toEqual([])
  await expect(toasts()).toHaveCount(0)
})

test('a laid-out copy without text pastes as layers at once', async () => {
  await paste({
    'text/html':
      '<div style="width: 120px; height: 40px; background-color: rgb(37, 99, 235)"></div>'
  })

  await expect.poll(async () => (await pageLayers()).map((layer) => layer.type)).toEqual(['FRAME'])
  await expect(toasts()).toHaveCount(0)
})

test('the notice keeps the text when the HTML shows nothing', async () => {
  const hidden = '<div style="display: none"><b>Hidden</b></div>'
  await paste({ 'text/plain': hidden })
  await expect.poll(async () => (await pageLayers())[0]?.text).toBe(hidden)

  await layersOffer().click()

  // The notice gives way to one that only reports, and the text stays.
  await expect(layersOffer()).toHaveCount(0)
  await expect(toasts()).toHaveCount(1)
  // A report, not the failure path, which shows an error.
  await expect(toasts()).toHaveAttribute('data-tone', 'default')
  expect((await pageLayers()).map((layer) => layer.text)).toEqual([hidden])
})

test('plain text pastes as a text layer with nothing to offer', async () => {
  await paste({ 'text/plain': 'Just a sentence' })

  await expect
    .poll(pageLayers)
    .toEqual([{ type: 'TEXT', text: 'Just a sentence', links: [], children: [] }])
  await expect(layersOffer()).toHaveCount(0)
})

test('HTML source copied as text pastes as layers from the notice', async () => {
  // Editors put a highlighted rendering of the code beside it; the layers come from the code.
  await paste({
    'text/plain': SOURCE,
    'text/html': `<pre><span style="color: red">${SOURCE}</span></pre>`
  })
  await expect.poll(async () => (await pageLayers())[0]?.text).toBe(SOURCE)

  await layersOffer().click()

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
