import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  clearInMemoryClipboardHTML,
  rememberedWebHTML,
  rememberWebClipboard,
  setInMemoryClipboardHTML
} from '@/app/editor/clipboard/memory'
import { readClipboardHTML, readWebClipboard } from '@/app/editor/clipboard/read'

import { asDouble } from '#tests/helpers/doubles'

const DESIGN = '<span data-buffer="<!--(figma)AAAA(/figma)-->"></span>'
const LAST_COPY = '<span data-buffer="<!--(figma)BBBB(/figma)-->"></span>'

function item(types: Record<string, string>): ClipboardItem {
  return asDouble<ClipboardItem>({
    types: Object.keys(types),
    getType: async (type: string) => new Blob([types[type] ?? ''], { type })
  })
}

beforeEach(() => setInMemoryClipboardHTML(LAST_COPY))
afterEach(() => clearInMemoryClipboardHTML())

describe('readClipboardHTML', () => {
  test('reads design layers from the system clipboard', async () => {
    expect(await readClipboardHTML({ read: async () => [item({ 'text/html': DESIGN })] })).toBe(
      DESIGN
    )
  })

  test('a readable clipboard without design layers is not replaced by the last copy', async () => {
    const clipboard = { read: async () => [item({ 'text/plain': 'copied elsewhere' })] }
    expect(await readClipboardHTML(clipboard)).toBeNull()
  })

  test('falls back to the last copy when the clipboard cannot be read', async () => {
    const clipboard = {
      read: async (): Promise<ClipboardItem[]> => {
        throw new Error('Read permission denied')
      }
    }
    expect(await readClipboardHTML(clipboard)).toBe(LAST_COPY)
  })
})

describe('readWebClipboard', () => {
  test('reads the HTML and text a web page copied', async () => {
    const clipboard = {
      read: async () => [item({ 'text/html': '<b>Hi</b>', 'text/plain': 'Hi' })]
    }
    expect(await readWebClipboard(clipboard)).toEqual({ html: '<b>Hi</b>', text: 'Hi' })
  })

  test('reads nothing when the clipboard cannot be read', async () => {
    const clipboard = {
      read: async (): Promise<ClipboardItem[]> => {
        throw new Error('Read permission denied')
      }
    }
    expect(await readWebClipboard(clipboard)).toEqual({ html: '', text: '' })
  })
})

describe('rememberedWebHTML', () => {
  test('gives the last pasted page while the clipboard holds its text', () => {
    rememberWebClipboard('<b>Hi</b>', 'Hi')
    expect(rememberedWebHTML('Hi')).toBe('<b>Hi</b>')
    expect(rememberedWebHTML('Something newer')).toBe('')
    expect(rememberedWebHTML('')).toBe('')
  })
})
