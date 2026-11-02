import { describe, expect, test } from 'bun:test'

import { pxUtilities } from '../src/steiger-rules/px-classes'

const found = (content: string, file = 'src/components/Example.vue') =>
  pxUtilities(file, content).map(({ utility }) => utility)

describe('pixel-sized Tailwind utilities', () => {
  test('finds px lengths in arbitrary values, with variants and negatives', () => {
    expect(
      found(
        `<div class="text-[11px] hover:h-[26px] -bottom-[9px] grid-cols-[24px_minmax(0,1fr)] w-[min(360px,100%)]" />`
      )
    ).toEqual([
      'text-[11px]',
      'h-[26px]',
      '-bottom-[9px]',
      'grid-cols-[24px_minmax(0,1fr)]',
      'w-[min(360px,100%)]'
    ])
  })

  test('allows rem and theme sizes, shadows, and non-length values', () => {
    expect(
      found(
        `const ui = 'text-2xs h-6.5 w-[22.5rem] rounded-md shadow-[0_8px_30px_var(--color-border)] grid-cols-[repeat(2,1fr)] w-px'`
      )
    ).toEqual([])
  })

  test('reports the line and column', () => {
    expect(pxUtilities('src/theme/panel.ts', `const a = 1\nconst b = 'p-1 text-[9px]'`)).toEqual([
      { utility: 'text-[9px]', line: 2, column: 16 }
    ])
  })

  test('only checks the app and the Vue SDK', () => {
    expect(found(`<div class="text-[11px]" />`, 'packages/docs/Example.vue')).toEqual([])
    expect(found(`'text-[11px]'`, 'packages/vue/src/primitives/Example.vue')).toHaveLength(1)
  })
})
