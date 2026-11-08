import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { Window } from 'happy-dom'

import { commitFocusedField } from '@/app/shell/menu/save-actions'

/** The browser globals the check reads, from a happy-dom window, put back after the suite. */
const DOM_GLOBALS = ['document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement'] as const
const saved = new Map<string, PropertyDescriptor | undefined>()
let dom: Window

beforeAll(() => {
  dom = new Window()
  for (const name of DOM_GLOBALS) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value: Reflect.get(dom, name)
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

function focused<K extends 'input' | 'textarea' | 'button'>(tag: K, attribute?: string) {
  const element = dom.document.createElement(tag)
  if (attribute) element.setAttribute(attribute, '')
  dom.document.body.appendChild(element)
  element.focus()
  return element
}

describe('commitFocusedField', () => {
  test('commits a field being typed in, as its blur does', () => {
    const input = focused('input')
    let committed = false
    input.addEventListener('blur', () => {
      committed = true
    })
    commitFocusedField()
    expect(committed).toBe(true)
    expect(dom.document.activeElement).not.toBe(input)
    input.remove()
  })

  test('leaves canvas text, written as it is typed, and other controls focused', () => {
    for (const element of [focused('textarea', 'data-canvas-text-input'), focused('button')]) {
      element.focus()
      commitFocusedField()
      expect(dom.document.activeElement).toBe(element)
      element.remove()
    }
  })
})
