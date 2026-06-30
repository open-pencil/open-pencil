import { describe, expect, it } from 'bun:test'

import { compileTailwindCSS, createHeadlessCSSRuntime } from '@open-pencil/dom-css'

import { tailwindCardClasses } from '#tests/helpers/dom-css'

describe('@open-pencil/dom-css Tailwind', () => {
  it('compiles utility candidates through Tailwind', async () => {
    const css = await compileTailwindCSS(tailwindCardClasses)

    expect(css).toContain('.flex')
    expect(css).toContain('.w-80')
    expect(css).toContain('.p-6')
    expect(css).toContain('--spacing')
  })

  it('feeds Tailwind CSS variables through headless style computation', async () => {
    const runtime = createHeadlessCSSRuntime()
    const css = await compileTailwindCSS(tailwindCardClasses)
    const document = await runtime.computeStyles(
      runtime.parseHTML(`<section class="${tailwindCardClasses.join(' ')}"></section>`),
      css
    )
    const element = document.children[0]

    expect(element?.type).toBe('element')
    if (element?.type !== 'element') return
    expect(element.computedStyle?.width).toBe('320px')
    expect(element.computedStyle?.['padding-top']).toBe('24px')
  })
})
