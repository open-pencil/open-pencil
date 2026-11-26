import { describe, expect, test } from 'bun:test'

import { open } from '#core-tests/helpers/fig/archive'
import { recordsOf } from '#core-tests/helpers/fig/patch'

import { createDocumentGraph } from '@open-pencil/core'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  defaultLayerAnimation,
  slideBuild,
  slideRows,
  slideSettings,
  type SlideTransition
} from '@open-pencil/scene-graph/slides'
import { easingPreset } from '@open-pencil/scene-graph/variables'

function firstSlide(graph: SceneGraph): SceneNode {
  const [slide] = slideRows(graph, graph.getPages()[0].id).flat()
  return slide
}

/** A deck whose one slide holds a title and a box, with a Motion collection. */
function deck() {
  const graph = createDocumentGraph('slides', 'light')
  const slide = firstSlide(graph)
  const title = graph.createNode('TEXT', slide.id, { name: 'Title', text: 'Hello' })
  const box = graph.createNode('RECTANGLE', slide.id, { name: 'Box', width: 200, height: 200 })
  const motion = graph.createCollection('Motion')
  const fast = graph.createVariable('Duration/Fast', 'TIMING', motion.id, 0.25)
  const pause = graph.createVariable('Duration/Pause', 'TIMING', motion.id, 3)
  const snappy = graph.createVariable('Easing/Snappy', 'EASING', motion.id, easingPreset('LINEAR'))
  return { graph, slide, title, box, fast, pause, snappy }
}

async function reopen(graph: SceneGraph): Promise<SceneGraph> {
  return parseFigFile((await exportFigFile(graph)).slice().buffer)
}

function byName(graph: SceneGraph, name: string): SceneNode {
  const node = graph.getAllNodes().find((item) => item.name === name)
  if (!node) throw new Error(`No layer named ${name}`)
  return node
}

describe('slide transitions in a .deck', () => {
  test('a custom curve, a spring, and the variables they follow survive a save', async () => {
    const { graph, slide, fast, pause, snappy } = deck()
    const transition: SlideTransition = {
      style: 'PUSH_FROM_RIGHT',
      duration: 0.25,
      easing: { easing: 'CUSTOM_CUBIC', bezier: { x1: 0.2, y1: 0, x2: 0, y2: 1 } },
      durationVariableId: fast.id,
      easingVariableId: snappy.id,
      timing: { type: 'AFTER_DELAY', delay: 3, delayVariableId: pause.id }
    }
    graph.updateNode(slide.id, { slide: { skipped: false, notes: '', transition } })
    const reopened = await reopen(graph)
    const saved = slideSettings(firstSlide(reopened))?.transition
    expect(saved?.easing).toEqual(transition.easing)
    expect(saved?.style).toBe('PUSH_FROM_RIGHT')
    // Each field follows the variable of the same name in the reopened file.
    const names = (id: string | undefined) => (id ? reopened.variables.get(id)?.name : undefined)
    expect(names(saved?.durationVariableId)).toBe('Duration/Fast')
    expect(names(saved?.easingVariableId)).toBe('Easing/Snappy')
    expect(saved?.timing.type === 'AFTER_DELAY' && names(saved.timing.delayVariableId)).toBe(
      'Duration/Pause'
    )

    const spring = { stiffness: 300, damping: 17, mass: 2, type: 'PHYSICAL' as const }
    graph.updateNode(slide.id, {
      slide: {
        skipped: false,
        notes: '',
        transition: { ...transition, easing: { easing: 'CUSTOM_SPRING', spring } }
      }
    })
    const sprung = slideSettings(firstSlide(await reopen(graph)))?.transition
    expect(sprung?.easing).toEqual({ easing: 'CUSTOM_SPRING', spring })
  })

  test('unbinding a variable in a reopened deck removes it from the record', async () => {
    const { graph, slide, fast } = deck()
    const transition: SlideTransition = {
      style: 'DISSOLVE',
      duration: 0.25,
      easing: easingPreset('OUT_CUBIC'),
      durationVariableId: fast.id,
      timing: { type: 'ON_CLICK' }
    }
    graph.updateNode(slide.id, { slide: { skipped: false, notes: '', transition } })
    const opened = await open(await exportFigFile(graph))
    const { durationVariableId: _unbound, ...values } = transition
    opened.updateNode(firstSlide(opened).id, {
      slide: { skipped: false, notes: '', transition: { ...values, duration: 0.8 } }
    })
    const bytes = await exportFigFile(opened)
    const record = [...recordsOf(bytes).values()].find((item) => item.type === 'SLIDE')
    expect(JSON.stringify(record?.prototypeInteractions)).not.toContain('transitionDurationVar')
    expect(slideSettings(firstSlide(await parseFigFile(bytes.slice().buffer)))?.transition).toEqual(
      { ...values, duration: 0.8 }
    )
  })
})

describe('layer animations in a .deck', () => {
  test('steps are kept per record, as Figma writes them, and come back on their layers', async () => {
    const { graph, title, box } = deck()
    graph.updateNode(title.id, { animation: defaultLayerAnimation(0) })
    graph.updateNode(box.id, {
      animation: { ...defaultLayerAnimation(1), style: 'FADE', trigger: 'AFTER_PREVIOUS' }
    })
    const bytes = await exportFigFile(graph)
    const record = [...recordsOf(bytes).values()].find((item) => item.type === 'SLIDE')
    const steps = record?.objectAnimations
    // "After previous" is a further action of the step before, not a record of its own.
    expect(Array.isArray(steps) && steps.length).toBe(1)
    expect(JSON.stringify(steps)).toContain('"connectionType":"OBJECT_ANIMATION"')

    const reopened = await parseFigFile(bytes.slice().buffer)
    expect(byName(reopened, 'Title').animation).toEqual(defaultLayerAnimation(0))
    expect(byName(reopened, 'Box').animation).toMatchObject({
      style: 'FADE',
      trigger: 'AFTER_PREVIOUS',
      order: 1
    })
    const build = slideBuild(reopened, firstSlide(reopened).id)
    expect(build.map((step) => step.layers.length)).toEqual([2])
  })

  test('removing an animation from a reopened deck removes its step from the slide', async () => {
    const { graph, title, box } = deck()
    graph.updateNode(title.id, { animation: defaultLayerAnimation(0) })
    graph.updateNode(box.id, { animation: defaultLayerAnimation(1) })
    const opened = await open(await exportFigFile(graph))
    opened.updateNode(byName(opened, 'Title').id, { animation: null })
    const reopened = await parseFigFile((await exportFigFile(opened)).slice().buffer)
    expect(byName(reopened, 'Title').animation).toBeNull()
    // A file keeps the steps' order, not their numbers, so the one left is the first.
    expect(slideBuild(reopened, firstSlide(reopened).id).map((step) => step.layers)).toEqual([
      [{ id: byName(reopened, 'Box').id, animation: defaultLayerAnimation(0) }]
    ])
  })
})
