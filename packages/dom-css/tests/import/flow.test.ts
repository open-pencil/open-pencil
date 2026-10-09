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
    expect(send.layoutMode).toBe('HORIZONTAL')
    expect(send.primaryAxisAlign).toBe('CENTER')
    expect(sizing(send)).toEqual(['HUG', 'HUG'])
    expect(sizing(byName('tag'))).toEqual(['HUG', 'HUG'])
    expect(textIn(graph, send).textAutoResize).toBe('WIDTH_AND_HEIGHT')
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

  it('fills a 100% width and leaves out display: none', async () => {
    const { graph, byName, sizing } = await importHTML(
      `<div style="display:flex"><div id="wide" style="width:100%">A</div><div id="hidden" style="display:none">B</div></div>`
    )
    expect(sizing(byName('wide'))[0]).toBe('FILL')
    expect([...graph.getAllNodes()].some((node) => node.name === 'hidden')).toBe(false)
  })
})
