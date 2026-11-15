/** @jsxImportSource @open-pencil/dom-css */

import { describe, expect, it } from 'bun:test'

import { jsxToSceneGraph, tailwindJSXToSceneGraph } from '@open-pencil/dom-css'
import { jsx } from '@open-pencil/dom-css/browser'
import { tailwindCardClasses } from '@open-pencil/test-support/dom-css'

import { engineRuntime } from '../helpers/engine'

describe('JSX through the HTML engine', () => {
  it('runs JSX through CSS runtime styles before scene graph conversion', async () => {
    const graph = await jsxToSceneGraph(
      <article class="card">
        <h1 class="title">OpenPencil</h1>
      </article>,
      {
        runtime: engineRuntime(),
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
    // CSS sizes the content box, so padding comes on top.
    expect(card.width).toBe(320 + 2 * 24)
    expect(card.height).toBe(160 + 2 * 24)
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
      { runtime: engineRuntime() }
    )
    const page = graph.getPages()[0]
    const card = page ? graph.getChildren(page.id)[0] : undefined

    expect(card?.type).toBe('FRAME')
    expect(card?.width).toBe(320)
    expect(card?.height).toBe(176)
    expect(card?.itemSpacing).toBe(12)
  })

  it('converts JSX through CSS runtime into scene graph', async () => {
    const graph = await jsxToSceneGraph(
      jsx('article', {
        class: 'card',
        children: jsx('h1', { class: 'title', children: 'OpenPencil' })
      }),
      {
        runtime: engineRuntime(),
        cssText: `
          .card { display: flex; flex-direction: column; width: 320px; height: 160px; padding: 24px; }
          .title { font-size: 24px; font-weight: 700; line-height: 32px; }
        `
      }
    )
    const page = graph.getPages()[0]
    const card = page ? graph.getChildren(page.id)[0] : undefined

    expect(card?.type).toBe('FRAME')
    // CSS sizes the content box, so padding comes on top.
    expect(card?.width).toBe(320 + 2 * 24)
    expect(card?.height).toBe(160 + 2 * 24)
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
      { runtime: engineRuntime() }
    )
    const page = graph.getPages()[0]
    const card = page ? graph.getChildren(page.id)[0] : undefined

    expect(card?.type).toBe('FRAME')
    expect(card?.width).toBe(320)
    expect(card?.height).toBe(176)
    expect(card?.itemSpacing).toBe(12)
  })
})
