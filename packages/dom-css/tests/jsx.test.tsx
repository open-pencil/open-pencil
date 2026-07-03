/** @jsxImportSource @open-pencil/dom-css */
import { describe, expect, it } from 'bun:test'

import {
  createHeadlessCSSRuntime,
  jsxToDesignDocument,
  jsxToSceneGraph,
  serializeHTML,
  tailwindJSXToSceneGraph
} from '../src/index'
import { tailwindCardClasses } from './helpers'

function CardTitle(props: { children?: string }) {
  return <h1 class="title">{props.children}</h1>
}

describe('@open-pencil/dom-css JSX', () => {
  it('converts JSX elements into DesignDOM documents', async () => {
    const document = await jsxToDesignDocument(
      <article class="card" data-id="card-1" style={{ width: '320px', backgroundColor: 'white' }}>
        <CardTitle>OpenPencil</CardTitle>
        <p style="font-size: 14px; line-height: 20px">Design with JSX-shaped DOM.</p>
      </article>
    )
    const card = document.children[0]

    expect(card?.type).toBe('element')
    if (card?.type !== 'element') return
    expect(card.tagName).toBe('article')
    expect(card.attrs.class).toBe('card')
    expect(card.attrs['data-id']).toBe('card-1')
    expect(card.inlineStyle?.width).toBe('320px')
    expect(card.inlineStyle?.['background-color']).toBe('white')
    expect(serializeHTML(document)).toContain('Design with JSX-shaped DOM.')
  })

  it('runs JSX through CSS runtime styles before scene graph conversion', async () => {
    const graph = await jsxToSceneGraph(
      <article class="card">
        <h1 class="title">OpenPencil</h1>
      </article>,
      {
        runtime: createHeadlessCSSRuntime(),
        cssText: `
          .card {
            display: flex;
            flex-direction: column;
            gap: 12px;
            width: 320px;
            height: 160px;
            padding: 24px;
            background: white;
          }
          .title {
            font-size: 24px;
            font-weight: 700;
            line-height: 32px;
          }
        `
      }
    )
    const page = graph.getPages()[0]
    const card = page ? graph.getChildren(page.id)[0] : undefined

    expect(card?.type).toBe('FRAME')
    if (card?.type !== 'FRAME') return
    expect(card.width).toBe(320)
    expect(card.height).toBe(160)
    expect(card.layoutMode).toBe('VERTICAL')
    expect(card.paddingLeft).toBe(24)

    const title = graph.getChildren(card.id)[0]
    expect(title?.type).toBe('TEXT')
    expect(title?.fontSize).toBe(24)
  })

  it('feeds JSX Tailwind classes through generated CSS', async () => {
    const classes = [...tailwindCardClasses]
    const graph = await tailwindJSXToSceneGraph(
      <article class={classes.join(' ')}>
        <h1>OpenPencil</h1>
      </article>,
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
