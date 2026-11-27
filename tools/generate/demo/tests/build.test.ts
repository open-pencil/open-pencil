import { beforeAll, describe, expect, test } from 'bun:test'

import { buildDemoGraph, withMeasuringRenderer } from '#demo/build'
import { CHAPTERS, sectionName } from '#demo/document/chapters/names'
import { COLLECTION_NAMES } from '#demo/document/theme'
import {
  RECORDED_TURN_JSX,
  RECORDED_TURN_PARENT,
  RECORDED_TURN_RESULT
} from '#demo/landing/recorded-turn'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { exportFigFile, readFigFile, populateAllFigPages } from '@open-pencil/core/io/formats/fig'
import { ALL_TOOLS } from '@open-pencil/core/tools'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { missingBindings, readBehaviour } from '@open-pencil/scene-graph/behaviours'
import { readShaderPaints } from '@open-pencil/scene-graph/shaders'
import { instanceSlotFrames, ownsSlotContent } from '@open-pencil/scene-graph/slots'

let graph: SceneGraph

/** The instances of the Player component, with the layers each shows in its artwork slot. */
function playerCovers(target: SceneGraph): { title: string; cover: string[]; owned: boolean }[] {
  return [...target.getAllNodes()]
    .filter((node) => node.type === 'INSTANCE' && node.name === 'Player')
    .flatMap((instance) => {
      const [slot] = instanceSlotFrames(target, instance)
      if (!slot) return []
      const component = instance.componentId ? target.getNode(instance.componentId) : undefined
      const title = component?.componentPropertyDefinitions.find((d) => d.name === 'Title')
      return [
        {
          title: title ? (instance.componentPropertyAssignments[title.id] ?? '') : '',
          cover: target.getChildren(slot.id).map((child) => `${child.type}:${child.name}`),
          owned: ownsSlotContent(target, slot)
        }
      ]
    })
}

function behaviours(target: SceneGraph): { kind: string; missing: string[] }[] {
  return [...target.getAllNodes()].flatMap((node: SceneNode) => {
    const behaviour = node.type === 'INSTANCE' ? null : readBehaviour(node)
    return behaviour
      ? [{ kind: behaviour.kind, missing: missingBindings(target, node, behaviour) }]
      : []
  })
}

beforeAll(async () => {
  // The .fig the app opens, without the shader stills: the editor draws those on open.
  const bytes = await withMeasuringRenderer(async (renderer) =>
    exportFigFile(await buildDemoGraph(renderer), { ck: renderer.ck, renderer })
  )
  graph = await readFigFile(new File([bytes.slice()], 'Demo.fig'))
  populateAllFigPages(graph)
})

describe('the demo document', () => {
  test('is one page of numbered chapters, top to bottom', () => {
    const [page, ...rest] = graph.getPages()
    expect(rest).toEqual([])
    const chapters = graph
      .getChildren(page.id)
      .filter((node) => node.type === 'SECTION')
      .sort((a, b) => a.y - b.y)
    expect(chapters.map((chapter) => chapter.name)).toEqual(
      Object.values(CHAPTERS).map(sectionName)
    )
    // The layer list reads the first child first.
    expect(graph.getChildren(page.id)[0]?.name).toBe(sectionName(CHAPTERS.hello))
  })

  test("names each chapter's subject as hosts look it up", () => {
    const [page] = graph.getPages()
    const sections = graph.getChildren(page.id)
    for (const chapter of Object.values(CHAPTERS)) {
      const section = sections.find((node) => node.name === sectionName(chapter))
      const children = section ? graph.getChildren(section.id) : []
      expect(children.filter((child) => child.name === chapter.subject)).toHaveLength(1)
    }
  })

  test('keeps complete behaviours on the player controls', () => {
    const controls = behaviours(graph)
    expect(controls.map((control) => control.kind).sort()).toEqual([
      'button',
      'slider',
      'toggle',
      'toggle'
    ])
    for (const control of controls) expect(control.missing).toEqual([])
  })

  test('keeps the covers its instances put in the artwork slot', () => {
    const owned = playerCovers(graph).filter((player) => player.owned)
    expect(owned.map((player) => player.cover)).toEqual([['FRAME:Cover'], ['FRAME:Cover']])
    expect(playerCovers(graph).filter((player) => !player.owned).length).toBeGreaterThan(0)
  })

  test('shows the light mode of the theme on one frame', () => {
    // Saving gives the collection and its modes Figma IDs; the names stay.
    const collection = [...graph.variableCollections.values()].find(
      (candidate) => candidate.name === 'Theme'
    )
    const light = [...graph.getAllNodes()].filter(
      (node) => node.name === 'Light' && Object.values(node.variableModes).length > 0
    )
    expect(light).toHaveLength(1)
    expect(collection?.modes.map((mode) => mode.name)).toEqual(['Dark', 'Light'])
    const lightMode = collection?.modes.find((mode) => mode.name === 'Light')
    if (!lightMode) throw new Error('Expected a Light mode')
    expect(Object.values(light[0].variableModes)).toEqual([lightMode.modeId])
  })

  test('keeps a shader preset on every shader fill', () => {
    const shaders = [...graph.getAllNodes()].flatMap((node) => readShaderPaints(node))
    expect(shaders.length).toBeGreaterThanOrEqual(5)
    for (const shader of shaders) expect(shader.preset.components.length).toBeGreaterThan(0)
  })

  test("renders the docs landing's recorded AI turn with the Theme's variables", async () => {
    const render = ALL_TOOLS.find((tool) => tool.name === 'render')
    const parent = [...graph.getAllNodes()].find((node) => node.name === RECORDED_TURN_PARENT)
    if (!render || !parent) throw new Error('Expected the render tool and the hero frame')
    const figma = new FigmaAPI(graph)
    await render.execute(figma, { parent_id: parent.id, jsx: RECORDED_TURN_JSX })

    const card = graph.getChildren(parent.id).find((node) => node.name === RECORDED_TURN_RESULT)
    if (!card) throw new Error('Expected the turn to add its card to the hero')
    const collections = new Set<string>()
    const visit = (node: SceneNode) => {
      for (const id of Object.values(node.boundVariables)) {
        const variable = graph.variables.get(id)
        const collection = variable && graph.variableCollections.get(variable.collectionId)
        collections.add(collection?.name ?? `unknown ${id}`)
      }
      for (const child of graph.getChildren(node.id)) visit(child)
    }
    visit(card)
    expect([...collections]).toEqual([COLLECTION_NAMES.theme])
    graph.deleteNode(card.id)
  })
})
