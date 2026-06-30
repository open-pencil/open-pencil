import { describe, expect, it } from 'bun:test'

import {
  createHeadlessCSSRuntime,
  jsx,
  jsxToDesignDocument,
  jsxToSceneGraph,
  tailwindJSXToSceneGraph
} from '@open-pencil/dom-css'

import { tailwindCardClasses } from '#tests/helpers/dom-css'

describe('@open-pencil/dom-css JSX authoring', () => {
  it('converts JSX runtime output into DesignDOM', async () => {
    const document = await jsxToDesignDocument(
      jsx('article', {
        class: 'card',
        style: { width: '320px', backgroundColor: 'white' },
        children: jsx('h1', { children: 'OpenPencil' })
      })
    )
    const card = document.children[0]

    expect(card?.type).toBe('element')
    if (card?.type !== 'element') return
    expect(card.tagName).toBe('article')
    expect(card.attrs.class).toBe('card')
    expect(card.inlineStyle?.width).toBe('320px')
    expect(card.inlineStyle?.['background-color']).toBe('white')
  })

  it('converts JSX through CSS runtime into scene graph', async () => {
    const graph = await jsxToSceneGraph(
      jsx('article', {
        class: 'card',
        children: jsx('h1', { class: 'title', children: 'OpenPencil' })
      }),
      {
        runtime: createHeadlessCSSRuntime(),
        cssText: `
          .card { display: flex; flex-direction: column; width: 320px; height: 160px; padding: 24px; }
          .title { font-size: 24px; font-weight: 700; line-height: 32px; }
        `
      }
    )
    const page = graph.getPages()[0]
    const card = page ? graph.getChildren(page.id)[0] : undefined

    expect(card?.type).toBe('FRAME')
    expect(card?.width).toBe(320)
    expect(card?.height).toBe(160)
    expect(card?.paddingLeft).toBe(24)
  })

  it('keeps Tailwind JSX flowing through generated CSS', async () => {
    const classes = [...tailwindCardClasses]
    const graph = await tailwindJSXToSceneGraph(
      jsx('article', {
        class: classes.join(' '),
        children: jsx('h1', { children: 'OpenPencil' })
      }),
      classes,
      { runtime: createHeadlessCSSRuntime() }
    )
    const page = graph.getPages()[0]
    const card = page ? graph.getChildren(page.id)[0] : undefined

    expect(card?.type).toBe('FRAME')
    expect(card?.width).toBe(320)
    expect(card?.height).toBe(176)
    expect(card?.itemSpacing).toBe(12)
  })
})
