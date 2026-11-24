import { describe, expect, test } from 'bun:test'

import { forceStates, htmlToDesignDocument } from '@open-pencil/dom-css'

import { engineRuntime } from '../helpers/engine'

async function opacities(html: string, fetchedCSS?: string) {
  const document = await htmlToDesignDocument(html, {
    runtime: engineRuntime({
      baseURL: 'https://example.com/',
      fetch: async (url) =>
        fetchedCSS
          ? { url, bytes: new TextEncoder().encode(fetchedCSS), contentType: 'text/css' }
          : null
    }),
    importLinkedStylesheets: true
  })
  return document.children.flatMap((node) =>
    node.type === 'element' ? [node.computedStyle?.opacity] : []
  )
}

describe('forced states', () => {
  test('match the pseudo-classes of the states an element is forced into', async () => {
    const css = `<style>i{opacity:.1} i:hover{opacity:.2} i:focus{opacity:.3} i:focus-visible{color:red;opacity:.4} i:active{opacity:.5}</style>`
    const states = ['', 'hover', 'focus', 'focus-visible', 'active', 'hover active']
    const html = states.map((state) => `<i data-force-state="${state}">x</i>`).join('')
    expect(await opacities(css + html)).toEqual(['0.1', '0.2', '0.3', '0.4', '0.5', '0.5'])
  })

  test('hold for what contains the element where CSS says so', async () => {
    const css = `<style>div:hover{opacity:.2} p:focus-within{opacity:.3} section:focus{opacity:.4}</style>`
    const html = `<div><b data-force-state="hover">x</b></div><p><b data-force-state="focus-visible">x</b></p><section><b data-force-state="focus">x</b></section>`
    expect(await opacities(css + html)).toEqual(['0.2', '0.3', '1'])
  })

  test('reach nested rules, media queries, :has(), and linked stylesheets', async () => {
    const css = `@media (hover: hover) { i { &:hover { opacity: .2 } } } b:has(u:hover) { opacity: .3 }`
    expect(
      await opacities(
        `<link rel="stylesheet" href="a.css"><i data-force-state="hover">x</i><b><u data-force-state="hover">x</u></b>`,
        css
      )
    ).toEqual(['0.2', '0.3'])
  })

  test('leave everything but state pseudo-classes as written', () => {
    const css = `a[title=":hover"]::before { content: ":hover" } /* :hover */ a:not(.x) { color: red }`
    expect(forceStates(css)).toBe(css)
  })
})

describe('relational selectors', () => {
  test('match by what an element holds', async () => {
    expect(
      await opacities('<style>div:has(> em){opacity:.5}</style><div><em>x</em></div><div>x</div>')
    ).toEqual(['0.5', '1'])
  })
})
