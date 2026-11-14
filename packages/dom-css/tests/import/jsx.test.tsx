/** @jsxImportSource @open-pencil/dom-css */

import { describe, expect, it } from 'bun:test'

import { serializeHTML } from '#dom-css/export/index'
import { jsxToDesignDocument } from '#dom-css/index'

import { jsx } from '@open-pencil/dom-css/browser'

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
})

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
})
