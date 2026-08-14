import { describe, expect, test } from 'bun:test'

import { highlightJSX } from '@/app/code/highlight'

describe('code highlighting', () => {
  test('highlights JavaScript and JSX syntax without a Prism global', () => {
    const existingPrism = Reflect.get(globalThis, 'Prism')
    const html = highlightJSX('const view = <Button disabled>{label}</Button>')

    expect(html).toContain('<span class="token keyword">const</span>')
    expect(html).toContain('<span class="token class-name">Button</span>')
    expect(html).toContain('<span class="token attr-name">disabled</span>')
    expect(Reflect.get(globalThis, 'Prism')).toBe(existingPrism)
  })
})
