import { test, expect, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

async function stubGoogleFonts(page: Page) {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      let url: string
      if (typeof input === 'string') url = input
      else if (input instanceof URL) url = input.href
      else url = input.url
      if (url.startsWith('https://www.googleapis.com/webfonts/v1/webfonts')) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }
      return originalFetch(input, init)
    }
  })
}

async function startEmptyTextEdit(page: Page) {
  return await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')

    const id = store.createShape('TEXT', 120, 120, 280, 36)
    store.graph.updateNode(id, {
      text: '',
      fontSize: 32,
      fontFamily: 'Inter',
      textAutoResize: 'HEIGHT',
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })
    store.select([id])
    store.startTextEditing(id)
    store.requestRender()
    return id
  })
}

test('Hangul text input commits without CanvasKit paragraph errors', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await stubGoogleFonts(page)
  await page.goto('http://localhost:1420/?test&no-chrome&no-rulers')
  await canvas.waitForInit()

  const id = await startEmptyTextEdit(page)

  await page.locator('textarea[aria-hidden="true"]').fill('환경설정')
  await canvas.waitForRender()
  await canvas.click(20, 20)
  await canvas.waitForRender()

  const result = await page.evaluate((nodeId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const node = store.graph.getNode(nodeId)
    if (!node || node.type !== 'TEXT') return null
    return {
      editingTextId: store.state.editingTextId,
      height: node.height,
      text: node.text
    }
  }, id)

  expect(result).toMatchObject({
    editingTextId: null,
    text: '환경설정'
  })
  expect(result?.height).toBeGreaterThan(0)
  canvas.assertNoErrors()
})

test('Hangul composition updates are visible before IME commit', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await stubGoogleFonts(page)
  await page.goto('http://localhost:1420/?test&no-chrome&no-rulers')
  await canvas.waitForInit()

  const id = await startEmptyTextEdit(page)

  const composing = await page.evaluate((nodeId) => {
    const store = window.openPencil?.getStore?.()
    const textarea = document.querySelector<HTMLTextAreaElement>('textarea[aria-hidden="true"]')
    if (!store || !textarea) throw new Error('Text edit session was not initialized')

    const readText = () => {
      const node = store.graph.getNode(nodeId)
      return node?.type === 'TEXT' ? node.text : null
    }
    const update = (text: string) => {
      textarea.value = text
      textarea.dispatchEvent(new CompositionEvent('compositionupdate', { data: text }))
      textarea.dispatchEvent(
        new InputEvent('input', {
          data: text,
          inputType: 'insertCompositionText',
          isComposing: true
        })
      )
      return readText()
    }

    textarea.dispatchEvent(new CompositionEvent('compositionstart'))
    const steps = [update('ㅎ'), update('하'), update('한')]

    textarea.dispatchEvent(new CompositionEvent('compositionend', { data: '한' }))
    const afterEnd = readText()

    textarea.value = '한'
    textarea.dispatchEvent(new InputEvent('input', { data: '한', inputType: 'insertText' }))
    const afterTrailingInput = readText()

    return {
      afterEnd,
      afterTrailingInput,
      editingTextId: store.state.editingTextId,
      steps
    }
  }, id)

  expect(composing).toEqual({
    afterEnd: '한',
    afterTrailingInput: '한',
    editingTextId: id,
    steps: ['ㅎ', '하', '한']
  })

  await canvas.click(20, 20)
  const committed = await page.evaluate((nodeId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return {
      editingTextId: store.state.editingTextId,
      text: store.graph.getNode(nodeId)?.text
    }
  }, id)

  expect(committed).toEqual({
    editingTextId: null,
    text: '한'
  })
  canvas.assertNoErrors()
})
