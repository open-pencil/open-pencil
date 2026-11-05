import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'

import { Window } from 'happy-dom'
import { defineComponent, h } from 'vue'

import { createEditor, type Editor } from '@open-pencil/core'
import type { VectorNetwork } from '@open-pencil/scene-graph'

import { createTestRenderer, hostNode } from '@open-pencil/test-support/vue/renderer'

import { provideEditor } from '#vue/editor/context'
import { useEditorKeyboard, type EditorKeyboardOptions } from '#vue/editor/keyboard'

/** The browser globals the keyboard reads, from a happy-dom window, put back after the suite. */
const DOM_GLOBALS = [
  'window',
  'document',
  'navigator',
  'KeyboardEvent',
  'Element',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLTextAreaElement',
  'HTMLButtonElement',
  'HTMLCanvasElement'
] as const
/** tinykeys' `$mod`, from the platform it read when it loaded: Meta on Apple, Control elsewhere. */
const MOD = /Mac|iPod|iPhone|iPad/.test(globalThis.navigator?.platform ?? '')
  ? { metaKey: true }
  : { ctrlKey: true }
const saved = new Map<string, PropertyDescriptor | undefined>()
let dom: Window

beforeAll(() => {
  dom = new Window()
  for (const name of DOM_GLOBALS) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value: name === 'window' ? dom : Reflect.get(dom, name)
    })
  }
})

afterAll(async () => {
  for (const [name, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
  await dom.happyDOM.close()
})

const renderer = createTestRenderer()
let unmount: (() => void) | null = null

afterEach(() => {
  unmount?.()
  unmount = null
})

/** An editor with the keyboard bound to it, as a host mounts it under `provideEditor`. */
function mountKeyboard(options: EditorKeyboardOptions = {}): Editor {
  const editor = createEditor()
  const Keyboard = defineComponent({
    setup() {
      useEditorKeyboard(options)
      return () => h('div')
    }
  })
  const app = renderer.createApp(
    defineComponent({
      setup() {
        provideEditor(editor)
        return () => h(Keyboard)
      }
    })
  )
  app.mount(hostNode())
  unmount = () => {
    app.unmount()
    editor.dispose()
  }
  return editor
}

/** A key pressed with the canvas focused; returns whether the browser's own action was stopped. */
function press(
  code: string,
  init: { key?: string; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean } = {},
  type: 'keydown' | 'keyup' = 'keydown'
): boolean {
  const event = new dom.KeyboardEvent(type, {
    code,
    key: init.key ?? code.replace(/^Key/, '').toLowerCase(),
    bubbles: true,
    cancelable: true,
    ...init
  })
  dom.dispatchEvent(event)
  return event.defaultPrevented
}

const TRIANGLE: VectorNetwork = {
  vertices: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 50, y: 50 }
  ],
  segments: [0, 1, 2].map((start) => ({
    start,
    end: (start + 1) % 3,
    tangentStart: { x: 0, y: 0 },
    tangentEnd: { x: 0, y: 0 }
  })),
  regions: []
}

describe('useEditorKeyboard', () => {
  test('picks tools by key, and only those the host offers', () => {
    const editor = mountKeyboard()
    press('KeyR')
    expect(editor.state.activeTool).toBe('RECTANGLE')
    editor.setHostRestrictions({ tools: new Set(['SELECT', 'HAND']) })
    press('KeyP')
    expect(editor.state.activeTool).toBe('SELECT')
  })

  test('holds the hand while Space is down and gives the tool back on release', () => {
    const editor = mountKeyboard()
    press('KeyP')
    press('Space', { key: ' ' })
    expect(editor.state.activeTool).toBe('HAND')
    press('Space', { key: ' ' }, 'keyup')
    expect(editor.state.activeTool).toBe('PEN')
  })

  test("runs undo on the editor's history and stops the browser's own", () => {
    const editor = mountKeyboard()
    editor.createShape('RECTANGLE', 0, 0, 40, 40)
    const drawn = () => editor.graph.getChildren(editor.state.currentPageId).length
    expect(drawn()).toBe(1)
    expect(press('KeyZ', MOD)).toBe(true)
    expect(drawn()).toBe(0)
  })

  test('Enter and Escape open and leave a path, and leave a kept-open one open', () => {
    const editor = mountKeyboard()
    const vector = editor.graph.createNode('VECTOR', editor.state.currentPageId, {
      width: 100,
      height: 50,
      vectorNetwork: structuredClone(TRIANGLE)
    })
    editor.select([vector.id])
    press('Enter')
    expect(editor.state.nodeEditState?.nodeId).toBe(vector.id)
    press('Escape')
    expect(editor.state.nodeEditState).toBeNull()

    editor.enterNodeEditMode(vector.id, { keepOpen: true })
    press('Escape')
    press('Enter')
    expect(editor.state.nodeEditState?.nodeId).toBe(vector.id)
  })

  test("runs the host's keys and its Escape first", () => {
    const ran: string[] = []
    const editor = mountKeyboard({
      shortcuts: [{ id: 'save', keys: '$mod+KeyS', run: () => ran.push('save') }],
      onEscape: () => {
        ran.push('escape')
        return true
      }
    })
    const rect = editor.createShape('RECTANGLE', 0, 0, 40, 40)
    editor.select([rect])
    press('KeyS', MOD)
    press('Escape')
    expect(ran).toEqual(['save', 'escape'])
    expect(editor.state.selectedIds.has(rect)).toBe(true)
  })

  test('leaves keys typed into a text field to the field', () => {
    const editor = mountKeyboard()
    const input = dom.document.createElement('input')
    dom.document.body.appendChild(input)
    input.focus()
    input.dispatchEvent(
      new dom.KeyboardEvent('keydown', { code: 'KeyR', key: 'r', bubbles: true, cancelable: true })
    )
    expect(editor.state.activeTool).toBe('SELECT')
    input.remove()
  })

  test('a host key that replaces an editor key carries its own view and history rules', () => {
    const ran: string[] = []
    const editor = mountKeyboard({
      shortcuts: [{ id: 'host-escape', keys: 'Escape', run: () => ran.push('escape') }]
    })
    editor.startPlay()
    press('Escape')
    expect(ran).toEqual([])
  })

  test('keeps still while the host says another editor has the keys', () => {
    let active = false
    const editor = mountKeyboard({ active: () => active })
    const rect = editor.createShape('RECTANGLE', 0, 0, 40, 40)
    editor.select([rect])
    const x = () => editor.graph.getNode(rect)?.x
    press('KeyR')
    press('ArrowRight', { key: 'ArrowRight' })
    press('Space', { key: ' ' })
    expect([editor.state.activeTool, x()]).toEqual(['SELECT', 0])
    active = true
    press('ArrowRight', { key: 'ArrowRight' })
    expect(x()).toBe(1)
  })

  test('zooms in a read-only document', () => {
    const editor = mountKeyboard()
    editor.setReadOnly(true)
    const before = editor.state.zoom
    press('Equal', { key: '=', ...MOD })
    expect(editor.state.zoom).toBeGreaterThan(before)
  })

  test('a global host key replaces the editor key of the same name', () => {
    const ran: string[] = []
    const editor = mountKeyboard({
      shortcuts: [{ id: 'host-delete', keys: 'Delete', run: () => ran.push('delete'), global: true }]
    })
    const rect = editor.createShape('RECTANGLE', 0, 0, 40, 40)
    editor.select([rect])
    press('Delete', { key: 'Delete' })
    expect(ran).toEqual(['delete'])
    expect(editor.graph.getNode(rect)).toBeDefined()
  })

  test('a tool key the host does not offer leaves the held hand to return to the tool before', () => {
    const editor = mountKeyboard()
    editor.setHostRestrictions({ tools: new Set(['SELECT', 'HAND']) })
    press('Space', { key: ' ' })
    press('KeyP')
    press('Space', { key: ' ' }, 'keyup')
    expect(editor.state.activeTool).toBe('SELECT')
  })

  test('arrow keys move nothing in a preview', () => {
    const editor = mountKeyboard()
    const rect = editor.createShape('RECTANGLE', 0, 0, 40, 40)
    editor.select([rect])
    editor.startPlay()
    press('ArrowRight', { key: 'ArrowRight' })
    expect(editor.graph.getNode(rect)?.x).toBe(0)
  })

  test("a preview leaves Space to its controls and still stops the browser's own Save", () => {
    const editor = mountKeyboard()
    editor.startPlay()
    expect(press('Space', { key: ' ' })).toBe(false)
    expect(editor.state.activeTool).toBe('SELECT')
    expect(press('KeyS', MOD)).toBe(true)
  })
})
