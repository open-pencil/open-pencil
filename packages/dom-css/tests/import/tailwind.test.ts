import { describe, expect, it } from 'bun:test'

import { compileTailwindCSS } from '#dom-css/index'

import { tailwindCardClasses } from '@open-pencil/test-support/dom-css'

describe('@open-pencil/dom-css Tailwind', () => {
  it('compiles utility candidates through Tailwind', async () => {
    const css = await compileTailwindCSS(['flex', 'w-80', 'p-6', 'rounded-xl'])

    expect(css).toContain('.flex')
    expect(css).toContain('.w-80')
    expect(css).toContain('.p-6')
    expect(css).toContain('.rounded-xl')
  })

  it('combines caller CSS with generated Tailwind utilities', async () => {
    const css = await compileTailwindCSS(['w-60', 'p-6'], {
      css: '.card { color: red; }'
    })

    expect(css).toContain('.card')
    expect(css).toContain('color: red')
    expect(css).toContain('.w-60')
    expect(css).toContain('.p-6')
  })
})

describe('@open-pencil/dom-css Tailwind', () => {
  it('compiles utility candidates through Tailwind', async () => {
    const css = await compileTailwindCSS(tailwindCardClasses)

    expect(css).toContain('.flex')
    expect(css).toContain('.w-80')
    expect(css).toContain('.p-6')
    expect(css).toContain('--spacing')
  })
})
