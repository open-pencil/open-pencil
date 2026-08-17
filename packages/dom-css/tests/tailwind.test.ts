import { describe, expect, it } from 'bun:test'

import {
  compileTailwindCSS,
  createHeadlessCSSRuntime,
  designDocumentToSceneGraph,
  tailwindHTMLToSceneGraph
} from '../src/index'
import { tailwindCardClasses, tailwindInputClasses } from './helpers'

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

  it('feeds Tailwind generated CSS through headless style computation', async () => {
    const runtime = createHeadlessCSSRuntime()
    const classes = [...tailwindCardClasses]
    const document = await runtime.computeStyles(
      runtime.parseHTML(`<article class="${classes.join(' ')}"><h1>OpenPencil</h1></article>`),
      await compileTailwindCSS(classes)
    )
    const card = document.children[0]

    expect(card?.type).toBe('element')
    if (card?.type !== 'element') return
    expect(card.computedStyle?.width).toBe('320px')
    expect(card.computedStyle?.height).toBe('176px')
    expect(card.computedStyle?.padding).toBe('24px')
    expect(card.computedStyle?.['border-radius']).toBe('0.75rem')
  })

  it('converts Tailwind HTML to scene graph frames', async () => {
    const classes = [...tailwindInputClasses]
    const graph = await tailwindHTMLToSceneGraph(
      `<input class="${classes.join(' ')}" value="https://openpencil.dev" />`,
      classes,
      { runtime: createHeadlessCSSRuntime() }
    )
    const page = graph.getPages()[0]
    const input = page ? graph.getChildren(page.id)[0] : undefined

    expect(input?.type).toBe('FRAME')
    if (input?.type !== 'FRAME') return
    expect(input.width).toBe(320)
    expect(input.height).toBe(40)
    expect(input.paddingLeft).toBe(12)
    expect(input.cornerRadius).toBe(6)
    expect(input.strokes[0]?.weight).toBe(1)
  })

  it('allows callers to compose Tailwind CSS with the lower-level conversion API', async () => {
    const runtime = createHeadlessCSSRuntime()
    const classes = [...tailwindCardClasses]
    const document = await runtime.computeStyles(
      runtime.parseHTML(`<article class="${classes.join(' ')}"><h1>OpenPencil</h1></article>`),
      await compileTailwindCSS(classes)
    )
    const graph = designDocumentToSceneGraph(document)
    const page = graph.getPages()[0]
    const card = page ? graph.getChildren(page.id)[0] : undefined

    expect(card?.type).toBe('FRAME')
    if (card?.type !== 'FRAME') return
    expect(card.width).toBe(320)
    expect(card.layoutMode).toBe('VERTICAL')
    expect(card.itemSpacing).toBe(12)
  })
})
