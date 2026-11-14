import { describe, expect, it } from 'bun:test'

import { compileTailwindCSS, tailwindHTMLToSceneGraph } from '@open-pencil/dom-css'
import { designDocumentToSceneGraph } from '@open-pencil/dom-css/scene-graph'
import { tailwindCardClasses, tailwindInputClasses } from '@open-pencil/test-support/dom-css'

import { engineRuntime } from '../helpers/engine'

describe('Tailwind through the HTML engine', () => {
  it('feeds Tailwind generated CSS through headless style computation', async () => {
    const runtime = engineRuntime()
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
    expect(card.computedStyle?.['padding-top']).toBe('24px')
    expect(card.computedStyle?.['border-top-left-radius']).toBe('12px')
  })

  it('converts Tailwind HTML to scene graph frames', async () => {
    const classes = [...tailwindInputClasses]
    const graph = await tailwindHTMLToSceneGraph(
      `<input class="${classes.join(' ')}" value="https://openpencil.dev" />`,
      classes,
      { runtime: engineRuntime() }
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
    const runtime = engineRuntime()
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

  it('feeds Tailwind CSS variables through headless style computation', async () => {
    const runtime = engineRuntime()
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
