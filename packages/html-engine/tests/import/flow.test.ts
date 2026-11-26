import { describe, expect, it } from 'bun:test'

import { htmlToSceneGraph } from '@open-pencil/dom-css'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { layoutSizing } from '@open-pencil/scene-graph/layout'

import { engineRuntime } from '../helpers/engine'

async function importHTML(html: string) {
  const graph = await htmlToSceneGraph(html, { runtime: engineRuntime() })
  const byName = (name: string): SceneNode => {
    const node = [...graph.getAllNodes()].find((candidate) => candidate.name === name)
    if (!node) throw new Error(`Missing ${name}`)
    return node
  }
  const sizing = (node: SceneNode) => [
    layoutSizing(graph, node, 'HORIZONTAL'),
    layoutSizing(graph, node, 'VERTICAL')
  ]
  return { graph, byName, sizing }
}

function textIn(graph: SceneGraph, parent: SceneNode): SceneNode {
  const text = graph.getChildren(parent.id).find((child) => child.type === 'TEXT')
  if (!text) throw new Error(`No text in ${parent.name}`)
  return text
}

describe('HTML flow as auto layout', () => {
  it('stacks block flow vertically and stretches block children across', async () => {
    const { graph, byName, sizing } = await importHTML(
      `<div id="page" style="width:390px"><div id="card" style="padding:20px">Saldo</div></div>`
    )
    expect(byName('page').layoutMode).toBe('VERTICAL')
    const card = byName('card')
    expect(card.layoutMode).toBe('VERTICAL')
    expect(card.paddingTop).toBe(20)
    expect(sizing(card)).toEqual(['FILL', 'HUG'])
    // Text in a block wraps at the block's width.
    expect(textIn(graph, card).textAutoResize).toBe('HEIGHT')
  })

  it('hugs inline-level content and centers a button label', async () => {
    const { graph, byName, sizing } = await importHTML(
      `<div><button id="send" style="padding:14px">Enviar</button><span id="tag" style="padding:4px">New</span></div>`
    )
    const send = byName('send')
    expect(send).toMatchObject({ primaryAxisAlign: 'CENTER', counterAxisAlign: 'CENTER' })
    expect(sizing(send)).toEqual(['HUG', 'HUG'])
    const tag = byName('tag')
    expect(tag.layoutMode).toBe('HORIZONTAL')
    expect(sizing(tag)).toEqual(['HUG', 'HUG'])
    expect(textIn(graph, send).textAutoResize).toBe('WIDTH_AND_HEIGHT')
  })

  it('stacks block children inside an inline-block, which sits in a line itself', async () => {
    const { byName, sizing } = await importHTML(
      `<div style="width:300px"><div id="chip" style="display:inline-block"><div>Title</div><div>Detail</div></div></div>`
    )
    const chip = byName('chip')
    expect(chip.layoutMode).toBe('VERTICAL')
    expect(sizing(chip)).toEqual(['HUG', 'HUG'])
  })

  it('adds padding to a size derived from aspect-ratio', async () => {
    const { byName } = await importHTML(
      `<div id="square" style="width:100px;aspect-ratio:1;padding:10px"></div>`
    )
    expect(byName('square')).toMatchObject({ width: 120, height: 120 })
  })

  it('stretches flex items across unless they set their own cross size', async () => {
    const { byName, sizing } = await importHTML(
      `<div id="column" style="display:flex;flex-direction:column;width:300px">
        <div id="stretched" style="padding:8px">A</div>
        <div id="narrow" style="width:120px;height:20px"></div>
        <div id="grown" style="flex:1">B</div>
      </div>`
    )
    expect(byName('column').counterAxisAlign).toBe('STRETCH')
    expect(sizing(byName('stretched'))).toEqual(['FILL', 'HUG'])
    expect(sizing(byName('narrow'))).toEqual(['FIXED', 'FIXED'])
    expect(sizing(byName('grown'))[1]).toBe('FILL')
  })

  it('places padding and borders outside an explicit size unless border-box', async () => {
    const { byName } = await importHTML(
      `<div id="content" style="width:100px;height:50px;padding:10px;border:2px solid #000">A</div>
       <div id="border" style="width:100px;padding:10px;box-sizing:border-box">B</div>`
    )
    expect(byName('content')).toMatchObject({ width: 124, height: 74 })
    expect(byName('border').width).toBe(100)
  })

  it('gives a border room by its style, also in the default current color', async () => {
    const { byName } = await importHTML(
      `<div id="styled" style="width:100px;border:2px solid">A</div>
       <div id="unstyled" style="width:100px;border-width:2px">B</div>`
    )
    expect(byName('styled').width).toBe(104)
    // A border without a style is none, so it takes no room.
    expect(byName('unstyled').width).toBe(100)
  })

  it('hugs text in a stretching row and in boxes sized to their content', async () => {
    const { graph, byName, sizing } = await importHTML(
      `<nav style="display:flex;width:400px"><div id="links" style="display:flex;gap:8px"><a>Docs</a></div></nav>
       <div style="position:relative;width:200px"><div id="badge" style="position:absolute;padding:2px 8px">Popular</div></div>`
    )
    // A row stretches its items across, which is no reason for text to stop sizing itself.
    expect(textIn(graph, byName('links')).textAutoResize).toBe('WIDTH_AND_HEIGHT')
    // An absolute box sizes to its content, so its text hugs rather than filling it.
    const badge = byName('badge')
    expect(sizing(badge)).toEqual(['HUG', 'HUG'])
    expect(textIn(graph, badge).textAutoResize).toBe('WIDTH_AND_HEIGHT')
  })

  it('gives text only what CSS inherits, centering it in a button', async () => {
    const { graph, byName } = await importHTML(
      `<div style="position:relative;width:200px"><div id="badge" style="position:absolute;left:120px;top:8px;opacity:0.5;color:#ff0000">Popular</div></div>
       <button id="send" style="width:200px">Send</button>`
    )
    const text = textIn(graph, byName('badge'))
    // The badge's position and opacity are its own; its color is the text's.
    expect(text).toMatchObject({ layoutPositioning: 'AUTO', x: 0, y: 0, opacity: 1 })
    expect(text.fills[0]?.type).toBe('SOLID')
    expect(textIn(graph, byName('send')).textAlignHorizontal).toBe('CENTER')
  })

  it('fills a 100% width and leaves out display: none', async () => {
    const { graph, byName, sizing } = await importHTML(
      `<div style="display:flex"><div id="wide" style="width:100%">A</div><div id="hidden" style="display:none">B</div></div>`
    )
    expect(sizing(byName('wide'))[0]).toBe('FILL')
    expect([...graph.getAllNodes()].some((node) => node.name === 'hidden')).toBe(false)
  })

  it('aligns a block’s lines by text-align, but not the blocks it holds', async () => {
    const { byName } = await importHTML(
      `<div id="lines" style="text-align:center;padding:8px">Docs</div>` +
        `<div id="blocks" style="text-align:center;padding:8px"><div id="inner" style="width:100px;padding:8px">Box</div></div>`
    )
    expect(byName('lines').counterAxisAlign).toBe('CENTER')
    // `text-align` centers the inner block's line inside it, not the block itself.
    expect(byName('blocks').counterAxisAlign).toBe('MIN')
    expect(byName('inner').counterAxisAlign).toBe('CENTER')
  })

  it('centers a block by its auto margins, and puts one with only a left one at the end', async () => {
    const { byName, sizing } = await importHTML(
      `<div style="width:600px">` +
        `<div id="centered" style="width:200px;height:10px;margin:0 auto"></div>` +
        `<div id="end" style="width:200px;height:10px;margin-left:auto"></div>` +
        `<div id="capped" style="max-width:300px;margin:0 auto"><div style="width:400px;height:10px"></div></div>` +
        `<div id="full" style="margin:0 auto">Fills</div>` +
        `</div>`
    )
    expect(byName('centered').layoutAlignSelf).toBe('CENTER')
    expect(byName('end').layoutAlignSelf).toBe('MAX')
    // A capped block among blocks the container's alignment would move hugs up to its maximum.
    const capped = byName('capped')
    expect(capped.layoutAlignSelf).toBe('CENTER')
    expect(sizing(capped)[0]).toBe('HUG')
    expect(capped.maxWidth).toBe(300)
    // Without a width of its own a block fills the container, with no room to center in.
    expect(sizing(byName('full'))[0]).toBe('FILL')
  })

  it('keeps a capped block filling up to its maximum, centered by its container', async () => {
    const { byName, sizing } = await importHTML(
      `<div id="page" style="width:600px">` +
        `<div id="header" style="height:10px"></div>` +
        `<div id="main" style="max-width:300px;margin:0 auto"><div style="width:100px;height:10px"></div></div>` +
        `</div>`
    )
    // CSS sizes the block before centering it: 300px wide however narrow its content, as a
    // Fill capped at 300px is, which Figma places by its parent's alignment.
    const main = byName('main')
    expect(sizing(main)[0]).toBe('FILL')
    expect(main.maxWidth).toBe(300)
    expect(byName('page').counterAxisAlign).toBe('CENTER')
    expect(sizing(byName('header'))[0]).toBe('FILL')
  })

  it('leaves the container unaligned when a capped sibling stays at the start', async () => {
    const { byName, sizing } = await importHTML(
      `<div id="page" style="width:600px">` +
        `<div id="header" style="max-width:200px;height:10px"></div>` +
        `<div id="main" style="max-width:300px;margin:0 auto"><div style="width:100px;height:10px"></div></div>` +
        `</div>`
    )
    // Aligning the container would center the header too, which the page keeps at the start.
    expect(byName('page').counterAxisAlign).not.toBe('CENTER')
    expect(sizing(byName('header'))[0]).toBe('FILL')
    expect(byName('main').layoutAlignSelf).toBe('CENTER')
  })

  it('centers boxes in a line by text-align past an absolutely positioned child', async () => {
    const { byName } = await importHTML(
      `<div id="row" style="width:600px;text-align:center;position:relative">` +
        `<span style="display:inline-block;width:40px;height:10px"></span>` +
        `<div style="position:absolute;top:0;left:0;width:10px;height:10px"></div>` +
        `</div>`
    )
    expect(byName('row').counterAxisAlign).toBe('CENTER')
  })

  it('centers blocks and lines in <center>, and boxes in a line by text-align', async () => {
    const { graph, byName } = await importHTML(
      `<div style="width:600px">` +
        `<center id="legacy"><div id="block" style="width:200px;height:10px"></div><div id="line">Words</div></center>` +
        `<div id="row" style="text-align:center"><span id="chip" style="display:inline-block;padding:4px">Tag</span></div>` +
        `</div>`
    )
    expect(byName('block').layoutAlignSelf).toBe('CENTER')
    expect(textIn(graph, byName('line')).textAlignHorizontal).toBe('CENTER')
    expect(byName('row').counterAxisAlign).toBe('CENTER')
  })
})
