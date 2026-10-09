import { describe, expect, it } from 'bun:test'

import { createHeadlessCSSRuntime, htmlToSceneGraph } from '#dom-css/index'

import { layoutSizing, type SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

async function importHTML(html: string) {
  const graph = await htmlToSceneGraph(html, { runtime: createHeadlessCSSRuntime() })
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
})
