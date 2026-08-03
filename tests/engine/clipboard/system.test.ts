import { afterEach, describe, expect, test } from 'bun:test'

import {
  clearClipboardEditableTarget,
  executeClipboardCommand,
  rememberClipboardEditableTarget
} from '@/app/editor/clipboard/system'

type ClipboardCommand = 'copy' | 'cut' | 'paste'
type GlobalKey =
  | 'window'
  | 'document'
  | 'navigator'
  | 'DataTransfer'
  | 'ClipboardItem'
  | 'HTMLInputElement'
  | 'HTMLTextAreaElement'
  | 'HTMLElement'

const globalKeys: GlobalKey[] = [
  'window',
  'document',
  'navigator',
  'DataTransfer',
  'ClipboardItem',
  'HTMLInputElement',
  'HTMLTextAreaElement',
  'HTMLElement'
]

const originalGlobals = new Map<GlobalKey, PropertyDescriptor | undefined>()

function rememberGlobals() {
  originalGlobals.clear()
  for (const key of globalKeys) {
    originalGlobals.set(key, Reflect.getOwnPropertyDescriptor(globalThis, key))
  }
}

function restoreGlobals() {
  for (const key of globalKeys) {
    const descriptor = originalGlobals.get(key)
    if (descriptor) {
      Object.defineProperty(globalThis, key, descriptor)
    } else {
      Reflect.deleteProperty(globalThis, key)
    }
  }
}

class HTMLElementStub {
  isContentEditable = false
  isConnected = true
  ownerDocument: ClipboardDocumentStub | null = null
  parentElement: HTMLElementStub | null = null

  private role: string | null = null

  focus() {
    if (this.ownerDocument) this.ownerDocument.activeElement = this
  }

  blur() {
    if (this.ownerDocument?.activeElement === this) this.ownerDocument.activeElement = null
  }

  getAttribute(name: string) {
    if (name === 'role') return this.role
    return null
  }

  setAttribute(name: string, value: string) {
    if (name === 'role') this.role = value
  }
}

interface SelectableTextInputStub {
  selectionStart: number | null
  selectionEnd: number | null
  selectionRanges: Array<[number, number]>
  setSelectionRange(start: number, end: number): void
}

class SelectableTextElementStub extends HTMLElementStub implements SelectableTextInputStub {
  selectionStart: number | null = 0
  selectionEnd: number | null = 0
  selectionRanges: Array<[number, number]> = []

  setSelectionRange(start: number, end: number) {
    this.selectionStart = start
    this.selectionEnd = end
    this.selectionRanges.push([start, end])
  }
}

class HTMLInputElementStub extends SelectableTextElementStub {}

class HTMLTextAreaElementStub extends SelectableTextElementStub {}

class DataTransferStub {
  private readonly data = new Map<string, string>()

  getData(type: string) {
    return this.data.get(type) ?? ''
  }

  setData(type: string, value: string) {
    this.data.set(type, value)
  }
}

interface ClipboardDocumentStub {
  activeElement: object | null
  execCommand(command: ClipboardCommand): boolean
}

function attachToDocument(element: object | null, documentStub: ClipboardDocumentStub) {
  if (element instanceof HTMLElementStub) element.ownerDocument = documentStub
}

function installClipboardDom(activeElement: object | null, options: { tauri?: boolean } = {}) {
  const { tauri = true } = options
  const execCommands: ClipboardCommand[] = []
  const documentStub: ClipboardDocumentStub = {
    activeElement,
    execCommand(command: ClipboardCommand) {
      execCommands.push(command)
      return true
    }
  }
  attachToDocument(activeElement, documentStub)

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: tauri ? { __TAURI_INTERNALS__: {} } : {}
  })
  Object.defineProperty(globalThis, 'HTMLElement', {
    configurable: true,
    value: HTMLElementStub
  })
  Object.defineProperty(globalThis, 'HTMLInputElement', {
    configurable: true,
    value: HTMLInputElementStub
  })
  Object.defineProperty(globalThis, 'HTMLTextAreaElement', {
    configurable: true,
    value: HTMLTextAreaElementStub
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: documentStub
  })
  return {
    documentStub,
    execCommands,
    setActiveElement(element: object | null) {
      attachToDocument(element, documentStub)
      documentStub.activeElement = element
    }
  }
}

function installBrowserClipboard() {
  const writes: string[] = []
  const itemWrites: ClipboardItemStub[] = []
  Object.defineProperty(globalThis, 'DataTransfer', {
    configurable: true,
    value: DataTransferStub
  })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: {
        async writeText(text: string) {
          writes.push(text)
        }
      }
    }
  })
  return { itemWrites, writes }
}

class ClipboardItemStub {
  constructor(readonly data: Record<string, Blob>) {}
}

function installRichBrowserClipboard() {
  const browserClipboard = installBrowserClipboard()
  Object.defineProperty(globalThis, 'ClipboardItem', {
    configurable: true,
    value: ClipboardItemStub
  })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: {
        async write(items: ClipboardItemStub[]) {
          browserClipboard.itemWrites.push(...items)
        },
        async writeText(text: string) {
          browserClipboard.writes.push(text)
        }
      }
    }
  })
  return browserClipboard
}

function createStore() {
  const calls = {
    deleteSelected: 0,
    pasteFromHTML: 0,
    writeCopyData: 0
  }
  const store = {
    deleteSelected() {
      calls.deleteSelected += 1
    },
    async pasteFromHTML() {
      calls.pasteFromHTML += 1
    },
    writeCopyData() {
      calls.writeCopyData += 1
      throw new Error('canvas clipboard should not run while text editing is focused')
    }
  }

  return { calls, store }
}

afterEach(() => {
  clearClipboardEditableTarget()
  restoreGlobals()
})

describe('executeClipboardCommand', () => {
  test('uses native text editing clipboard semantics before canvas clipboard actions', async () => {
    rememberGlobals()
    const { execCommands } = installClipboardDom(new HTMLInputElementStub())
    const { calls, store } = createStore()

    for (const command of ['copy', 'cut', 'paste'] as const) {
      await expect(executeClipboardCommand(store, command)).resolves.toBe(true)
    }

    expect(execCommands).toEqual(['copy', 'cut', 'paste'])
    expect(calls).toEqual({
      deleteSelected: 0,
      pasteFromHTML: 0,
      writeCopyData: 0
    })
  })

  test('treats contenteditable focus as text editing for menu clipboard commands', async () => {
    rememberGlobals()
    const editor = new HTMLElementStub()
    editor.isContentEditable = true
    const { execCommands } = installClipboardDom(editor)
    const { calls, store } = createStore()

    await expect(executeClipboardCommand(store, 'cut')).resolves.toBe(true)

    expect(execCommands).toEqual(['cut'])
    expect(calls).toEqual({
      deleteSelected: 0,
      pasteFromHTML: 0,
      writeCopyData: 0
    })
  })

  test('uses a recently focused editable when menu focus moved activeElement away', async () => {
    rememberGlobals()
    const input = new HTMLInputElementStub()
    const menuItem = new HTMLElementStub()
    menuItem.setAttribute('role', 'menuitem')
    const { documentStub, execCommands, setActiveElement } = installClipboardDom(input)
    const { calls, store } = createStore()

    rememberClipboardEditableTarget(input)
    setActiveElement(menuItem)

    await expect(executeClipboardCommand(store, 'cut')).resolves.toBe(true)

    expect(documentStub.activeElement).toBe(input)
    expect(execCommands).toEqual(['cut'])
    expect(calls).toEqual({
      deleteSelected: 0,
      pasteFromHTML: 0,
      writeCopyData: 0
    })
  })

  test('clears remembered editable targets when focus moves to non-menu chrome', async () => {
    rememberGlobals()
    const input = new HTMLInputElementStub()
    const canvasTarget = new HTMLElementStub()
    const { documentStub, execCommands, setActiveElement } = installClipboardDom(input)
    const { calls, store } = createStore()

    rememberClipboardEditableTarget(input)
    rememberClipboardEditableTarget(canvasTarget)
    setActiveElement(canvasTarget)

    await expect(executeClipboardCommand(store, 'cut')).resolves.toBe(false)

    expect(documentStub.activeElement).toBe(canvasTarget)
    expect(execCommands).toEqual([])
    expect(calls).toEqual({
      deleteSelected: 0,
      pasteFromHTML: 0,
      writeCopyData: 0
    })
  })

  test('does not reuse a menu-restored editable after pointerdown on non-menu chrome', async () => {
    rememberGlobals()
    const input = new HTMLInputElementStub()
    const chromeTarget = new HTMLElementStub()
    const { documentStub, execCommands, setActiveElement } = installClipboardDom(input)
    const { calls, store } = createStore()

    input.selectionStart = 0
    input.selectionEnd = 6
    rememberClipboardEditableTarget(input)
    rememberClipboardEditableTarget(chromeTarget)
    setActiveElement(chromeTarget)
    rememberClipboardEditableTarget(chromeTarget)
    setActiveElement(input)

    await expect(executeClipboardCommand(store, 'cut')).resolves.toBe(false)

    expect(documentStub.activeElement).toBeNull()
    expect(input.selectionRanges).toEqual([[6, 6]])
    expect(execCommands).toEqual([])
    expect(calls).toEqual({
      deleteSelected: 0,
      pasteFromHTML: 0,
      writeCopyData: 0
    })
  })

  test('blocks replacement editables restored by menu focus after non-menu chrome focus', async () => {
    rememberGlobals()
    const input = new HTMLInputElementStub()
    const replacementInput = new HTMLInputElementStub()
    const chromeTarget = new HTMLElementStub()
    const menuItem = new HTMLElementStub()
    menuItem.setAttribute('role', 'menuitem')
    const { documentStub, execCommands, setActiveElement } = installClipboardDom(input)
    const { calls, store } = createStore()

    input.selectionStart = 0
    input.selectionEnd = 6
    replacementInput.selectionStart = 0
    replacementInput.selectionEnd = 6
    rememberClipboardEditableTarget(input)
    rememberClipboardEditableTarget(chromeTarget)
    setActiveElement(chromeTarget)
    rememberClipboardEditableTarget(chromeTarget)
    rememberClipboardEditableTarget(menuItem)
    setActiveElement(replacementInput)
    rememberClipboardEditableTarget(replacementInput)

    await expect(executeClipboardCommand(store, 'cut')).resolves.toBe(false)

    expect(documentStub.activeElement).toBeNull()
    expect(input.selectionRanges).toEqual([[6, 6]])
    expect(replacementInput.selectionRanges).toEqual([[6, 6]])
    expect(execCommands).toEqual([])
    expect(calls).toEqual({
      deleteSelected: 0,
      pasteFromHTML: 0,
      writeCopyData: 0
    })
  })

  test('accepts the same editable after legitimate non-pointer refocus', async () => {
    rememberGlobals()
    const input = new HTMLInputElementStub()
    const chromeTarget = new HTMLElementStub()
    const { documentStub, execCommands, setActiveElement } = installClipboardDom(input)
    const { calls, store } = createStore()

    rememberClipboardEditableTarget(input)
    rememberClipboardEditableTarget(chromeTarget)
    setActiveElement(chromeTarget)
    rememberClipboardEditableTarget(chromeTarget)
    setActiveElement(input)
    rememberClipboardEditableTarget(input)

    await expect(executeClipboardCommand(store, 'copy')).resolves.toBe(true)
    await expect(executeClipboardCommand(store, 'cut')).resolves.toBe(true)

    expect(documentStub.activeElement).toBe(input)
    expect(execCommands).toEqual(['copy', 'cut'])
    expect(calls).toEqual({
      deleteSelected: 0,
      pasteFromHTML: 0,
      writeCopyData: 0
    })
  })

  test('accepts a different focused editable after non-pointer focus navigation', async () => {
    rememberGlobals()
    const input = new HTMLInputElementStub()
    const nextInput = new HTMLInputElementStub()
    const chromeTarget = new HTMLElementStub()
    const { documentStub, execCommands, setActiveElement } = installClipboardDom(input)
    const { calls, store } = createStore()

    rememberClipboardEditableTarget(input)
    rememberClipboardEditableTarget(chromeTarget)
    setActiveElement(chromeTarget)
    rememberClipboardEditableTarget(chromeTarget)
    setActiveElement(nextInput)
    rememberClipboardEditableTarget(nextInput)

    await expect(executeClipboardCommand(store, 'copy')).resolves.toBe(true)

    expect(documentStub.activeElement).toBe(nextInput)
    expect(execCommands).toEqual(['copy'])
    expect(calls).toEqual({
      deleteSelected: 0,
      pasteFromHTML: 0,
      writeCopyData: 0
    })
  })

  test('uses browser clipboard instead of execCommand when a blocked editable keeps selection', async () => {
    rememberGlobals()
    const input = new HTMLInputElementStub()
    const chromeTarget = new HTMLElementStub()
    const menuItem = new HTMLElementStub()
    menuItem.setAttribute('role', 'menuitem')
    const { execCommands, setActiveElement } = installClipboardDom(input, { tauri: false })
    const { itemWrites, writes } = installRichBrowserClipboard()
    const calls = {
      deleteSelected: 0,
      pasteFromHTML: 0,
      writeCopyData: 0
    }
    const store = {
      deleteSelected() {
        calls.deleteSelected += 1
      },
      async pasteFromHTML() {
        calls.pasteFromHTML += 1
      },
      async writeCopyData(transfer: DataTransfer) {
        calls.writeCopyData += 1
        transfer.setData('text/plain', 'Rectangle')
        transfer.setData('text/html', '<!--(openpencil) Rectangle -->')
      }
    }

    input.selectionStart = 0
    input.selectionEnd = 6
    rememberClipboardEditableTarget(input)
    rememberClipboardEditableTarget(chromeTarget)
    setActiveElement(chromeTarget)
    rememberClipboardEditableTarget(chromeTarget)
    rememberClipboardEditableTarget(menuItem)
    setActiveElement(input)
    rememberClipboardEditableTarget(input)

    await expect(executeClipboardCommand(store, 'cut')).resolves.toBe(true)

    expect(execCommands).toEqual([])
    expect(Object.keys(itemWrites[0]?.data ?? {}).sort()).toEqual(['text/html', 'text/plain'])
    expect(writes).toEqual([])
    expect(input.selectionRanges).toEqual([[6, 6]])
    expect(calls).toEqual({
      deleteSelected: 1,
      pasteFromHTML: 0,
      writeCopyData: 1
    })
  })

  test('keeps writeText-only browser clipboard on the execCommand path when unblocked', async () => {
    rememberGlobals()
    const menuItem = new HTMLElementStub()
    const { execCommands } = installClipboardDom(menuItem, { tauri: false })
    const { writes } = installBrowserClipboard()
    const { calls, store } = createStore()

    await expect(executeClipboardCommand(store, 'copy')).resolves.toBe(true)

    expect(execCommands).toEqual(['copy'])
    expect(writes).toEqual([])
    expect(calls).toEqual({
      deleteSelected: 0,
      pasteFromHTML: 0,
      writeCopyData: 0
    })
  })

  test('does not delete canvas selection when blocked editables cannot use rich browser clipboard', async () => {
    rememberGlobals()
    const input = new HTMLInputElementStub()
    const chromeTarget = new HTMLElementStub()
    const menuItem = new HTMLElementStub()
    menuItem.setAttribute('role', 'menuitem')
    const { execCommands, setActiveElement } = installClipboardDom(input, { tauri: false })
    const { writes } = installBrowserClipboard()
    const { calls, store } = createStore()

    input.selectionStart = 0
    input.selectionEnd = 6
    rememberClipboardEditableTarget(input)
    rememberClipboardEditableTarget(chromeTarget)
    setActiveElement(chromeTarget)
    rememberClipboardEditableTarget(chromeTarget)
    rememberClipboardEditableTarget(menuItem)
    setActiveElement(input)
    rememberClipboardEditableTarget(input)

    await expect(executeClipboardCommand(store, 'cut')).resolves.toBe(false)

    expect(execCommands).toEqual([])
    expect(writes).toEqual([])
    expect(input.selectionRanges).toEqual([[6, 6]])
    expect(calls).toEqual({
      deleteSelected: 0,
      pasteFromHTML: 0,
      writeCopyData: 0
    })
  })

  test('drops stale remembered editable targets before falling back to browser clipboard', async () => {
    rememberGlobals()
    const input = new HTMLInputElementStub()
    const menuItem = new HTMLElementStub()
    const { documentStub, execCommands, setActiveElement } = installClipboardDom(input)
    const { store } = createStore()

    rememberClipboardEditableTarget(input)
    input.isConnected = false
    setActiveElement(menuItem)

    await expect(executeClipboardCommand(store, 'copy')).resolves.toBe(true)

    expect(documentStub.activeElement).toBe(menuItem)
    expect(execCommands).toEqual(['copy'])
  })

  test('falls back to the browser canvas clipboard path when no editable target exists', async () => {
    rememberGlobals()
    const menuItem = new HTMLElementStub()
    const { execCommands } = installClipboardDom(menuItem)
    const { calls, store } = createStore()

    await expect(executeClipboardCommand(store, 'copy')).resolves.toBe(true)

    expect(execCommands).toEqual(['copy'])
    expect(calls).toEqual({
      deleteSelected: 0,
      pasteFromHTML: 0,
      writeCopyData: 0
    })
  })
})
