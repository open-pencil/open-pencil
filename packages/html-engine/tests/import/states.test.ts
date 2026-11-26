import { describe, expect, test } from 'bun:test'

import { htmlToDesignDocument } from '@open-pencil/dom-css'

import { engineRuntime, engineWithInter } from '../helpers/engine'

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

  test('ignore states that do not exist', async () => {
    expect(await opacities('<i data-force-state="constructor">x</i>')).toEqual(['1'])
  })

  test('hold for what contains the element where CSS says so', async () => {
    const css = `<style>div:hover{opacity:.2} p:focus-within{opacity:.3} section:focus{opacity:.4}</style>`
    const html = `<div><b data-force-state="hover">x</b></div><p><b data-force-state="focus-visible">x</b></p><section><b data-force-state="focus">x</b></section>`
    expect(await opacities(css + html)).toEqual(['0.2', '0.3', '1'])
  })

  test('hold on the root, with the states they imply', async () => {
    const runtime = engineRuntime()
    const document = runtime.parseHTML('<i>x</i>')
    const css = 'html:hover i{opacity:.2} html:focus-visible i{opacity:.3} html:focus i{color:red}'
    const styled = async (state: string) => {
      const { children } = await runtime.computeStyles(document, css, {
        rootAttributes: { 'data-force-state': state }
      })
      const [element] = children
      const style = element.type === 'element' ? element.computedStyle : undefined
      return [style?.opacity, style?.color]
    }
    expect(await styled('hover')).toEqual(['0.2', 'rgb(0, 0, 0)'])
    expect(await styled('focus-visible')).toEqual(['0.3', 'rgb(255, 0, 0)'])
    expect(await styled('')).toEqual(['1', 'rgb(0, 0, 0)'])
  })

  test('leave the states a later mode no longer names', async () => {
    const engine = await engineWithInter()
    const capture = await engine.layout(
      '<!doctype html><html><head><style>html:hover i{opacity:.2} html:focus-visible i{opacity:.3}</style></head><body><i>x</i></body></html>',
      {
        viewport: { width: 100, height: 100 },
        rootAttributes: { 'data-force-state': 'hover' },
        modes: [{}, { 'data-force-state': 'focus-visible' }, { 'data-force-state': 'focus' }]
      }
    )
    const opacity = (nodes: typeof capture.nodes) =>
      nodes.find((node) => node.tag === 'i')?.style?.opacity ?? '1'
    expect([capture, ...capture.modes].map(({ nodes }) => opacity(nodes))).toEqual([
      '0.2',
      '1',
      '0.3',
      '1'
    ])
  })

  test('reach nested rules, media queries, :has(), and linked stylesheets', async () => {
    const css = `@media (hover: hover) { i { &:hover { opacity: .2 } } } b:has(> u:hover) { opacity: .3 }`
    expect(
      await opacities(
        `<link rel="stylesheet" href="a.css"><i data-force-state="hover">x</i><b><u><em data-force-state="hover">x</em></u></b>`,
        css
      )
    ).toEqual(['0.2', '0.3'])
  })
})

describe('relational selectors', () => {
  test('match by what an element holds', async () => {
    expect(
      await opacities('<style>div:has(> em){opacity:.5}</style><div><em>x</em></div><div>x</div>')
    ).toEqual(['0.5', '1'])
  })
})
